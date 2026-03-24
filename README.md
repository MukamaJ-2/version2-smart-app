# version2-smart-app (UniGuard Wallet)

UniGuard Wallet is an AI-powered personal finance management system designed to provide intelligent insights, automated categorization, and predictive financial planning.

## 🚀 Features

- **Financial Nexus**: 3D visualization of your financial health and AI-powered insights.
- **Budget Ports**: Dynamic budget management with AI allocation suggestions.
- **AI Receipt Scanner**: Extract metadata and itemized expenses from receipts using DocTR OCR.
- **Predictive Analytics**: Forecast spending, predict goal achievement, and detect anomalies in transactions.
- **Time Machine**: Simulate future financial states based on current trends and allocations.

## 🏗️ Architecture

- **Frontend**: React (Vite) + Tailwind CSS + Shadcn UI.
- **Backend AI**: Python (Flask) service that calls the DocTR OCR API for receipt parsing.
- **Local AI**: Logic-based models integrated directly into the frontend for real-time predictions.
- **ML Pipeline**: Jupyter notebooks and scripts for training transaction categorizers and vision models.

## 📁 Repository Structure

- `frontend/`: React application and UI components.
- `backend/`: Python Flask API for categorization, receipt scan, anomaly detection.
- `ml_pipeline/`: Data generation, training notebooks, and model artifacts.
- `docs/archive/`: Historical documentation and design specs.

## 🛠️ Getting Started

### Development Services (run each in a separate terminal)

| Service | Command | Path | URL |
|---------|---------|------|-----|
| 1. Frontend | `npm run dev:frontend` | `frontend/` | http://localhost:8080 |
| 2. Backend | `npm run dev:backend` | `backend/` (Flask app.py) | http://127.0.0.1:5000 |
| 3. Backend (alt port) | `npm run dev:backend:5001` | `backend/` | http://127.0.0.1:5001 |
| 4. Notify | `npm run dev:notify` | `backend/server/notify.ts` | http://localhost:5174 |
| 5. DocTR OCR | `npm run dev:doctr` | `backend/doctr-main` (uvicorn api) | http://127.0.0.1:8000 |

**Environment:** Set `VITE_AI_API_URL` in `.env` to match your backend port (e.g. `http://127.0.0.1:5000` or `http://127.0.0.1:5001`).

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
source .venv/bin/activate
cd backend
python app.py
```

## 📝 License
Proprietary
