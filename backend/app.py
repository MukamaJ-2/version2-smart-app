from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import re
import nltk
from nltk.corpus import stopwords
from pathlib import Path
import os
import requests

app = Flask(__name__)
CORS(app)

DOCTR_API_URL = os.environ.get("DOCTR_API_URL", "http://127.0.0.1:8000").rstrip("/")
NOTIFY_URL = os.environ.get("NOTIFY_URL", "http://127.0.0.1:5174/api/notifications")


def _email_alerts_enabled() -> bool:
    v = os.environ.get("ENABLE_EMAIL_ALERTS", "true").strip().lower()
    return v not in ("0", "false", "no", "off")


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

# Initialize global variables
model = None
anomaly_model = None


def load_model():
    """Load transaction categorizer for receipt item categorization."""
    global model
    if model is None:
        project_root = Path(__file__).resolve().parent.parent
        model_paths = [
            project_root / "ml_pipeline" / "transaction_rf_pipeline.pkl",
            project_root / "backend" / "training" / "models" / "transaction_categorizer" / "transaction_rf_pipeline.pkl",
        ]
        for model_path in model_paths:
            if model_path.exists():
                try:
                    print(f"Loading transaction categorizer from {model_path}...")
                    model = joblib.load(model_path)
                    print("Transaction categorizer loaded successfully")
                    break
                except Exception as e:
                    print(f"Error loading from {model_path}: {e}")
        if model is None:
            print("No transaction categorizer found; receipt items will use 'Other' category")
            model = False  # Sentinel: categorizer unavailable
    return True


def load_anomaly_model():
    """Load anomaly detector (RF, DT, or IForest)."""
    global anomaly_model
    if anomaly_model is None:
        project_root = Path(__file__).resolve().parent.parent
        model_paths = [
            project_root / "backend" / "training" / "models" / "anomaly_detector" / "anomaly_rf_pipeline.pkl",
            project_root / "backend" / "training" / "models" / "anomaly_detector" / "anomaly_dt_pipeline.pkl",
            project_root / "ml_pipeline" / "anomaly_rf_pipeline.pkl",
        ]
        for model_path in model_paths:
            if model_path.exists():
                try:
                    print(f"Loading anomaly detector from {model_path}...")
                    anomaly_model = joblib.load(model_path)
                    print("Anomaly detector loaded successfully")
                    break
                except Exception as e:
                    print(f"Error loading anomaly model from {model_path}: {e}")
        if anomaly_model is None:
            print("No anomaly detector found; anomaly detection will use fallback")
            anomaly_model = False
    return True


def _get_anomaly_model():
    return anomaly_model if anomaly_model and anomaly_model is not False else None


def _send_notification_email(to: str, subject: str, body: str) -> None:
    """Fire-and-forget helper to send an email via the Node notify server."""
    if not to:
        return
    try:
        requests.post(
            NOTIFY_URL,
            json={"to": to, "subject": subject, "text": body},
            timeout=5,
        )
    except Exception as e:
        # Backend should not crash if email fails; log and continue
        print(f"[notify] Failed to send email to {to}: {e}")


