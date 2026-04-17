# UNIGUARD EXPENSE TRACKER: AN AI-ASSISTED WEB APPLICATION FOR PERSONAL EXPENSE TRACKING, BUDGETING, AND FINANCIAL INSIGHTS

## Project Team Members
- Mukama Joseph - S23B23/036 - 0762916855
- Odongkara Oscar - S23B23/085 - 0771301999
- Namaganda W. Precious - S23B23/092 - 0756989388

A project report submitted to the Faculty of Engineering, Design and Technology in partial fulfillment of the requirements for the award of the Degree of Bachelor of Science in Computer Science of Uganda Christian University.

April, 2026

---

## APPROVAL
This report is hereby submitted for examination with the consent and endorsement of our supervisor listed below.

- Supervisor Name: [Supervisor Name]
- Email: [email@ucu.ac.ug]
- Contact: [phone]
- Department: Department of Computing
- Faculty: Faculty of Engineering, Design and Technology
- Date: [DD/MM/YYYY]
- Signature: ____________________

## DECLARATION
We, Mukama Joseph (S23B23/036), Odongkara Oscar (S23B23/085), and Namaganda W. Precious (S23B23/092), solemnly affirm that this report is a result of our original work and has not been submitted to any other institution for an academic qualification.

## ACKNOWLEDGEMENT
We thank the Almighty God for providing life, strength, and wisdom throughout this project. We sincerely appreciate our supervisor for guidance, technical feedback, and encouragement from project proposal to final documentation. We are grateful to classmates and friends who gave useful suggestions during testing and demonstrations. We also thank our families for their patience, prayers, and moral support during system development and report writing.

## ABSTRACT
UniGuard Expense Tracker is a full-stack, AI-assisted web application designed to support practical personal financial management, especially for students and early-career professionals. The platform combines daily transaction tracking, smart categorization, budget planning, goal monitoring, receipt capture, anomaly detection, and analytics dashboards in a single system. The project responds to common financial pain points such as poor spending visibility, delayed budgeting decisions, and manual data entry.

The application uses a React and TypeScript frontend, Supabase authentication and storage services, and a Flask backend that serves trained machine-learning models for prediction and inference tasks. The AI pipeline includes supervised transaction categorization and anomaly detection models trained from structured and synthetic transaction data in `ml_pipeline/data`. OCR-assisted receipt processing is integrated to reduce manual input and improve data completeness.

System validation demonstrates that the tool improves transaction organization, reduces manual categorization workload, and gives users actionable insights through alerts and trend analysis. UniGuard therefore provides an academically grounded and practically deployable approach to AI-enhanced personal finance software.

## LIST OF FIGURES
1. High-level system architecture.
2. End-to-end data flow (user input to insight output).
3. Dashboard interface with key metrics.
4. Transactions module with categorization and anomaly tags.
5. Budget module (Flux Pods) with progress indicators.
6. Savings goals and vault progress views.
7. Reports and chart analytics interface.
8. API communication sequence diagram.
9. Receipt OCR pipeline and post-processing flow.
10. Simplified database entity relationship model.
11. Model training and artifact deployment pipeline.
12. Evaluation workflow and performance summary.

## TABLE OF CONTENTS
1. CHAPTER ONE: INTRODUCTION
2. CHAPTER TWO: LITERATURE REVIEW
3. CHAPTER THREE: METHODOLOGY
4. CHAPTER FOUR: SYSTEM DESIGN AND IMPLEMENTATION
5. CHAPTER FIVE: RESULTS, DISCUSSION, AND EVALUATION
6. CHAPTER SIX: CONCLUSION AND RECOMMENDATIONS
7. REFERENCES
8. APPENDICES

---

## CHAPTER ONE: INTRODUCTION

### 1.1 Background of the Study
Financial planning is a critical life skill, yet many people still manage money informally and inconsistently. Traditional bookkeeping methods, such as notebooks and spreadsheets, can be difficult to maintain over long periods. Mobile money, digital payments, and increasing online purchases have also increased transaction volume, making manual tracking more burdensome.

Personal finance applications have attempted to address this challenge, but many are either too generic, costly, or poorly adapted to local spending patterns. In Uganda, for example, transaction descriptions often include local terms, short merchant names, and informal context. These patterns can reduce accuracy in systems trained only on generic global data.

UniGuard Expense Tracker was developed to bridge this gap by combining:
- practical transaction and budgeting workflows;
- AI-supported automation for categorization and anomaly alerts;
- intuitive visual analytics for user decision-making;
- a modular architecture that supports future extension.

### 1.2 Problem Statement
Many users, especially students, experience recurring financial uncertainty because of:
- inconsistent expense recording;
- delayed or absent transaction categorization;
- poor budget discipline and goal tracking;
- inability to detect abnormal spending early.

As a result, users often discover overspending too late, miss opportunities to save, and make reactive rather than proactive financial decisions. There is therefore a need for an intelligent, user-friendly system that automates repetitive tasks and provides clear, timely financial insights.

### 1.3 Main Objective
To design, implement, and evaluate an AI-assisted expense tracking system that improves personal budgeting, spending awareness, and financial decision support.

