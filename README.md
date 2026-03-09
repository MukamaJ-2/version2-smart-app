# version2-smart-app (UniGuard Wallet)

UniGuard Wallet is an AI-powered personal finance management system designed to provide intelligent insights, automated categorization, and predictive financial planning.

## 🚀 Features

- **Financial Nexus**: 3D visualization of your financial health and AI-powered insights.
- **Flux Pods**: Dynamic budget management with AI allocation suggestions.
- **AI Receipt Scanner**: Extract metadata and itemized expenses from receipts using the Donut model.
- **Predictive Analytics**: Forecast spending, predict goal achievement, and detect anomalies in transactions.
- **Time Machine**: Simulate future financial states based on current trends and allocations.

## 🏗️ Architecture

- **Frontend**: React (Vite) + Tailwind CSS + Shadcn UI.
- **Backend AI**: Python (Flask) service running the Donut model for receipt parsing.
- **Local AI**: Logic-based models integrated directly into the frontend for real-time predictions.
- **ML Pipeline**: Jupyter notebooks and scripts for training transaction categorizers and vision models.

## 📁 Repository Structure

- `frontend/`: React application and UI components.
- `backend-ai/`: Python Flask API for OCR and receipt parsing.
- `ml_pipeline/`: Data generation, training notebooks, and model artifacts.
- `docs/archive/`: Historical documentation and design specs.

## 🛠️ Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend AI
```bash
cd backend-ai
source venv/bin/bin/activate
pip install -r requirements.txt
python app.py
```

## 📝 License
Proprietary