@app.route("/api/v1/detect-anomaly", methods=["POST"])
def detect_anomaly():
    """Detect if a transaction is anomalous using the trained Random Forest model."""
    load_anomaly_model()
    pipeline = _get_anomaly_model()
    if not pipeline:
        return jsonify({"error": "Anomaly detector not available"}), 500

    data = request.json
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    transaction_type = data.get("transaction_type", "Expense")
    category = data.get("category", "Miscellaneous")
    amount_ratio = data.get("amount_ratio", 1.0)
    payment_mode = data.get("payment_mode", "Unknown")

    try:
        X = pd.DataFrame(
            [
                {
                    "transaction_type": transaction_type,
                    "category": category,
                    "amount_ratio": float(amount_ratio),
                    "payment_mode": payment_mode,
                }
            ]
        )
        pred = pipeline.predict(X)[0]
        is_anomaly = (pred == 1)
        # If anomalous and an email is provided, push a structured alert with advice
        notify_email = data.get("notifyEmail") or data.get("email")
        if is_anomaly and notify_email:
            try:
                amt_ratio = float(amount_ratio)
            except Exception:
                amt_ratio = 1.0

            ratio_msg = ""
            if amt_ratio >= 2:
                ratio_msg = f" (~{amt_ratio:.1f}× your usual for this category)"

            title = "Unusual transaction detected"
            lines = [
                title,
                "",
                f"- Type: {transaction_type}",
                f"- Category: {category}",
                f"- Payment method: {payment_mode}",
                f"- Relative size: {amt_ratio:.2f}× typical spend",
                "",
                "Why this matters:",
                "This transaction is significantly larger than your usual pattern and may indicate a risky or unexpected expense.",
                "",
                "Recommended actions:",
                "1. Confirm whether you recognise this transaction.",
                "2. If not, contact your bank immediately to review and possibly block the card.",
                "3. If yes, consider setting a soft limit for this category to avoid similar spikes.",
            ]
            body = "\n".join(lines)
            _send_notification_email(
                notify_email,
                "UniGuard Alert: Unusual transaction" + ratio_msg,
                body,
            )

        # Return amount_ratio so frontend can build richer insight messages (e.g. "~9× your usual")
        return jsonify(
            {
                "isAnomaly": bool(is_anomaly),
                "anomalyScore": 1.0 if is_anomaly else 0.0,
                "amountRatio": float(amount_ratio),
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/detect-anomaly-batch", methods=["POST"])
def detect_anomaly_batch():
    """Score many transactions in one request (same features as /detect-anomaly). Max 100 rows."""
    load_anomaly_model()
    pipeline = _get_anomaly_model()
    if not pipeline:
        return jsonify({"error": "Anomaly detector not available"}), 500

    data = request.json or {}
    items = data.get("transactions")
    if not isinstance(items, list):
        return jsonify({"error": "transactions must be a list"}), 400
    if len(items) > 100:
        return jsonify({"error": "Maximum 100 transactions per batch"}), 400
    if len(items) == 0:
        return jsonify({"results": []})

    rows = []
    for item in items:
        if not isinstance(item, dict):
            return jsonify({"error": "Each transaction must be an object"}), 400
        rows.append(
            {
                "transaction_type": item.get("transaction_type", "expense"),
                "category": item.get("category", "Miscellaneous"),
                "amount_ratio": float(item.get("amount_ratio", 1.0)),
                "payment_mode": item.get("payment_mode", "Unknown"),
            }
        )

    try:
        X = pd.DataFrame(rows)
        preds = pipeline.predict(X)
        results = []
        for i, pred in enumerate(preds):
            is_anomaly = pred == 1
            results.append(
                {
                    "isAnomaly": bool(is_anomaly),
                    "anomalyScore": 1.0 if is_anomaly else 0.0,
                    "amountRatio": float(rows[i]["amount_ratio"]),
                }
            )
        return jsonify({"results": results})
    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/notify-test", methods=["POST"])
def notify_test():
    """
    Send a structured finance email to verify the notification pipeline end-to-end.

    Body:
    {
      "email": "user@example.com"
    }
    """
    data = request.json or {}
    email = data.get("email")
    if not email:
        return jsonify({"error": "Missing 'email' in request body"}), 400

    title = "Your UniGuard daily finance snapshot"
    lines = [
        title,
        "",
        "Highlights:",
        "- You stayed within budget in most categories today.",
        "- One category shows a higher spend than usual.",
        "",
        "Quick insight:",
        "Based on your recent transactions, you could safely move a small amount into savings without",
        "impacting your essential expenses.",
        "",
        "Suggested actions for today:",
        "1. Review today's largest transaction and confirm it matches your expectation.",
        "2. Set a soft limit for the category you tend to overspend in.",
        "3. Move a small fixed amount into your savings vault right now.",
        "",
        "You are doing well. Small consistent decisions are what compound into real wealth.",
        "",
        "— UniGuard Wallet",
    ]
    body = "\n".join(lines)

    if not _email_alerts_enabled():
        return jsonify(
            {
                "ok": True,
                "skipped": True,
                "message": "Email alerts are disabled (set ENABLE_EMAIL_ALERTS=true to enable).",
            }
        )

    _send_notification_email(
        email,
        "UniGuard Insight: Your daily finance snapshot",
        body,
    )

    return jsonify({"ok": True, "sentTo": email})


def _get_categorizer():
    return model if model and model is not False else None


@app.route("/api/v1/categorize", methods=["POST"])
def categorize():
    load_model()
    categorizer = _get_categorizer()
    if not categorizer:
        return jsonify({"error": "Transaction categorizer not available"}), 500

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
    probs = categorizer.predict_proba([cleaned_input])[0]
    
    # Get top 3 categories
    top_indices = np.argsort(probs)[::-1][:3]
    classes = categorizer.classes_
    
    top_category = classes[top_indices[0]]
    top_confidence = probs[top_indices[0]]
    
    # Handle low confidence (0.05 allows valid predictions; with 19+ categories max prob is often 5-15%)
    if top_confidence < 0.05:
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
        "model_loaded": model is not None and model is not False,
        "anomaly_model_loaded": anomaly_model is not None and anomaly_model is not False,
        "doctr_api_url": DOCTR_API_URL,
    })


