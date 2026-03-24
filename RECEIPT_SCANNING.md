# Receipt Scanning Setup

Receipt scanning uses **DocTR** (free, open-source OCR) with **Tesseract** as a fallback. No API keys required.

## Quick Start

### Option A: DocTR API (best quality)

1. **Start DocTR API** (Terminal 1):
   ```bash
   cd backend/doctr-main
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir api
   ```

2. **Start backend** (Terminal 2):
   ```bash
   cd backend && python app.py
   ```

### Option B: Tesseract fallback (no DocTR needed)

If DocTR is not running, the backend automatically falls back to **Tesseract OCR**.

1. **Install Tesseract** (system):
   ```bash
   # Ubuntu/Debian
   sudo apt install tesseract-ocr
   ```

2. **Install Python deps**:
   ```bash
   pip install pytesseract Pillow
   ```

3. Start the backend and use receipt scanning. It will use Tesseract when DocTR is unavailable.

## Environment Variables

| Variable        | Default                  | Description      |
|-----------------|--------------------------|------------------|
| `DOCTR_API_URL` | `http://127.0.0.1:8000`  | DocTR API base URL |

## DocTR API (optional)

DocTR runs as a separate FastAPI service for higher-quality OCR. To install:

```bash
cd backend/doctr-main
pip install -e .
pip install fastapi uvicorn python-multipart
```

