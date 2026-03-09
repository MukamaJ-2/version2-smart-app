from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import re
import nltk
from nltk.corpus import stopwords
from pathlib import Path
import io
import torch
import json
from PIL import Image
from transformers import DonutProcessor, VisionEncoderDecoderModel

app = Flask(__name__)
CORS(app)

# Ensure stopwords are downloaded
nltk.download('stopwords', quiet=True)
stop_words = set(stopwords.words('english'))

# Clean text function (matches what was used during training)
def clean_text(text):
    if pd.isna(text) or text is None:
        return ""
    
    # Lowercase
    text = str(text).lower()
    
    # Remove prices/numbers (e.g., '1200', '4k', '500')
    text = re.sub(r'\d+[kK]?', '', text)
    
    # Remove special punctuation (keep letters only)
    text = re.sub(r'[^a-z\s]', '', text)
    
    # Remove STOP WORDS ('on', 'for', 'the')
    words = text.split()
    filtered_words = [w for w in words if w not in stop_words]
    
    return " ".join(filtered_words)

# Initialize global variable for model
model = None
donut_processor = None
donut_model = None
# Force CPU because CUDA load is freezing indefinitely
device = "cpu"

def load_model():
    global model, donut_processor, donut_model
    if model is None:
        try:
            # Load the exported pipeline
            model_path = Path(__file__).parent.parent / "backend/training/models/transaction_categorizer/transaction_rf_pipeline.pkl"
            print(f"Loading transaction categorizer model from {model_path}...")
            model = joblib.load(model_path)
            print("Transaction categorizer loaded successfully")
        except Exception as e:
            print(f"Error loading model: {e}")
            return False
            
    if donut_processor is None or donut_model is None:
        try:
            print(f"Loading Donut receipt parser via transformers on {device}...")
            donut_processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
            donut_model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
            donut_model.to(device)
            print("Donut model loaded successfully")
        except Exception as e:
            print(f"Error loading Donut model: {e}")
            return False
            
    return True

@app.route("/api/v1/categorize", methods=["POST"])
def categorize():
    if not load_model():
        return jsonify({"error": "Model could not be loaded"}), 500

    data = request.json
    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' in request body"}), 400

    text = data.get("text", "")
    
    # Apply cleaning function used at training
    cleaned_input = clean_text(text)
    
    if cleaned_input.strip() == "":
        return jsonify({
            "category": "Other/Unknown",
            "confidence": 0.0,
            "alternatives": []
        })

    # Predict probability
    probs = model.predict_proba([cleaned_input])[0]
    
    # Get top 3 categories
    top_indices = np.argsort(probs)[::-1][:3]
    classes = model.classes_
    
    top_category = classes[top_indices[0]]
    top_confidence = probs[top_indices[0]]
    
    # Handle low confidence
    if top_confidence < 0.30:
        top_category = "Other/Unknown"
        
    alternatives = [
        {"category": classes[idx], "confidence": float(probs[idx])} 
        for idx in top_indices[1:]
    ]

    return jsonify({
        "category": top_category,
        "confidence": float(top_confidence),
        "alternatives": alternatives
    })

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok", 
        "model_loaded": model is not None,
        "donut_loaded": donut_model is not None
    })