### 1.4 Specific Objectives
1. To build a secure web platform for recording income and expenses.
2. To automate transaction category prediction using machine learning.
3. To implement anomaly detection for unusual transaction behavior.
4. To provide budgeting and savings-goal management features.
5. To design interactive reports and export tools for user analysis.
6. To evaluate functional performance and practical usability of the system.

### 1.5 Research Questions
1. How accurately can transaction categories be predicted from user-entered text and metadata?
2. To what extent can anomaly detection support early spending-risk awareness?
3. Does an integrated dashboard improve visibility of financial status and trends?
4. Can receipt OCR reduce manual entry effort while preserving acceptable data quality?

### 1.6 Scope of the Study
#### 1.6.1 Content Scope
The project covers system design, implementation, and evaluation of:
- user authentication and profile setup;
- transaction recording and categorization;
- budget pods, goals, and savings tracking;
- anomaly alerts and insights;
- report visualization and export.

#### 1.6.2 Geographical Scope
The project is developed and evaluated in the Ugandan academic context, with currency and spending assumptions centered on UGX-denominated personal finance behavior.

#### 1.6.3 Time Scope
Development and validation were conducted during the 2025 to 2026 academic project period.

### 1.7 Limitations
1. No direct open-banking integration in the current version.
2. OCR quality depends on receipt image quality and camera conditions.
3. Model quality depends on available training data distribution.
4. Certain advanced AI features require external service configuration.

### 1.8 Significance of the Study
The project is significant because it:
- demonstrates applied AI integration in a full-stack system;
- provides a practical student-focused financial assistant;
- contributes a reusable architecture for future fintech innovations;
- supports academic learning in ML engineering, APIs, and cloud data systems.

### 1.9 Definition of Key Terms
- **Expense Tracker**: A system for recording and analyzing money spent.
- **Transaction Categorization**: Automatic assignment of a transaction into classes such as Food, Transport, Utilities, or Rent.
- **Anomaly Detection**: Identification of spending events that deviate from usual user patterns.
- **Budget Pod (Flux Pod)**: A user-defined allocation bucket for planned spending.
- **OCR**: Optical Character Recognition used to extract text from receipt images.

### 1.10 Organization of the Report
This report is structured into six main chapters. Chapter One introduces the problem context, objectives, and scope. Chapter Two examines related literature and identifies the project gap. Chapter Three explains the methodology used in design, implementation, and validation. Chapter Four details the architecture, modules, APIs, and storage model. Chapter Five presents results, discussion, and objective-based evaluation. Chapter Six concludes the work and provides recommendations for future improvement.

### 1.11 Project Assumptions
The current implementation and evaluation are based on the following assumptions:
1. Users can reliably enter or confirm transaction details when prompted.
2. Internet access is available for cloud-backed features (Supabase and optional OCR API).
3. Environment variables and runtime services are correctly configured before production use.
4. Financial behavior is represented by available transaction history and model training data.

### 1.12 Constraints Considered During Scoping
During requirement scoping, the team intentionally constrained the first production candidate to ensure delivery within the academic timeline:
- prioritization of web deployment over native mobile implementation;
- focus on user-facing reliability before advanced explainability interfaces;
- integration of practical AI workflows rather than research-grade algorithm benchmarking;
- use of currently available datasets and synthetic augmentation to cover sparse classes.

These constraints shaped feature ordering and helped maintain a stable release sequence.

---

## CHAPTER TWO: LITERATURE REVIEW

### 2.1 Introduction
This chapter reviews related systems and studies relevant to digital personal finance, AI categorization, anomaly detection, and receipt digitization.

### 2.2 Existing Expense-Tracking Systems
Applications such as Mint, YNAB, and PocketGuard provide core features like transaction logs and budgeting. However, constraints commonly observed include:
- region-specific adaptation challenges;
- limited transparency in AI-generated insights;
- pricing models that may not suit students;
- dependence on direct banking APIs unavailable in some settings.

### 2.3 Machine Learning for Transaction Categorization
Transaction categorization is commonly formulated as a supervised classification problem. Popular techniques include Logistic Regression, Naive Bayes, Random Forest, and gradient boosting. Studies report that model quality improves when feature engineering incorporates merchant keywords, amount signals, and locality-aware vocabulary.

In this project, scikit-learn pipelines and rule-assisted preprocessing are used to support robust categorization with practical latency for interactive user interfaces.

### 2.4 Anomaly Detection in Personal Finance
Anomaly detection can be implemented using:
- statistical thresholds (z-score, deviation rules);
- tree-based supervised approaches when labeled data exists;
- unsupervised methods such as Isolation Forest.

Hybrid methods are often preferred in real-world systems to combine domain rules and model predictions. UniGuard adopts this practical blend by combining backend model scores with local heuristics and user context.

### 2.5 OCR and Receipt Digitization
OCR technologies reduce manual entry burden and improve data consistency. In financial systems, OCR must handle:
- variable lighting and skewed images;
- mixed fonts and low-contrast printing;
- ambiguous line items and totals.

Research supports combining OCR outputs with cleaning rules to improve structured extraction quality. UniGuard integrates OCR with fallback handling to improve resilience.

### 2.6 Web Architecture for AI-Enhanced Applications
Modern web systems typically separate:
- frontend user interaction;
- backend APIs;
- data storage and authentication;
- model inference services.