def _parse_structured_receipt(lines, raw_text):
    """Extract structured fields from receipt text (merchant, amount, date, etc)."""
    lower = raw_text.lower()
    structured = {}

    # Amount - look for "Amount:" or "600,000 UGX" or largest number
    amount_m = re.search(r"(?:amount|total)\s*:?\s*([\d,]+\.?\d*)\s*(?:UGX|ugx|shillings?)?", lower, re.I)
    if amount_m:
        try:
            structured["amount"] = float(re.sub(r"[^\d.]", "", amount_m.group(1)))
        except ValueError:
            pass
    if "amount" not in structured:
        amounts = []
        for m in re.finditer(r"[\d,]+\.?\d*", raw_text):
            try:
                v = float(re.sub(r"[^\d.]", "", m.group()))
                if v > 0 and v < 1e12:
                    amounts.append(v)
            except ValueError:
                pass
        structured["amount"] = round(max(amounts), 2) if amounts else 0

    # Date
    date_m = re.search(r"(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{2,4})", lower, re.I)
    if date_m:
        structured["date"] = date_m.group(1).strip()

    # Time
    time_m = re.search(r"\b(\d{1,2}:\d{2}(?::\d{2})?)\b", raw_text)
    if time_m:
        structured["time"] = time_m.group(1)

    # Merchant / Bank - first line or line with "bank" / "store" / "outlet"
    for line in lines:
        if len(line) > 3 and re.search(r"bank|store|shop|outlet|merchant|centenary|agent", line.lower()):
            structured["merchant"] = line[:120]
            break
    if "merchant" not in structured and lines:
        structured["merchant"] = lines[0][:120] if lines else ""

    # Receipt number
    rec_m = re.search(r"(?:receipt|ref|transaction)\s*(?:no|#|number)?\s*:?\s*([\w\-]+)", lower, re.I)
    if rec_m:
        structured["receiptNumber"] = rec_m.group(1).strip()

    # Transaction type
    tx_m = re.search(r"(?:transaction\s*type|type)\s*:?\s*([^\n]+)", lower, re.I)
    if tx_m:
        structured["transactionType"] = tx_m.group(1).strip()[:80]

    # Outlet
    out_m = re.search(r"(?:outlet\s*name|outlet)\s*:?\s*([^\n]+)", lower, re.I)
    if out_m:
        structured["outlet"] = out_m.group(1).strip()[:100]

    # Name
    name_m = re.search(r"(?:name)\s*:?\s*([A-Z\s]{2,50})", raw_text)
    if name_m:
        structured["name"] = name_m.group(1).strip()

    # Card (masked)
    card_m = re.search(r"\*{4,}\d{4}", raw_text)
    if card_m:
        structured["cardMasked"] = card_m.group(0)

    # Trans charge / fee
    charge_m = re.search(r"(?:charge|fee|trans\s*charge)\s*:?\s*([\d,]+\.?\d*)", lower, re.I)
    if charge_m:
        try:
            structured["charge"] = float(re.sub(r"[^\d.]", "", charge_m.group(1)))
        except ValueError:
            pass

    # Balance
    bal_m = re.search(r"(?:balance)\s*:?\s*([\d,]+\.?\d*)", lower, re.I)
    if bal_m:
        try:
            structured["balance"] = float(re.sub(r"[^\d.]", "", bal_m.group(1)))
        except ValueError:
            pass

    return structured


