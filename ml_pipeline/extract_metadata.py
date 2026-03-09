import os
import json
import re
import torch
from PIL import Image
from transformers import DonutProcessor, VisionEncoderDecoderModel

def extract_metadata(dataset_dir="my_dataset", output_file="metadata.jsonl"):
    print(f"Starting metadata extraction for images in '{dataset_dir}'...")
    
    # Check if directory exists
    if not os.path.exists(dataset_dir):
        print(f"Error: Directory '{dataset_dir}' not found.")
        return
        
    # Get all image files
    valid_extensions = {".jpg", ".jpeg", ".png"}
    image_files = [f for f in os.listdir(dataset_dir) if os.path.splitext(f)[1].lower() in valid_extensions]
    
    if not image_files:
        print(f"No images found in '{dataset_dir}'.")
        return
        
    print(f"Found {len(image_files)} images. Loading base Donut model...")
    
    # Load Donut base model
    model_id = "naver-clova-ix/donut-base"
    processor = DonutProcessor.from_pretrained(model_id)
    model = VisionEncoderDecoderModel.from_pretrained(model_id)
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    model.eval()
    
    output_path = os.path.join(dataset_dir, output_file)
    print(f"Extracting and saving to {output_path}...")
    
    with open(output_path, "w", encoding="utf-8") as f:
        for idx, filename in enumerate(image_files):
            print(f"[{idx+1}/{len(image_files)}] Processing {filename}...")
            image_path = os.path.join(dataset_dir, filename)
            
            try:
                image = Image.open(image_path).convert("RGB")
                pixel_values = processor(image, return_tensors="pt").pixel_values.to(device)
                
                decoder_input_ids = processor.tokenizer(
                    "<s_receipt>", 
                    add_special_tokens=False, 
                    return_tensors="pt"
                ).input_ids.to(device)
                
                outputs = model.generate(
                    pixel_values,
                    decoder_input_ids=decoder_input_ids,
                    max_length=512,
                    early_stopping=True,
                    pad_token_id=processor.tokenizer.pad_token_id,
                    eos_token_id=processor.tokenizer.eos_token_id,
                    use_cache=True,
                    num_beams=1,
                    bad_words_ids=[[processor.tokenizer.unk_token_id]],
                    return_dict_in_generate=True,
                )
                
                sequence = processor.batch_decode(outputs.sequences)[0]
                sequence = sequence.replace(processor.tokenizer.eos_token, "").replace(processor.tokenizer.pad_token, "")
                sequence = re.sub(r"<.*?>", "", sequence, count=1).strip()
                
                # Format exactly as required by Donut training: {"file_name": "...", "ground_truth": "{\"gt_parse\": ...}"}
                parsed_json = processor.token2json(sequence)
                ground_truth_str = json.dumps({"gt_parse": parsed_json})
                
                jsonl_line = json.dumps({
                    "file_name": filename,
                    "ground_truth": ground_truth_str
                })
                
                f.write(jsonl_line + "\n")
                
            except Exception as e:
                print(f"Error processing {filename}: {e}")
                
    print(f"\nDone! Metadata saved to {output_path}")

if __name__ == "__main__":
    extract_metadata()