This separation improves scalability, maintainability, and deployment flexibility. UniGuard follows this layered architecture using React, Supabase, and Flask components.

### 2.7 Research Gap
From reviewed work, a clear gap remains in affordable, modular, and student-centered finance platforms that integrate:
- local-context categorization;
- anomaly insights;
- receipt OCR;
- budget and goals;
- export-ready reports.

UniGuard is designed to address this gap.

### 2.8 Conceptual Framework
The conceptual flow is:
1. User inputs transactions directly or via OCR.
2. System preprocesses data and runs categorization/anomaly models.
3. Processed records are stored in a secure cloud database.
4. Dashboard computes summaries and trends.
5. User receives alerts, recommendations, and exportable insights.

### 2.9 Chapter Summary
Literature validates the need for an integrated AI-assisted expense tracker and supports the methodological and architectural choices adopted for UniGuard.

### 2.10 Comparative Synthesis of Reviewed Approaches
To better position UniGuard within existing approaches, reviewed systems can be summarized across key dimensions:

| Dimension | Typical Existing Tools | UniGuard Direction |
| --- | --- | --- |
| Cost model | Often subscription-based | Project-owned deployable stack |
| Context adaptation | Limited local merchant adaptation | Local term hints and Uganda-aware preprocessing |
| AI transparency | Often opaque recommendations | Confidence + alternatives for predictions |
| Feature integration | Budgeting or tracking in isolation | Tracking + budgets + anomalies + goals + reports |
| Student accessibility | Mixed onboarding complexity | Academic-context workflow focus |

### 2.11 Implications for This Project
The literature and comparative review guided three core implementation principles:
1. **Hybrid intelligence**: combine deterministic rules and ML for robust real-world behavior.
2. **Workflow continuity**: keep data entry, insight generation, and reporting in one flow.
3. **Modularity**: isolate frontend, backend AI, and storage to support maintainability.

### 2.12 Literature Review by Project Objective
To align directly with the project objectives, reviewed findings can be mapped as follows:

1. **Objective: secure transaction management**
   - Literature supports cloud-authenticated data systems with role or identity-based access.
   - Practical implication: Supabase Auth and row-level boundaries were selected for user isolation.

2. **Objective: transaction categorization automation**
   - Prior work shows text-based supervised learning performs well when preprocessing is domain-aware.
   - Practical implication: local hints and cleaned text are passed to a trained classifier pipeline.

3. **Objective: anomaly detection**
   - Literature emphasizes outlier detection as a decision-support signal rather than automatic fraud verdict.
   - Practical implication: UniGuard surfaces review prompts instead of irreversible automated actions.

4. **Objective: budget and goals support**
   - Financial behavior studies show visual feedback loops improve adherence.
   - Practical implication: Flux Pods and goal trackers are designed around progress visibility.

5. **Objective: insight/reporting**
   - Existing systems with periodic summaries improve user reflection and planning.
   - Practical implication: dashboard and exports were included in MVP rather than deferred.

### 2.13 Critical Reflection on Existing Work
Although literature strongly supports digital finance assistants, many implementations under-document trade-offs between model intelligence and user trust. A recurring issue is over-automation without clear feedback, which reduces confidence in recommendations. UniGuard addresses this by preserving user confirmation touchpoints (for example receipt review and transaction editing) even when AI assistance is available.

### 2.14 Summary of Identified Design Principles
The literature phase yielded six design principles adopted in UniGuard:
- keep user control at key decision points;
- prefer interpretable outputs when confidence is low;
- combine rules and models for robustness;
- optimize for local spending language;
- enforce per-user data boundaries;
- design for incremental extensibility.

---

## CHAPTER THREE: METHODOLOGY

### 3.1 Introduction
This chapter describes research design, development model, tools, data preparation, model training, and evaluation procedures used in the project.

### 3.2 Research Design
The project used a design-and-build research approach with iterative implementation. Requirements were translated into modules, implemented incrementally, and validated through functional and usability testing.

### 3.3 Development Methodology
An agile-inspired incremental methodology was used.

#### 3.3.1 Phase 1: Requirements Elicitation
User and stakeholder needs were gathered from student budgeting challenges and project goals. Core functional requirements were prioritized for MVP completion.

#### 3.3.2 Phase 2: System Planning and Design
Wireframes, module boundaries, and data entities were drafted. API contracts and model serving requirements were also defined.

#### 3.3.3 Phase 3: Implementation
Frontend and backend features were developed in parallel. ML artifacts were trained and integrated via Flask endpoints.

#### 3.3.4 Phase 4: Testing and Integration
Modules were tested individually and then as a complete workflow. Errors, edge cases, and user feedback were used to refine behavior.

#### 3.3.5 Phase 5: Documentation and Reporting
Final documentation captured architecture, implementation details, results, and recommendations.

### 3.4 Tools and Technologies
#### 3.4.1 Programming Languages
- TypeScript (frontend logic)
- Python (ML API and training scripts)
- SQL (database modeling and policies)

#### 3.4.2 Frameworks and Libraries
- React 18 with Vite
- Tailwind CSS and component libraries
- Flask for REST API services
- scikit-learn, pandas, numpy, joblib
- Recharts for analytics visualization

#### 3.4.3 Platform Services
- Supabase authentication and PostgreSQL data persistence
- Environment-based secret configuration
- Optional OCR and notification service integrations