@app.route("/api/v1/scan-receipt", methods=["POST"])
def scan_receipt():
    if not load_model():
        return jsonify({"error": "Models could not be loaded"}), 500

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # 1. Run Donut Vision Extraction
        image = Image.open(file.stream).convert("RGB")
        print("Extracting receipt info using Donut...")
        
        pixel_values = donut_processor(image, return_tensors="pt").pixel_values
        pixel_values = pixel_values.to(device)
        
        task_prompt = "<s_cord-v2>"
        decoder_input_ids = donut_processor.tokenizer(task_prompt, add_special_tokens=False, return_tensors="pt").input_ids
        decoder_input_ids = decoder_input_ids.to(device)
        
        outputs = donut_model.generate(
            pixel_values,
            decoder_input_ids=decoder_input_ids,
            max_length=donut_model.decoder.config.max_position_embeddings,
            pad_token_id=donut_processor.tokenizer.pad_token_id,
            eos_token_id=donut_processor.tokenizer.eos_token_id,
            use_cache=True,
            bad_words_ids=[[donut_processor.tokenizer.unk_token_id]],
            return_dict_in_generate=True,
        )
        
        sequence = donut_processor.batch_decode(outputs.sequences)[0]
        sequence = sequence.replace(donut_processor.tokenizer.eos_token, "").replace(donut_processor.tokenizer.pad_token, "")
        sequence = re.sub(r"<.*?>", "", sequence, count=1).strip()  # remove first task start token
        
        # Output is JSON string
        extracted_data = donut_processor.token2json(sequence)
        
        # 2. Parse Donut JSON into our standard structure
        # Donut outputs varied structures based on the receipt, but usually has 'store_name', 'total_price', and 'menu' (line items)
        merchant = extracted_data.get('store_name', 'Unknown Merchant')
        
        # Donut sometimes nests total price, we handle common paths
        total_amount_str = '0'
        if 'total' in extracted_data:
            if isinstance(extracted_data['total'], dict) and 'total_price' in extracted_data['total']:
                total_amount_str = extracted_data['total']['total_price']
            elif 'total_price' in extracted_data['total']:
                 total_amount_str = extracted_data['total']['total_price']
        
        # Clean price string and parse
        try:
            total_amount = float(re.sub(r'[^\d.]', '', str(total_amount_str)))
        except ValueError:
            total_amount = 0.0
            
        # Parse date if available
        # we'll use a placeholder if not found for simplicity
        date = "2024-03-09" 
        
        # 3. Filter & Categorize Line Items
        # Donut often extracts non-product rows (addresses, emails, receipt metadata).
        # We filter those out so only real purchasable items reach the categorizer.
        SKIP_KEYWORDS = [
            'address', 'city', 'state', 'zip', 'country', 'phone', 'fax',
            'email', 'mail.com', 'receipt no', 'receipt date', 'invoice',
            'valid till', 'seller', 'buyer', 'bill to', 'ship to',
            'thank you', 'www.', 'http', '.com', '.org', '.net',
            'subtotal', 'sub total', 'tax', 'discount', 'total',
            'item', 'qty', 'quantity', 'description', 'unit price',
        ]
        
        def is_real_product(item_dict):
            """Return True only if this looks like an actual purchased product."""
            desc = str(item_dict.get('nm', '')).lower().strip()
            price_raw = str(item_dict.get('price', ''))
            
            # Skip if description is empty or too short
            if len(desc) < 3:
                return False
            
            # Skip if description matches metadata keywords
            for kw in SKIP_KEYWORDS:
                if kw in desc:
                    return False
            
            # Skip if price doesn't contain at least one digit (not a real price)
            if not re.search(r'\d', price_raw):
                return False
                
            return True
        
        def extract_price(price_raw):
            """Pull a clean float from a price string like 'USD 100.00'."""
            try:
                return float(re.sub(r'[^\d.]', '', str(price_raw)))
            except ValueError:
                return 0.0
        
        parsed_items = []
        raw_items = extracted_data.get('menu', [])
        # Donut 'menu' might be a dict if there's only 1 item, or list of dicts
        if isinstance(raw_items, dict):
            raw_items = [raw_items]
            
        for item in raw_items:
            if not is_real_product(item):
                continue  # skip non-product rows
                
            # Extract name and price
            desc = item.get('nm', 'Unknown Item')
            if isinstance(desc, list):
                desc = " ".join(desc)
            
            item_amount = extract_price(item.get('price', '0'))

            # Categorize the item description using our RF pipeline
            cleaned_desc = clean_text(desc)
            if cleaned_desc.strip() == "":
                item_category = "Other/Unknown"
            else:
                probs = model.predict_proba([cleaned_desc])[0]
                top_idx = np.argsort(probs)[::-1][0]
                item_category = model.classes_[top_idx]
                if probs[top_idx] < 0.30:
                    item_category = "Other/Unknown"
                    
            parsed_items.append({
                "description": desc,
                "amount": item_amount,
                "category": item_category
            })
            
        response_data = {
            "merchant": merchant,
            "totalAmount": total_amount,
            "date": date,
            "items": parsed_items,
            "raw_donut_output": extracted_data # helpful for debugging
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to parse receipt: {str(e)}"}), 500

if __name__ == "__main__":
    load_model()
    app.run(host="127.0.0.1", port=5000)