def _extract_raw_text_from_doctr(ocr_result):
    """Return text + structured fields as extracted by DocTR OCR."""
    lines = []
    for page in ocr_result:
        for item in page.get("items", []):
            for block in item.get("blocks", []):
                for line in block.get("lines", []):
                    words = [w.get("value", "") for w in line.get("words", [])]
                    text = " ".join(w for w in words if w).strip()
                    if text:
                        lines.append(text)

    raw_text = "\n".join(lines)
    structured = _parse_structured_receipt(lines, raw_text)
    suggested_amount = structured.get("amount", 0)

    return {
        "extractedText": lines,
        "rawText": raw_text,
        "suggestedAmount": suggested_amount,
        "structured": {k: v for k, v in structured.items() if v is not None and v != ""},
    }


def _extract_receipt_doctr(file_data: bytes, filename: str, content_type: str) -> dict:
    """Call DocTR API and parse receipt."""
    resp = requests.post(
        f"{DOCTR_API_URL}/ocr/",
        params={"det_arch": "db_resnet50", "reco_arch": "crnn_vgg16_bn"},
        files=[("files", (filename or "receipt.jpg", file_data, content_type or "image/jpeg"))],
        timeout=60,
    )
    resp.raise_for_status()
    ocr_result = resp.json()
    if not ocr_result:
        raise ValueError("DocTR returned no OCR result")
    return _extract_raw_text_from_doctr(ocr_result)


def _extract_receipt_tesseract(file_data: bytes) -> dict:
    """Fallback OCR using Tesseract when DocTR API is unavailable."""
    try:
        import pytesseract
        from PIL import Image
        import io
    except ImportError:
        raise RuntimeError("pytesseract and Pillow required for fallback OCR. Install: pip install pytesseract Pillow")
    img = Image.open(io.BytesIO(file_data))
    if img.mode != "RGB":
        img = img.convert("RGB")
    raw_text = pytesseract.image_to_string(img)
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    raw_text = "\n".join(lines)
    structured = _parse_structured_receipt(lines, raw_text)
    suggested_amount = structured.get("amount", 0)
    return {
        "extractedText": lines,
        "rawText": raw_text,
        "suggestedAmount": suggested_amount,
        "structured": {k: v for k, v in structured.items() if v is not None and v != ""},
    }


@app.route("/api/v1/scan-receipt", methods=["POST"])
def scan_receipt():
    load_model()

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    file_data = file.read()
    filename = file.filename or "receipt.jpg"
    content_type = file.content_type or "image/jpeg"

    # Try DocTR API first
    try:
        print("Extracting receipt info using DocTR OCR...")
        response_data = _extract_receipt_doctr(file_data, filename, content_type)
        return jsonify(response_data)
    except Exception as e:
        err_str = str(e).lower()
        is_connection_error = (
            isinstance(e, (requests.exceptions.ConnectionError, requests.exceptions.ConnectTimeout, requests.exceptions.RequestException))
            or "connection refused" in err_str
            or "max retries" in err_str
            or "connection" in err_str
        )
        if is_connection_error:
            print(f"DocTR OCR unavailable ({type(e).__name__}), trying Tesseract fallback...")
            try:
                response_data = _extract_receipt_tesseract(file_data)
                return jsonify(response_data)
            except Exception as fallback_err:
                print(f"Tesseract fallback failed: {fallback_err}")
                return jsonify({
                    "error": "Receipt OCR failed. DocTR is not running. Either: (1) Start DocTR: cd backend/doctr-main && uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir api. Or (2) Install Tesseract for fallback: sudo apt install tesseract-ocr && pip install pytesseract Pillow"
                }), 503
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to parse receipt: {str(e)}"}), 500


if __name__ == "__main__":
    load_model()
    load_anomaly_model()
    port = int(os.environ.get("PORT", "5000"))
    # 0.0.0.0 required for PaaS (Railway, Render, etc.); local dev works the same
    host = os.environ.get("FLASK_HOST", "0.0.0.0")
    app.run(host=host, port=port)

