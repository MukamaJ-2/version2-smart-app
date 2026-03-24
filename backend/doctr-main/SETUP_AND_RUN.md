# docTR API – Setup and Run

## Correct setup (from project root)

Run these commands **one at a time** from the **project root** (`doctr-main/`):

```bash
# 1. Go to project root (parent of api/)
cd /home/mukama/Pictures/doctr-main

# 2. Activate the main venv (has docTR installed)
source .venv/bin/activate

# 3. Install docTR if not already installed
pip install -e .

# 4. Install API dependencies
pip install fastapi uvicorn python-multipart

# 5. Run the API (from project root, specify app directory)
uvicorn app.main:app --host 0.0.0.0 --port=8000 --app-dir api
```

## If port 8000 is already in use

**Option A – Use another port:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port=8002 --app-dir api
```
Then open http://127.0.0.1:8002

**Option B – Free port 8000:**
```bash
# Find what's using port 8000
lsof -i :8000

# Kill it (replace PID with the number from lsof)
kill <PID>
```

## If you're in api/ and created a venv there

The `api/` folder has its own `pyproject.toml` for the API only – it does **not** include docTR. Use the venv from the **project root** instead:

```bash
cd /home/mukama/Pictures/doctr-main
source .venv/bin/activate
# Don't use api/.venv – it doesn't have docTR
```

## Quick one-liner (after initial setup)

```bash
cd /home/mukama/Pictures/doctr-main && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port=8000 --app-dir api
```
