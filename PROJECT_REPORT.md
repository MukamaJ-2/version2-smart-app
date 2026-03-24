# UniGuard Wallet — Project Report

## AI-Powered Personal Finance Management System

---

## 1. Executive Summary

**UniGuard Wallet** (formerly version2-smart-app) is an AI-powered personal finance management system designed to provide intelligent insights, automated categorization, and predictive financial planning. The system combines a modern React frontend with a Python Flask backend, integrating machine learning models for transaction categorization, anomaly detection, and receipt scanning via DocTR OCR.

The project delivers a comprehensive financial "command center" with features including a 3D Financial Nexus visualization, dynamic budget management (Budget Ports), AI receipt scanning, predictive analytics, goal forecasting, and an AI companion for natural-language financial guidance. Data persistence is handled through Supabase (PostgreSQL), with optional email notifications for anomaly alerts.

---

## 2. Project Overview

### 2.1 Purpose and Motivation

UniGuard Wallet addresses the need for intelligent, user-friendly personal finance management by:

- **Automating** transaction categorization and receipt data extraction to reduce manual data entry
- **Detecting** anomalous spending patterns and potential fraud using per-user, scale-invariant models
- **Forecasting** spending and goal achievement probabilities with Monte Carlo-style simulations
- **Visualizing** financial health through an interactive 3D nexus and dashboard widgets
- **Guiding** users with AI-powered budget allocation and insights via an AI companion

### 2.2 Target Users

- Individuals seeking to track and optimize personal spending
- Users who want automated receipt scanning and expense capture (especially in UGX and similar currencies)
- People planning financial goals with AI-assisted projections
- Families managing shared budgets (Family Finance module)
- Users who prefer local/offline-capable AI without mandatory cloud API keys

### 2.3 Key Design Principles

- **Hybrid AI**: Backend ML for categorization and anomaly; frontend logic-based models for forecasts and goals
- **User-relative anomaly detection**: Models compare spending to the user's own history, not global averages
- **Scale-invariant features**: `amount_ratio` (amount ÷ user category median) enables the same model to work for low and high spenders
- **No mandatory API keys**: DocTR and Tesseract OCR run locally; no paid cloud OCR required

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                                │
│  Shadcn UI • Tailwind CSS • Three.js (3D) • Recharts • Framer Motion         │
│  Supabase client • TanStack Query • React Router                              │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ REST (VITE_AI_API_URL)
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                         BACKEND (Python Flask)                                │
│  /api/v1/categorize  /api/v1/detect-anomaly  /api/v1/scan-receipt            │
│  TF-IDF+RF pipeline  Anomaly RF pipeline  Receipt parsing + categorizer      │
└───────┬──────────────────────────────┬───────────────────────────────────────┘
        │                              │ OCR (DOCTR_API_URL)
        │                              ▼
        │                     ┌────────────────────┐
        │                     │  DocTR OCR API     │
        │                     │  FastAPI :8000     │
        │                     │  db_resnet50 +     │
        │                     │  crnn_vgg16_bn     │
        │                     └─────────┬──────────┘
        │                              │ Fallback
        │                              ▼
        │                     ┌────────────────────┐
        │                     │ Tesseract OCR      │
        │                     │ (pytesseract)      │
        │                     └────────────────────┘
        │
        ▼                              ▼