### 3.5 Data Collection
Data used in model development included:
- labeled transaction examples for categorization;
- anomaly-oriented transaction datasets;
- synthetic augmentation to broaden pattern coverage.

Project datasets are maintained in `ml_pipeline/data`.

### 3.6 Data Preparation and Feature Engineering
Preprocessing tasks included:
1. text normalization and cleanup;
2. removal of noise terms;
3. merchant and locale hint enrichment;
4. numerical feature preparation (amounts, ratios, temporal features);
5. training and validation split preparation.

### 3.7 Model Selection and Training
Candidate model families were evaluated with emphasis on:
- predictive reliability;
- low-latency inference;
- ease of retraining;
- interpretability in a student project context.

Selected models were serialized into artifacts and loaded by the Flask API during startup.

### 3.8 Evaluation Metrics
#### 3.8.1 Classification Metrics
- Accuracy
- Precision
- Recall
- F1-score

#### 3.8.2 System-Level Metrics
- API response reliability
- Feature completion coverage
- User workflow success rate

### 3.9 Ethical and Privacy Considerations
The system was developed with privacy awareness by:
- isolating user data using authenticated access controls;
- minimizing unnecessary personal data collection;
- storing sensitive configuration in environment files;
- avoiding exposure of private values in exported reports.

### 3.10 Chapter Summary
The methodology combined software engineering rigor with practical ML integration, producing a system that is both technically grounded and user-oriented.

### 3.11 Experimental Setup and Runtime Environment
System implementation and testing were conducted using:
- React + TypeScript application runtime for interface modules.
- Flask-based API service for model inference.
- Supabase PostgreSQL and Auth services for persistence and identity.
- Notebook-based experimentation under `ml_pipeline/` for model development.

For reproducibility, the project keeps source notebooks and generated artifacts within the repository and references them during backend startup.

### 3.12 Validation Strategy
Validation combined three complementary layers:
1. **Unit-level checks** for utility functions and payload handling assumptions.
2. **Integration checks** across frontend forms, API endpoints, and Supabase reads/writes.
3. **Scenario-based user flows** from onboarding to reporting exports.

This multi-layer strategy was chosen to reduce false confidence from single-layer testing.

### 3.13 Risk Management During Development
The team tracked technical and product risks throughout implementation:
- **Model drift risk**: mitigated by retaining retrainable notebook pipelines.
- **Service dependency risk**: mitigated with fallback behavior (for example OCR fallback mode).
- **User-input noise risk**: mitigated via preprocessing and guided forms.
- **Deployment mismatch risk**: mitigated through environment-variable documentation and health checks.

### 3.14 Detailed Data Pipeline Description
The data pipeline used for model work followed a reproducible sequence:
1. Collect and merge transaction records from prepared datasets.
2. Normalize key text fields (merchant, narration, mixed symbols).
3. Standardize category labels and remove obvious inconsistencies.
4. Generate train/test splits with deterministic random seeds.
5. Train candidate estimators and compare metrics.
6. Persist selected pipelines as serialized artifacts.
7. Integrate artifacts into Flask startup loading logic.

This process was designed to balance reproducibility and practical project speed.

### 3.15 Feature Engineering Approach
Feature engineering was tuned for personal finance context:
- textual features captured transaction description semantics;
- categorical features represented payment mode and transaction type;
- derived numerical features included `amount_ratio` relative to user behavior;
- domain-hint overrides reduced frequent confusion classes.

The blend of sparse text vectors and compact numeric indicators gave useful practical performance.

### 3.16 Model Selection Rationale
Candidate models were not selected solely by peak metric score. Additional criteria included:
- startup and inference latency;
- sensitivity to noisy short text;
- retraining simplicity for student maintainers;
- compatibility with existing backend integration patterns.

As a result, Random Forest pipelines were preferred for the deployed baseline in key tasks, with additional variants retained for comparison.

### 3.17 Evaluation Procedure
Evaluation was performed in four stages:
1. Notebook-stage model comparisons and sanity checks.
2. API-level payload/response verification for endpoint contracts.
3. Frontend integration tests for form-to-insight flow.
4. End-user scenario walkthroughs (entry, analysis, export).

This sequence ensured metrics were interpreted alongside real usage behavior.

### 3.18 Ethical Handling of Financial Data
Financial systems can expose sensitive behavior patterns. The team therefore emphasized:
- minimum required personal fields;
- authenticated resource boundaries;
- no inclusion of environment secrets in user exports;
- transparent handling of automated suggestions as advisory, not authoritative.

---

## CHAPTER FOUR: SYSTEM DESIGN AND IMPLEMENTATION

### 4.1 Introduction
This chapter presents the architecture, modules, data model, APIs, and implementation details of UniGuard Expense Tracker.

### 4.2 High-Level Architecture
The system is composed of three major layers:
1. **Presentation Layer**: React frontend for user interaction.
2. **Application and Inference Layer**: Flask AI service for predictions and OCR orchestration.
3. **Data Layer**: Supabase services for authentication and persistent storage.

### 4.3 Frontend Design
The frontend is a single-page application with route-based navigation and reusable UI components.

Core pages include:
- Dashboard
- Transactions
- Budget Pods
- Goals
- Reports
- Settings
- Savings Vault and additional insights pages

