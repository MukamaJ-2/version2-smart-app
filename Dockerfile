# API service: build from monorepo root so backend/app.py can resolve ../ml_pipeline (repo root).
# Railway: create a service, set builder to Dockerfile, root directory = repo root (default).

FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
# Do not COPY ml_pipeline/ — empty dirs or .dockerignore can make COPY fail on Railway.
# Runtime loads .pkl from backend/training or ml_pipeline when present; empty ml_pipeline is OK.
RUN mkdir -p ml_pipeline

ENV PYTHONUNBUFFERED=1
EXPOSE 5000

# Railway sets PORT; shell form expands ${PORT}
CMD ["sh", "-c", "exec gunicorn --chdir backend app:app --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 4 --timeout 120"]
