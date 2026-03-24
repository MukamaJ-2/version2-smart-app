#!/bin/bash
# Run docTR API - use from project root (doctr-main/)
cd "$(dirname "$0")"
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port=8000 --app-dir api