Frontend responsibilities:
- collecting user inputs;
- rendering analytics and charts;
- calling APIs for AI predictions;
- managing UI state and notifications.

### 4.4 Backend API Design
The Flask service exposes JSON endpoints used by the frontend:
- `POST /api/v1/categorize` for transaction category prediction;
- `POST /api/v1/detect-anomaly` for single transaction anomaly checks;
- `POST /api/v1/detect-anomaly-batch` for grouped analysis;
- `POST /api/v1/scan-receipt` for OCR-assisted extraction;
- `GET /health` for service health checks.

The API layer validates payloads, applies preprocessing logic, runs model inference, and returns structured responses with confidence information where applicable.

### 4.5 Database and Storage Design
Supabase stores authenticated user records and finance entities such as:
- profiles
- transactions
- flux_pods (budget allocations)
- goals
- savings_vaults
- receipts metadata

Relationships are user-centric to preserve ownership boundaries and improve data consistency.

### 4.6 Core Functional Modules
#### 4.6.1 Authentication and Onboarding
Users sign up, sign in, and complete onboarding. Profile attributes influence dashboard personalization and recommendations.

#### 4.6.2 Transaction Management
Users create, edit, and review transactions. Categorization suggestions are shown to reduce manual effort and improve record consistency.

#### 4.6.3 Budget Pods (Flux Pods)
Users allocate monthly plans by category and compare planned versus actual spending in visual summaries.

#### 4.6.4 Goals and Savings
Users define financial goals with target amounts and timelines, then track progress through periodic updates.

#### 4.6.5 Reports and Analytics
The system displays category distributions, time-based spending trends, and downloadable report outputs.

#### 4.6.6 Receipt OCR
Receipt images can be uploaded for extraction of key fields, supporting faster transaction entry.

#### 4.6.7 Anomaly and Insight Engine
Transactions are evaluated for unusual behavior using model output and rule signals, then flagged for review.

### 4.7 AI and ML Integration
Model artifacts trained in `ml_pipeline` are deployed to backend services. Inference is made available to frontend modules through standard API contracts. This architecture decouples model evolution from UI development.

### 4.8 Security and Reliability Considerations
Key controls include:
- authenticated access;
- per-user data boundaries;
- environment-based secret management;
- validation of API input payloads.

### 4.9 Deployment and Runtime Considerations
Typical runtime services:
- frontend dev server (`frontend/`);
- Flask API (`backend/app.py`);
- optional notification service (`backend/server/notify.ts`);
- optional OCR service.

This separation supports local development and future cloud deployment with independent service scaling.

### 4.10 Chapter Summary
The design and implementation demonstrate a modular and maintainable architecture capable of supporting current requirements and future feature expansion.

### 4.11 Route and Navigation Design
The frontend routing configuration in `frontend/src/App.tsx` defines guarded and unguarded pages. Public entry routes include `/`, `/auth`, `/login`, `/register`, and `/onboarding`. Core product routes are protected by `RequireOnboarding` and include:
- `/dashboard`
- `/transactions`
- `/budget-ports`
- `/goals`
- `/companion`
- `/reports`
- `/achievements`
- `/leaderboard`
- `/weekly-challenges`
- `/settings`
- `/savings-vault`
- `/family-finance`
- `/investments`

This route design ensures users complete onboarding before feature-rich pages are accessed.

### 4.12 API Contract Details
The backend service (`backend/app.py`) exposes a focused set of endpoints:
1. `POST /api/v1/categorize`: predicts category from transaction text and returns confidence + alternatives.
2. `POST /api/v1/detect-anomaly`: evaluates single-record anomaly status using feature inputs including `amount_ratio`.
3. `POST /api/v1/detect-anomaly-batch`: evaluates up to 100 records in one request.
4. `POST /api/v1/scan-receipt`: runs receipt extraction and structured parsing.
5. `POST /api/v1/notify-test`: validates email notification pipeline.
6. `GET /health`: reports service/model readiness.

Endpoint-level validation was implemented to reject malformed payloads early and return readable JSON errors.

### 4.13 Domain-Aware Categorization Logic
UniGuard categorization is not purely model-driven. It first applies deterministic high-precision hints:
- Streaming and subscription hints (for example Netflix, DSTV, Spotify) mapped to `Entertainment`.
- Uganda-local hints (for example SafeBoda, Yaka, NWSC, Airtime/Data patterns) mapped to relevant categories.

Only when no strong hint exists does the system call the trained scikit-learn classifier. This improves reliability for localized transaction text and short descriptions.

### 4.14 Receipt Parsing Pipeline
Receipt processing follows a staged extraction pattern:
1. Obtain OCR text using configured OCR provider/fallback.
2. Parse amount candidates and select strongest amount signal.
3. Extract probable date/time tokens.
4. Infer merchant from first meaningful or tagged line.
5. Extract references like receipt number and outlet metadata when available.
6. Return structured fields for user confirmation before persistence.

This design acknowledges OCR uncertainty while still reducing manual entry effort.

### 4.15 Data Security and Access Policies
Row-Level Security (RLS) is enabled on key tables and policies enforce user-level ownership checks:
- `flux_pods` enforces `auth.uid() = user_id`.
- `receipts` enforces `auth.uid() = user_id`.
- `savings_vaults` enforces `auth.uid() = user_id`.

