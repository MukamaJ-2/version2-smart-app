# UniGuard Wallet — Full Documentation

This document covers the complete project documentation, system architecture, and technologies used at each stage of the application.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technologies by Stage](#3-technologies-by-stage)
4. [Setup and Run](#4-setup-and-run)
5. [Deployment](#5-deployment)

---

## 1. Project Overview

**UniGuard Wallet** is a personal finance web application that helps users track transactions, manage budgets (Flux Pods), set goals, view reports, and get AI-powered insights. It includes:

- **Authentication** — Email/password via Supabase Auth
- **Onboarding** — First-time survey to personalize budget and overspend behavior
- **Dashboard** — Quick stats, recent transactions, notifications, Financial Nexus
- **Transactions** — List and manage income/expenses with AI categorization
- **Flux Pods** — Budget buckets with allocation and AI suggestions
- **Goals** — Savings goals with AI-based achievement predictions
- **AI Companion** — Chat and insights powered by five trained models
- **Reports** — Spending and budget visualizations
- **Achievements** — Gamification
- **Settings** — Profile and preferences
- **Notifications** — In-app and optional email (anomaly alerts) via a separate Node server

The app is a **single frontend** (React SPA) that talks to **Supabase** (auth + database) and optionally to a **notification server** (Node/Express) for email. AI models are **trained offline** in Python and their **artifacts** (weights/rules) are consumed in the browser via TypeScript.

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    React SPA (Vite + TypeScript)                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │  │
│  │  │   Pages     │ │  Components │ │  AI Service │ │  Supabase Client │  │  │
│  │  │ (Dashboard, │ │ (UI, layout,│ │ (5 models)  │ │  (auth, DB)     │  │  │
│  │  │ Transactions│ │  nexus…)    │ │ + artifacts │ │                 │  │  │
│  │  │ Goals, etc.)│ │             │ │             │ │                 │  │  │
│  │  └─────────────┘ └─────────────┘ └──────┬──────┘ └────────┬────────┘  │  │
│  └─────────────────────────────────────────│─────────────────│──────────┘  │
└─────────────────────────────────────────────│─────────────────│─────────────┘
                                              │                 │
                    ┌─────────────────────────┘                 └─────────────────────────┐
                    │                                                                       │
                    ▼                                                                       ▼
┌───────────────────────────────────┐                    ┌─────────────────────────────────────┐
│  Notification Server (optional)   │                    │           Supabase                   │
│  Node.js + Express                │                    │  • Auth (email/password)             │
│  • POST /api/notifications        │                    │  • PostgreSQL (profiles, etc.)       │
│  • Nodemailer (SMTP)              │                    │  • Row Level Security (RLS)          │
└───────────────────────────────────┘                    └─────────────────────────────────────┘
                    │
                    ▼
            SMTP Provider (email)
```

### 2.2 Repository Structure

```
├── frontend/                    # React SPA — main application
│   ├── src/
│   │   ├── components/          # Reusable UI and feature components
│   │   │   ├── ai/              # AI Companion panel
│   │   │   ├── auth/            # RequireOnboarding guard
│   │   │   ├── dashboard/       # QuickStats, RecentTransactions, NotificationsPanel, etc.
│   │   │   ├── layout/          # AppLayout, Sidebar
│   │   │   ├── nexus/           # Financial Nexus
│   │   │   └── ui/              # shadcn/ui primitives
│   │   ├── hooks/               # use-mobile, use-toast, use-toasts
│   │   ├── lib/                 # Core logic and integrations
│   │   │   ├── ai/              # AI service, models, training-data, train.ts
│   │   │   │   └── models/
│   │   │   │       └── artifacts/  # Trained model outputs (TS)
│   │   │   ├── auth/            # Email auth helpers
│   │   │   ├── onboarding.ts
│   │   │   ├── notifications.ts
│   │   │   ├── supabase.ts
│   │   │   └── utils.ts
│   │   ├── pages/               # Route-level pages
│   │   └── main.tsx, App.tsx, index.css
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.*.json
│
├── backend/
│   ├── training/                # Python ML training pipeline
│   │   ├── train_models.py      # Entry: train all or one model
│   │   ├── pipeline.py          # Shared pipeline logic
│   │   ├── report_visuals.py    # Training reports
│   │   ├── data/                # Dataset docs, manifests
│   │   └── models/              # Per-model datasets.json metadata
│   ├── server/
│   │   └── notify.js            # Express app: email notifications
│   └── supabase/
│       └── migrations/          # SQL migrations (profiles, onboarding)
│
├── README.md
├── DOCUMENTATION.md             # This file
├── railway.toml                 # Deployment (e.g. Railway)
└── package.json                 # Root (if any)
```

### 2.3 Data Flow

| Flow | Description |
|------|-------------|
| **Auth** | User signs in/up → Supabase Auth → session; profile read/write via `profiles` table and RLS. |
| **Onboarding** | Survey answers → stored in `profiles.onboarding_answers` and `onboarding_completed_at`; RequireOnboarding guards app routes. |
| **Transactions / Budget / Goals** | UI state and any persisted data go through Supabase client; AI runs in-browser using `AIService` and artifact files. |
| **AI predictions** | Frontend loads transactions (and income) → passes to `AIService` → each model uses its artifact (e.g. `transaction-categorizer.ts`, `spending-forecaster.ts`) → results rendered in UI. |
| **Notifications** | Anomaly events (or other triggers) → frontend can call Notification Server `POST /api/notifications` with `to`, `subject`, `text` → server sends email via SMTP. In-app notifications are stored in localStorage keyed by user. |
| **Training** | Python reads datasets (e.g. Kaggle), runs pipeline → writes TypeScript artifact files into `frontend/src/lib/ai/models/artifacts/`. No runtime dependency on Python. |

### 2.4 Security Model

- **Supabase**: Auth and database; RLS ensures users only access their own `profiles` (and any other tables you add with similar policies).
- **Frontend**: Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public anon key). Sensitive operations must be enforced by Supabase (RLS, Auth).
- **Notification server**: Protected by deployment network; no auth in the snippet (can be added via API key or auth header).
- **AI**: Runs entirely in the browser; no transaction data sent to external AI APIs unless you add such a feature.

---

## 3. Technologies by Stage

### 3.1 Frontend (User interface and in-browser logic)

| Purpose | Technology |
|--------|------------|
| **Runtime / bundling** | **Vite** (v5) — dev server, HMR, production build |
| **Language** | **TypeScript** (strict) |
| **Framework** | **React** 18 |
| **Build plugin** | **@vitejs/plugin-react-swc** — React + SWC for fast compile |
| **Routing** | **react-router-dom** v6 |
| **Server state / caching** | **TanStack React Query** v5 |
| **Styling** | **Tailwind CSS** v3, **tailwindcss-animate** |
| **Component primitives** | **Radix UI** (accordion, dialog, dropdown, tabs, etc.) |
| **Component system** | **shadcn/ui** (Radix + Tailwind + CVA), **class-variance-authority**, **clsx**, **tailwind-merge** |
| **Icons** | **lucide-react** |
| **Forms** | **react-hook-form** |
| **Charts** | **recharts** |
| **Date handling** | **date-fns**, **react-day-picker** |
| **3D / visuals** | **Three.js**, **@react-three/fiber**, **@react-three/drei** (e.g. Financial Nexus) |
| **Motion** | **framer-motion** |
| **Toasts** | **sonner**, Radix **Toast** |
| **Other UI** | **cmdk** (command palette), **vaul** (drawer), **embla-carousel-react**, **input-otp**, **react-resizable-panels** |
| **Backend client** | **@supabase/supabase-js** — auth and database |
| **Environment** | Vite `import.meta.env` (e.g. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); `envDir` points to repo root |

### 3.2 AI / ML (Training and inference)

| Stage | Technology |
|--------|------------|
| **Training (offline)** | **Python 3** — `train_models.py`, `pipeline.py` |
| **Data / numerics** | **pandas**, **numpy** — load CSV, aggregate, feature engineering |
| **Dataset sources** | Kaggle-style paths (e.g. `kagglehub` or local); manifest in `data/` |
| **Output** | TypeScript files (weights, rules, metadata) written under `frontend/src/lib/ai/models/artifacts/` |
| **Inference (runtime)** | **TypeScript** in the browser — no Python at runtime |
| **Orchestration** | **AIService** in `frontend/src/lib/ai/ai-service.ts` — single entry for categorization, forecasting, budget allocation, goal prediction, anomaly detection |
| **Models** | Transaction categorizer, spending forecaster, budget allocator, goal predictor, anomaly detector (see `AI_MODELS_COMPLETE_GUIDE.md`) |

### 3.3 Backend — Notification server

| Purpose | Technology |
|--------|------------|
| **Runtime** | **Node.js** |
| **Framework** | **Express** v5 |
| **Email** | **Nodemailer** — SMTP |
| **Config** | **dotenv** — loads `../../.env.local` (e.g. `SMTP_*`, `NOTIFY_PORT`) |
| **Endpoint** | `POST /api/notifications` — body: `{ to, subject, text }` |

### 3.4 Database and auth

| Purpose | Technology |
|--------|------------|
| **Service** | **Supabase** (hosted) |
| **Auth** | Supabase Auth (email/password) |
| **Database** | **PostgreSQL** (Supabase) |
| **Schema / migrations** | SQL in `backend/supabase/migrations/` (e.g. `profiles`, onboarding columns, RLS) |
| **Client** | **@supabase/supabase-js** in the frontend |

### 3.5 Deployment and DevOps

| Purpose | Technology |
|--------|------------|
| **App host** | **Railway** (or similar) — `railway.toml` uses Nixpacks, npm |
| **Build** | `npm run build` in `frontend` (e.g. `tsc && vite build`) |
| **Env at build** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — required for Supabase in production |
| **Notification server** | Separate process/service; run `node backend/server/notify.js` (or `npm run notify:server` from frontend dir) with SMTP env vars |

---

## 4. Setup and Run

### 4.1 Prerequisites

- **Node.js** and **npm** (for frontend and notification server)
- **Python 3** with **pandas**, **numpy** (for training only)
- **Supabase** project (URL + anon key)

### 4.2 Frontend

```bash
cd frontend
npm install
# Optional: create ../.env.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev
```

- App: typically **http://localhost:8080** (see `vite.config.ts`).

### 4.3 Notification server (optional)

```bash
# From repo root, ensure .env.local has SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM, etc.
cd frontend
npm run notify:server
# Or: node ../backend/server/notify.js
```

- Listens on port **5174** (or `NOTIFY_PORT`).

### 4.4 Database

- Apply migrations in `backend/supabase/migrations/` via Supabase Dashboard SQL Editor or Supabase CLI so `profiles` (and onboarding columns) exist and RLS is enabled.

### 4.5 Training (optional)

```bash
cd backend/training
pip install -r requirements.txt   # if present
python train_models.py --model all
# Or: --model transaction_categorizer | spending_forecaster | budget_allocator | goal_predictor | anomaly_detector
```

- Artifacts are written to `frontend/src/lib/ai/models/artifacts/`.

---

## 5. Deployment

- **Frontend**: Deploy the `frontend` build (e.g. on Railway). Set build env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Notification server**: Deploy as a separate service; set SMTP and `NOTIFY_PORT` in that service’s environment.
- **Supabase**: Use the same project (or a prod project) and run migrations there.
- **Custom domain**: Configure in the host (e.g. Lovable/Share → Publish, or host’s domain settings).

---

## Related docs

- **README.md** — Quick start, Lovable, deploy notes.
- **AI_MODELS_COMPLETE_GUIDE.md** — How each AI model is trained and used.
- **backend/README.md** — Backend layout, training and notify commands, migrations.
- **ONBOARDING_SURVEY_SPEC.md** — Onboarding survey specification.

This file is the single place for **full documentation**, **architecture**, and **technologies by stage** for UniGuard Wallet.
