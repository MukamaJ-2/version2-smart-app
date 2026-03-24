# Export docTR to Another System

Use this guide to move your docTR setup to another machine (e.g. a scanning workstation).

---

## What to Copy

Copy the **entire** `doctr-main` folder. You can **exclude** the `.venv` folder to save space (~2–3 GB) and recreate it on the target system.

### Option A: Copy everything (simplest)

```bash
# From your current machine
cp -r /home/mukama/Pictures/doctr-main /path/to/usb/  # or scp, rsync, etc.
```

### Option B: Copy without venv (smaller, recommended)

```bash
rsync -av --exclude='.venv' /home/mukama/Pictures/doctr-main /path/to/destination/
# or
tar --exclude='.venv' -czvf doctr-export.tar.gz -C /home/mukama/Pictures doctr-main
```

---

## On the Target System

### 1. Prerequisites

- **Python 3.10 or 3.11** (3.12 also works)
- **Internet** (for first-time dependency download)
- **~3 GB disk space** (for venv + PyTorch + models)

### 2. Setup (first time only)

```bash
# 1. Go to the project folder
cd doctr-main

# 2. Create virtual environment
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate

# 3. Install docTR and dependencies (downloads ~1–2 GB, needs internet)
pip install -e .

# 4. Install API dependencies
pip install fastapi uvicorn python-multipart

# 5. Run the API
./run_api.sh
# or: uvicorn app.main:app --host 0.0.0.0 --port=8000 --app-dir api
```

### 3. Use it

- Open **http://localhost:8000** in a browser (or **http://\<machine-ip\>:8000** from another device)
- Upload an image or PDF
- Click **Run OCR**
- Get extracted text

---

## Quick Reference

| Step | Command |
|------|---------|
| Activate venv | `source .venv/bin/activate` |
| Run API | `./run_api.sh` or `uvicorn app.main:app --host 0.0.0.0 --port=8000 --app-dir api` |
| Different port | `uvicorn app.main:app --host 0.0.0.0 --port=8002 --app-dir api` |

---

## Notes

- **First run** downloads pretrained models (~100–200 MB) – internet required once
- **GPU**: If the target has an NVIDIA GPU, PyTorch will use it automatically for faster OCR
- **Firewall**: Allow port 8000 if you want to access from other devices on the network