Indexes on user_id and date fields support practical query performance for dashboards and timelines.

### 4.16 Deployment Topology
The project supports a service-oriented local deployment:
- Frontend service (Vite dev/prod build output).
- AI API service (Flask).
- Optional notify service for email dispatch.
- Optional OCR service.
- Cloud persistence service (Supabase).

This topology allows independent service scaling and staged debugging.

### 4.17 Component Interaction Sequence (Operational View)
A typical transaction intelligence flow follows this sequence:
1. User creates or edits a transaction on the frontend.
2. Frontend submits text to `POST /api/v1/categorize`.
3. Backend applies hint logic, cleaning, and model inference.
4. Predicted category and confidence are returned to UI.
5. Frontend computes/collects anomaly features (including `amount_ratio`).
6. Frontend calls anomaly endpoint and receives risk flags.
7. Final transaction state is persisted to Supabase.
8. Dashboard queries and visualizations update with new aggregates.

This sequence was intentionally built to preserve responsiveness and avoid blocking UX on non-critical operations.

### 4.18 Storage Entities and Behavioral Semantics
The database schema supports both raw data and behavior-state management:
- transactions: primary ledger entries for analysis and history.
- flux_pods: planned-versus-actual budget structures.
- savings_vaults: constrained savings states with lock semantics.
- receipts: OCR-origin records and extracted metadata.

Entity semantics are designed to support both daily micro-interactions and monthly review workflows.

### 4.19 Error Handling Strategy
Robustness depends on graceful failure behavior. The implementation uses:
- input validation with explicit 4xx errors for malformed requests;
- safe fallback responses where feasible (for example unknown category path);
- non-fatal notification handling (email failures do not crash API);
- health endpoints for readiness checks during deployment.

This strategy reduces system brittleness under imperfect runtime conditions.

### 4.20 Maintainability Considerations
Maintainability goals influenced architecture and coding choices:
- clear route-based page boundaries in the frontend;
- explicit endpoint contracts in the backend;
- migration scripts for schema evolution;
- model artifacts and notebooks stored in traceable project paths.

These decisions improve handover readiness and future team onboarding.

### 4.21 Performance Considerations
Although large-scale load testing was outside project scope, practical performance controls were included:
- limited batch size on anomaly batch endpoint;
- indexed user/date fields in key tables;
- confidence-threshold logic to avoid unstable low-probability categories;
- modular service layout enabling future scaling of heavy components.

---

## CHAPTER FIVE: RESULTS, DISCUSSION, AND EVALUATION

### 5.1 Introduction
This chapter presents observed outputs from system usage, model behavior, functional testing, and interpretation of outcomes against project objectives.

### 5.2 Functional Results
The completed platform successfully supports:
- secure user onboarding;
- transaction CRUD flows;
- AI-assisted category suggestions;
- budget and goal management;
- receipt capture support;
- anomaly warning indicators;
- report generation and export.

### 5.3 Model Behavior and Practical Performance
The categorization component provides high utility on frequently occurring categories and common merchant patterns. Performance is strongest when transaction descriptions are clear and semantically rich. Anomaly flags are effective for highlighting suspicious amount outliers and unexpected spending ratios.

### 5.4 User Experience Observations
Pilot usage indicated that users:
- entered more transactions consistently over time;
- preferred auto-suggestions over manual category assignment;
- found dashboard summaries helpful for weekly decision-making;
- valued alert prompts that surfaced unusual spending early.

### 5.5 Evaluation Against Objectives
1. **Secure platform objective**: Achieved through authenticated access and user-scoped data patterns.
2. **Categorization objective**: Achieved through backend ML endpoints and frontend integration.
3. **Anomaly objective**: Achieved through prediction and alert mechanisms.
4. **Budget/goal objective**: Achieved through dedicated modules and progress visualizations.
5. **Reporting objective**: Achieved through charts and export-ready outputs.

### 5.6 Challenges Encountered
#### 5.6.1 Data and Modeling Challenges
- class imbalance in transaction categories;
- noisy and short transaction descriptions;
- domain shifts between synthetic and real usage data.

#### 5.6.2 Integration Challenges
- coordinating multiple runtime services;
- environment misconfiguration across machines;
- occasional OCR fallback behavior differences.

#### 5.6.3 Usability Challenges
- users requiring onboarding clarity for certain feature names;
- balancing detail and simplicity in dashboard visual density.

### 5.7 Mitigation Strategies Applied
- improved preprocessing and rule hints for local terms;
- environment variable documentation and startup scripts;
- iterative interface adjustments based on feedback;
- inclusion of fallback logic for service resilience.

### 5.8 Discussion
Results indicate that practical AI integration in personal finance systems is feasible and valuable when embedded within clear workflows. The most impactful design choice was combining deterministic rules with ML predictions, which improved reliability while preserving intelligent behavior. A modular architecture also improved maintainability and testing flexibility.

### 5.9 Chapter Summary
UniGuard met core functional and technical goals, with evidence of real user value in spending awareness, budgeting discipline, and automated assistance.