┌──────────────────┐          ┌──────────────────┐
│  Supabase        │          │  Notify Server   │
│  Auth, DB, RLS   │          │  Node/tsx :5174   │
│  PostgreSQL      │          │  Nodemailer SMTP  │
└──────────────────┘          └──────────────────┘
```

### 3.2 Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, Vite 5, TypeScript, Tailwind CSS, Shadcn/Radix UI, Three.js (@react-three/fiber, drei), Recharts, Framer Motion, TanStack React Query, Supabase JS |
| **Backend** | Python 3, Flask, Flask-CORS |
| **OCR** | DocTR (primary: db_resnet50 + crnn_vgg16_bn), Tesseract (fallback) |
| **Database** | Supabase (PostgreSQL, Row Level Security, Auth) |
| **ML** | scikit-learn (TF-IDF, Random Forest, Isolation Forest, Decision Tree), joblib, pandas, numpy, NLTK |
| **Notifications** | Node.js (tsx), Nodemailer, Express |

### 3.3 Data Flow

1. **Transaction entry**: User adds transaction via natural language or receipt scan → frontend parses → backend categorizes → Supabase stores
2. **Anomaly check**: Frontend computes `amount_ratio` from user history → backend predicts → optional email alert
3. **Receipt scan**: User uploads image → backend calls DocTR (or Tesseract) → regex extraction → categorizer for line items → structured JSON returned

---

## 4. Core Features (Detailed)

### 4.1 Financial Nexus (Dashboard)

- **3D Visualization**: Interactive Three.js scene with nodes (Income, Budget Ports, Goals, Net Worth, Expenses) connected to a central core; orbit rings and data flow lines
- **Quick Stats**: Today's balance, health score, active goals, deadlines
- **Financial Wellness Score**: Composite metric derived from savings rate and spending patterns
- **Budget Port Preview**: Compact view of key budget pods with animated progress bars and health states
- **Recent Transactions**: Last transactions with icons, amounts, categories
- **Smart Predictions Feed**: AI-generated spending and goal insights
- **Anomaly Summary Card**: Overview of unusual transactions with severity
- **Time Machine**: Simulate future financial states based on current trends and allocations
- **Notifications Panel**: Budget alerts, goal reminders, weekly reports
- **Spending Alerts Card**: Proactive spending warnings

### 4.2 Transaction Center

- **Natural Language Quick Entry**: Examples: "spent 450 on coffee today", "received 45k freelance", "bought fuel 50k"
- **AI Categorization**: Backend TF-IDF + Random Forest model; 19 categories; returns top category, confidence, alternatives
- **Anomaly Detection**: Backend RF model using `amount_ratio`; flags unusual transactions; optional email alerts with actionable advice
- **Inline AI Recategorization**: Edit dialog with "AI Recategorize" to suggest better category
- **Search, Filter, Group by Date**: Full transaction management with multi-select and bulk delete
- **Receipt Scanning**: Upload receipt images; OCR extracts text; structured fields (amount, date, merchant, etc.) and item categorization

### 4.3 Budget Ports (Flux Pods)

- **Dynamic Budget Envelopes**: Allocated amount, spent, remaining, velocity (days until depletion)
- **Health States**: Healthy, warning, critical based on spending rate
- **AI Spending Forecasts**: Predicted monthly spend, days until depletion, trend (stable/rising/falling)
- **AI New Pod Suggestions**: Allocation recommendations when creating pods, with reasoning
- **Expandable Sub-categories**: Hierarchical budget structure (e.g., Essentials → Groceries, Utilities, Housing)
- **Reallocate and Configure**: Pod-level actions for budget adjustments

### 4.4 Goals & Orbits

- **Goal Tracking**: Target amount, current amount, monthly contribution, deadline, status
- **AI Goal Predictions**: Completion probability, months to complete, success likelihood (very-high/high/medium/low)
- **Monte Carlo-style Simulation**: Seeded RNG for repeatable probabilistic projections
- **Orbit-style UI**: Ring charts, progress visualization, time to deadline

### 4.5 AI Receipt Scanner

- **DocTR OCR**: High-quality document text recognition; architectures: db_resnet50 (detection), crnn_vgg16_bn (recognition)
- **Tesseract Fallback**: When DocTR API is unavailable; requires `tesseract-ocr` and `pytesseract`
- **Structured Extraction** (regex-based): amount, date, time, merchant, receipt number, transaction type, outlet, name, card masked, charge, balance
- **Item Categorization**: Each extracted line passed to transaction categorizer for category suggestion
- **Supported Formats**: JPEG, PNG; multipart form upload

### 4.6 AI Companion

- **Chat Interface**: Natural language queries about finances
- **Quick Actions**: Spending Analysis, Goal Progress, Budget Tips, Financial Health
- **Voice Input**: Optional browser speech recognition
- **Context-aware Responses**: Uses `getDashboardInsights` (savings rate, totals, top categories)
- **Intent Recognition**: Patterns for spending, budget, goals, health; maps to precomputed insights

### 4.7 Additional Modules

- **Reports**: Multi-tab analytics (Overview, Income, Expenses, Categories, Weekly); Recharts; CSV export
- **Savings Vault**: Locked savings with unlock date, interest rate, status (locked/unlocked/broken)
- **Family Finance**: Shared family budgeting
- **Investment Tracking**: Portfolio and holdings management
- **Achievements & Leaderboard**: Gamification (First Steps, Goal Getter, Savings Master, etc.)
- **Onboarding Survey**: Life stage, savings goals, alert preferences; influences goal suggestions and alerts

---

## 5. Machine Learning Pipeline (Detailed)

### 5.1 Transaction Categorizer

- **Model**: TF-IDF vectorization + Random Forest classifier
- **Training Data**: Synthetic generation; 19 categories with keyword templates
- **Categories**: Food, Transport, Housing, Utilities, Entertainment, Shopping, Healthcare, Education, Insurance, Personal Care, Gifts & Donations, Banking & Finance, Travel, Pets, Business, Subscriptions, Taxes, Legal & Fees, Kids & Family, Other/Unknown
- **Templates**: e.g. `"{keyword}"`, `"spent {price} on {keyword}"`, `"paid {price} for {keyword}"`
- **Preprocessing**: Lowercase, remove numbers (e.g. 4k, 500), stopwords (NLTK), special characters; letters and spaces only
- **Noise**: 3% label noise; 200 "Other/Unknown" outliers (e.g. "transfer to john", "atm withdrawal")
- **Output**: Category, confidence (0–1), top-3 alternatives; low confidence (<0.30) → "Other/Unknown"
- **Artifact**: `ml_pipeline/transaction_rf_pipeline.pkl` (or `backend/training/models/transaction_categorizer/`)

### 5.2 Anomaly Detector

- **Model**: Random Forest (primary), Decision Tree, Isolation Forest (alternative)
- **Features**: `transaction_type`, `category`, `amount_ratio`, `payment_mode`
- **amount_ratio**: `amount / user_category_median` — scale-invariant; works for 50k or 5M UGX users
- **Labels**: Per-user; top 3% or bottom 3% by amount_ratio per (user, category, type)
- **Preprocessing**: RobustScaler on amount_ratio; OneHotEncoder on categoricals
- **Output**: `isAnomaly`, `anomalyScore`, `amountRatio`
- **Integration**: Email alerts for anomalous transactions with recommended actions (confirm, contact bank, set soft limit)
- **Artifact**: `backend/training/models/anomaly_detector/anomaly_rf_pipeline.pkl` or `ml_pipeline/anomaly_rf_pipeline.pkl`

### 5.3 Receipt Parsing

- **OCR**: DocTR `/ocr/` endpoint or Tesseract `image_to_string`
- **Regex Extraction**: Amount (largest number or "Amount:" pattern), date (multiple formats), time, merchant (line with bank/store/outlet), receipt number, transaction type, outlet, name, card masked, charge, balance
- **Item Categorization**: Each line from OCR passed to categorizer; confidence threshold applied

---

## 6. Backend API (Detailed)

### 6.1 Endpoints

| Endpoint | Method | Request Body | Response |
|----------|--------|---------------|----------|
| `/api/v1/categorize` | POST | `{ "text": "spent 4k on fuel" }` | `{ "category", "confidence", "alternatives" }` |
| `/api/v1/detect-anomaly` | POST | `{ "transaction_type", "category", "amount_ratio", "payment_mode", "notifyEmail" }` | `{ "isAnomaly", "anomalyScore", "amountRatio" }` |
| `/api/v1/scan-receipt` | POST | multipart `file` | `{ "extractedText", "rawText", "suggestedAmount", "structured" }` |
| `/api/v1/notify-test` | POST | `{ "email" }` | `{ "ok", "sentTo" }` |
| `/health` | GET | — | `{ "status", "model_loaded", "anomaly_model_loaded", "doctr_api_url" }` |

### 6.2 Categorize Logic

- Cleans input with `clean_text` (lowercase, remove numbers, stopwords, non-alpha)
- Empty cleaned text → `"Other/Unknown"`, confidence 0
- `predict_proba` → top 3 categories; confidence < 0.30 → "Other/Unknown"

### 6.3 Anomaly Logic

- Builds DataFrame with `transaction_type`, `category`, `amount_ratio`, `payment_mode`
- Pipeline predicts; 1 = anomaly
- If anomaly and `notifyEmail`: sends structured email with ratio, category, recommended actions

### 6.4 Receipt Scan Logic

- Tries DocTR first; on connection error, falls back to Tesseract
- Parses OCR output into lines; regex extracts structured fields
- Returns `extractedText` (lines), `rawText`, `suggestedAmount`, `structured` (dict of extracted fields)

---

## 7. Database Schema (Supabase)

### 7.1 Key Tables

- **profiles**: User profile, onboarding answers
- **savings_vaults**: id, user_id, name, amount, lock_days, unlock_date, status (locked/unlocked/broken), interest_rate
- **flux_pods** (Budget Ports): Allocations, spending, hierarchy
- **transactions**: User transactions with category, amount, type, date
- **goals**: Target, current, contribution, deadline

### 7.2 Row Level Security

- Policies enforce `auth.uid() = user_id` for user-scoped tables
- Indexes on `user_id` for fast lookups

---

## 8. Development & Deployment

### 8.1 Services

| Service | Command | URL |
|---------|---------|-----|
| Frontend | `npm run dev:frontend` | http://localhost:8080 |
| Backend | `npm run dev:backend` | http://127.0.0.1:5000 |
| Backend (alt) | `npm run dev:backend:5001` | http://127.0.0.1:5001 |
| DocTR OCR | `npm run dev:doctr` | http://127.0.0.1:8000 |
| Notify | `npm run dev:notify` | http://localhost:5174 |

### 8.2 Environment Variables

| Variable | Default | Description |
|----------|---------|--------------|
| `VITE_AI_API_URL` | — | Backend API URL (e.g. http://127.0.0.1:5000) |
| `VITE_SUPABASE_URL` | — | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | — | Supabase anon key |
| `DOCTR_API_URL` | http://127.0.0.1:8000 | DocTR OCR service URL |
| `NOTIFY_URL` | http://127.0.0.1:5174/api/notifications | Notification service URL |
| `PORT` | 5000 | Backend port |
| `SMTP_*` | — | Email configuration for alerts |

### 8.3 DocTR Setup

```bash
cd backend/doctr-main
pip install -e .
pip install fastapi uvicorn python-multipart
uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir api
```

### 8.4 Tesseract Fallback

```bash
sudo apt install tesseract-ocr
pip install pytesseract Pillow
```

---

## 9. Repository Structure

```
smart-personal-finance/
├── frontend/                 # React app (Vite, TypeScript)
│   ├── src/
│   │   ├── components/      # UI, nexus, dashboard, modals
│   │   ├── lib/ai/          # ai-service, models, companion, training-data
│   │   ├── pages/           # Auth, Dashboard, Transactions, Goals, etc.
│   │   └── main.tsx, App.tsx
│   └── package.json
├── backend/
│   ├── app.py               # Flask API (categorize, anomaly, scan-receipt)
│   ├── doctr-main/          # DocTR library + FastAPI OCR
│   │   ├── api/             # FastAPI app, routes (ocr, detection, kie, recognition)
│   │   └── doctr/           # doctr package
│   ├── server/              # Notify server (Node/tsx)
│   └── requirements.txt
├── ml_pipeline/
│   ├── train_transaction_categorizer.ipynb
│   ├── model.ipynb          # Anomaly model training
│   ├── transaction_rf_pipeline.pkl
│   ├── anomaly_rf_pipeline.pkl
│   └── data/
├── supabase/
│   └── migrations/          # SQL migrations (profiles, savings_vaults, flux_pods)
├── docs/
│   └── archive/             # Design specs, model assessments
├── scripts/
│   └── generate_report_pdf.py
└── package.json             # Root scripts (dev:frontend, dev:backend, etc.)
```

---

## 10. Unique Differentiators

1. **Hybrid AI**: Backend ML (categorization, anomaly) + frontend logic-based models (forecasts, goals, companion)
2. **3D Financial Nexus**: Uncommon Three.js visualization of financial components
3. **Flux Pods / Budget Ports**: Velocity-based budget envelopes with AI allocation and forecasts
4. **Monte Carlo Goal Predictions**: Probabilistic success estimation with seeded RNG
5. **Receipt OCR**: DocTR + Tesseract; no external API keys required
6. **Inline AI**: Categorization and anomaly detection embedded in transaction workflows
7. **Per-user anomaly detection**: `amount_ratio` normalizes by user's category median; works across spending levels
8. **Scale-invariant model**: Same anomaly model for UGX, USD, or any currency

---

## 11. Limitations and Future Work

- **Anomaly model**: Requires `amount_ratio` from frontend; caller must compute from user history
- **Payment mode**: Often "Unknown" if not captured; model handles it
- **OCR quality**: Depends on image quality; Tesseract fallback may be less accurate
- **Per-user retraining**: Anomaly model is global; per-user fine-tuning could improve precision

---

## 12. Conclusion

UniGuard Wallet delivers a full-featured, AI-enhanced personal finance platform with a modern stack, robust ML pipeline, and distinctive UX. The system is designed for extensibility—the `aiService` abstraction allows swapping simulated models for real backend ML or cloud APIs without major UI changes. The use of `amount_ratio` and per-user normalization makes anomaly detection practical across diverse user bases and currencies.

---

*Report generated for UniGuard Wallet (smart-personal-finance).*