### 5.10 Quantitative Snapshot from Notebook Experiments
Repository notebook outputs provide representative model-performance snapshots that informed implementation:
- `ml_pipeline/train_transaction_categorizer.ipynb` shows an optimized Random Forest run with approximately `0.99` accuracy on the prepared split.
- `ml_pipeline/model.ipynb` includes comparative anomaly/classification experiments with reported accuracies around `0.70`, `0.72`, and `0.55` across tested model variants.

These values are experiment-split dependent but were sufficient to guide practical model selection for MVP deployment.

### 5.11 Interpretation of Quantitative Results
1. High categorization accuracy indicates strong fit on curated labeled data and keyword-rich transaction text.
2. Lower and variable anomaly-classification scores indicate harder generalization due to behavior diversity and class complexity.
3. Hybrid rule + model logic improves practical reliability beyond model-only inference in noisy user-entered contexts.

### 5.12 Test Case Matrix (Functional)
The following high-priority test scenarios were executed:

| Test Scenario | Expected Outcome | Result |
| --- | --- | --- |
| New user signup + onboarding | User profile completes and protected routes unlock | Pass |
| Add transaction with plain text | Category suggestion returns with confidence | Pass |
| Submit noisy transaction text | Graceful fallback category returned | Pass |
| Budget pod update | Allocation and spent values persist | Pass |
| Run anomaly check | Flag and score returned in JSON | Pass |
| Upload readable receipt | Structured fields extracted for confirmation | Pass |
| Export report | File generated without data corruption | Pass |

### 5.13 Residual Weaknesses
Despite positive outcomes, three areas remain sensitive:
- OCR extraction quality for low-light or blurred receipts.
- Model confidence calibration on rare categories.
- Dependency readiness when optional services are not available.

Addressing these areas is part of the post-project roadmap.

### 5.14 Extended Discussion of Results
The observed outcomes suggest that user value came from workflow coherence more than any single model metric. Participants benefited most when transaction entry, automated categorization, and immediate dashboard reflection occurred in one uninterrupted path. This indicates that product integration quality is as important as algorithm selection in personal finance tools.

Another notable finding is the value of domain hints before model inference. In localized contexts, certain merchant terms carry strong categorical meaning. By explicitly encoding these patterns, the system improved reliability for common transactions that would otherwise be ambiguous.

### 5.15 Objective-by-Objective Achievement Analysis
1. **Secure platform**: achieved through authenticated workflows and user-bound data patterns.
2. **Categorization automation**: achieved with hybrid hint + model route.
3. **Anomaly support**: achieved with single and batch scoring endpoints.
4. **Budget and goals**: achieved through dedicated modules and progress views.
5. **Reporting and exports**: achieved through charted views and downloadable artifacts.
6. **Practical evaluation**: achieved through integration checks and scenario testing.

Overall, objectives were met at prototype-to-preproduction level, with clear growth paths identified.

### 5.16 Threats to Validity
Evaluation conclusions should be interpreted with awareness of the following validity risks:
- dataset composition may not fully represent long-term live behavior;
- synthetic augmentation may inflate confidence for selected classes;
- limited user-study duration may underrepresent seasonal finance patterns;
- experimental metrics from notebooks may differ from production distributions.

These risks do not invalidate outcomes but define boundaries for interpretation.

### 5.17 Lessons Learned
Key implementation lessons include:
- hybrid systems are easier to stabilize than pure model-only pipelines;
- confidence reporting is essential for user trust;
- fallback paths are mandatory for multi-service systems;
- early architecture modularity reduces integration friction later.

These lessons can inform future academic and startup-grade fintech projects.

### 5.18 Recommended Immediate Enhancements
Before broader deployment, the team recommends:
- centralizing all schema/table creation under consistent migration files;
- adding endpoint-level authentication/rate limiting for public exposure;
- extending automated regression tests around categorization and anomaly flows;
- introducing confidence calibration dashboards for model maintenance.

---

## CHAPTER SIX: CONCLUSION AND RECOMMENDATIONS

### 6.1 Conclusion
UniGuard Expense Tracker successfully demonstrates an end-to-end AI-assisted personal finance platform. The project integrates a modern frontend, secure cloud persistence, and machine-learning services into a coherent user experience. It addresses key pain points in transaction tracking and budgeting by reducing manual effort and introducing actionable financial insights.

From an academic perspective, the project validates the application of software engineering, machine learning, and cloud architecture principles in solving real-world user problems. From a practical perspective, it provides a strong foundation for continued improvement and deployment.

### 6.2 Key Contributions
1. A working full-stack expense tracker tailored to student financial workflows.
2. Integrated AI categorization and anomaly detection services.
3. A modular architecture that supports feature growth and model retraining.
4. A documented implementation that can support further academic and industry work.

### 6.3 Recommendations for Future Work
1. Integrate bank and mobile money statement imports where legally and technically feasible.
2. Expand local-language and merchant-aware training data.
3. Add explainable AI feedback to improve user trust in predictions.
4. Provide mobile-first and offline synchronization capabilities.
5. Implement automated retraining and model monitoring pipelines.
6. Add longitudinal user studies to quantify long-term behavior change.

### 6.4 Practical Implementation Roadmap
To transition from academic prototype to production-grade deployment, the following phased roadmap is recommended:

**Phase I: Hardening**
- Centralize schema migrations for all tables in version control.
- Add API authentication/rate limiting for public endpoint protection.
- Extend automated tests for critical user and API flows.

**Phase II: Intelligence Maturity**
- Implement model confidence calibration and threshold tuning by category.
- Introduce periodic data quality reports and retraining triggers.
- Add user-facing explanation panels for category and anomaly outputs.

**Phase III: Product Expansion**
- Add mobile-first UX and optional offline caching.
- Integrate statement import connectors.
- Introduce institution-level analytics dashboards for broader deployment contexts.

### 6.5 Final Reflection
UniGuard demonstrates that meaningful AI value in personal finance does not require unrealistic complexity; it requires thoughtful integration of modest models, domain context, and user-centered design. The project contributes both a functioning system and a replicable engineering pattern for similar contexts where affordability, explainability, and local adaptation matter.

---

## REFERENCES
1. Bishop, C. M. (2006). *Pattern Recognition and Machine Learning*. Springer.
2. Géron, A. (2022). *Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow*. O'Reilly.
3. Kotu, V., and Deshpande, B. (2019). *Data Science: Concepts and Practice*. Morgan Kaufmann.
4. React Documentation. https://react.dev
5. Supabase Documentation. https://supabase.com/docs
6. Flask Documentation. https://flask.palletsprojects.com
7. Scikit-learn Documentation. https://scikit-learn.org
8. PostgreSQL Documentation. https://www.postgresql.org/docs

## APPENDICES

### Appendix A: Sample Categorization Request
```json
{
  "description": "Lunch at campus cafeteria",
  "amount": 18000,
  "merchant": "Campus Cafe",
  "date": "2026-04-10"
}
```

### Appendix B: Sample Categorization Response
```json
{
  "category": "Food",
  "confidence": 0.89,
  "alternatives": ["Dining", "Groceries"],
  "model_version": "transaction_rf_pipeline"
}
```

### Appendix C: Sample Anomaly Request
```json
{
  "amount": 250000,
  "category": "Transport",
  "description": "Emergency private hire",
  "amount_ratio": 3.6
}
```

### Appendix D: Sample Anomaly Response
```json
{
  "is_anomaly": true,
  "score": 0.93,
  "reason": "Amount significantly exceeds typical category trend."
}
```

### Appendix E: Deployment Notes
- Frontend runtime: `frontend/` (`npm run dev`)
- Backend runtime: `backend/app.py`
- Report script: `scripts/generate_report_pdf.py`
- Configuration source: `.env`

### Appendix F: Environment Variable Checklist
- `VITE_AI_API_URL`: frontend target for Flask API base URL.
- `NOTIFY_URL`: Flask target for notification relay service.
- `ENABLE_EMAIL_ALERTS`: toggles outbound anomaly/insight emails.
- `DOCTR_API_URL`: optional endpoint for external OCR service.
- Supabase keys and project URL: required for auth/data operations.

### Appendix G: Core Data Dictionary (Selected Fields)
1. **flux_pods**
   - `id`: unique pod identifier
   - `user_id`: owner identifier
   - `name`: budget bucket label
   - `allocated`: planned amount
   - `spent`: consumed amount
   - `status`: `healthy`, `warning`, or `critical`
   - `velocity`: spending pace indicator
   - `children`: nested structure for sub-allocations

2. **receipts**
   - `id`: unique receipt identifier
   - `user_id`: owner identifier
   - `merchant`: merchant name
   - `total_amount`: parsed amount
   - `date`: transaction date
   - `category`: assigned category
   - `items`: extracted line items JSON
   - `image_url`: optional image location

3. **savings_vaults**
   - `id`: vault identifier
   - `user_id`: owner identifier
   - `name`: vault label
   - `amount`: current saved amount
   - `lock_days`: lock duration
   - `unlock_date`: release date
   - `status`: `locked`, `unlocked`, or `broken`
   - `interest_rate`: configured growth rate

### Appendix H: Representative End-to-End User Journey
1. User registers and completes onboarding survey.
2. User adds transactions manually and via receipt scan.
3. System suggests categories and flags anomalies.
4. User allocates monthly budgets in Flux Pods.
5. User tracks goal and vault progress.
6. User reviews reports and exports monthly summaries.

### Appendix I: Sample Health Endpoint Response
```json
{
  "status": "ok",
  "model_loaded": true,
  "anomaly_model_loaded": true,
  "doctr_api_url": "disabled (Tesseract OCR)"
}
```

### Appendix J: Detailed Functional Test Checklist
- Authentication state persists correctly after refresh.
- Protected routes redirect correctly before onboarding completion.
- Categorization endpoint returns confidence and alternatives.
- Low-content text returns safe fallback category.
- Anomaly single endpoint handles default and explicit fields.
- Batch anomaly endpoint enforces row limit and response shape.
- Receipt parsing returns structured amount/date/merchant candidates.
- Flux pod updates are reflected in subsequent report calculations.
- Exported PDF/CSV generation completes without runtime errors.

### Appendix K: Proposed Monitoring Indicators
For post-deployment observability, the following indicators are recommended:
1. API response latency per endpoint.
2. Categorization fallback rate (`Other/Unknown`) over time.
3. Anomaly alert frequency per active user cohort.
4. OCR extraction success/confirmation rate.
5. Report export completion success rate.
6. Authentication and session failure patterns.
