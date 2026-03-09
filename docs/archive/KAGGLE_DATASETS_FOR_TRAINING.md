# Kaggle Datasets for Training AI Models

This document provides recommended Kaggle datasets for training each of the 5 AI models in UniGuard Wallet.

---

## 📊 Overview

Each model requires different types of data. Below are specific Kaggle datasets with direct links and descriptions of how to use them.

---

## 1. 📝 Transaction Categorization Model

### **Primary Dataset:**

**Dataset Name:** Personal Finance Transactions Dataset  
**Kaggle Link:** `https://www.kaggle.com/datasets/yourusername/personal-finance-transactions`  
**Alternative Search:** Search "transaction categorization" or "expense categorization" on Kaggle

**Recommended Datasets:**

1. **"Bank Transaction Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=bank+transaction`
   - **What to look for:** Datasets with columns: `description`, `amount`, `merchant`, `category`
   - **Size:** 10,000+ transactions
   - **Format:** CSV with columns: `date`, `description`, `amount`, `merchant`, `category`, `type`

2. **"Credit Card Transaction Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=credit+card+transaction`
   - **What to look for:** Real credit card transactions with merchant names and categories
   - **Size:** 50,000+ transactions preferred

3. **"Personal Expense Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=personal+expense`
   - **What to look for:** Categorized expenses with descriptions

### **Data Requirements:**
- **Minimum:** 5,000 transactions
- **Ideal:** 50,000+ transactions
- **Columns needed:**
  - `description` (text)
  - `amount` (numeric)
  - `merchant` (text, optional)
  - `category` (categorical: Coffee, Dining, Shopping, Tech, Transport, Health, etc.)
  - `date` (datetime)

### **How to Use:**
1. Download dataset from Kaggle
2. Clean and format to match your `TrainingTransaction` interface
3. Extract features using `extractTransactionFeatures()` function
4. Train model with category labels as targets

---

## 2. 📈 Spending Forecasting Model

### **Primary Dataset:**

**Dataset Name:** Time Series Financial Transaction Data  
**Kaggle Link:** `https://www.kaggle.com/datasets/search?q=time+series+financial+transaction`

**Recommended Datasets:**

1. **"Bank Transaction Time Series"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=bank+transaction+time+series`
   - **What to look for:** Transactions with dates spanning 6+ months
   - **Size:** 20,000+ transactions over 6-12 months
   - **Format:** CSV with `date`, `amount`, `category`, `type`

2. **"Personal Spending History Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=personal+spending+history`
   - **What to look for:** Monthly spending patterns by category
   - **Features:** Daily/weekly/monthly aggregations

3. **"Financial Time Series Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=financial+time+series`
   - **What to look for:** Regular transaction intervals

### **Data Requirements:**
- **Minimum:** 3 months of daily transactions
- **Ideal:** 12+ months of data
- **Columns needed:**
  - `date` (datetime, regular intervals)
  - `amount` (numeric)
  - `category` (categorical)
  - `type` (income/expense)

### **How to Use:**
1. Download time series dataset
2. Group by category and date
3. Calculate daily/weekly/monthly spending patterns
4. Train LSTM or time series model to predict future spending

---

## 3. 💰 Budget Allocation Model

### **Primary Dataset:**

**Dataset Name:** Budget Allocation and Spending Patterns  
**Kaggle Link:** `https://www.kaggle.com/datasets/search?q=budget+allocation+spending`

**Recommended Datasets:**

1. **"Household Budget Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=household+budget`
   - **What to look for:** Monthly budgets vs actual spending by category
   - **Size:** 1,000+ households or users
   - **Format:** CSV with `user_id`, `category`, `budgeted`, `spent`, `income`

2. **"Personal Finance Budget Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=personal+finance+budget`
   - **What to look for:** Income, expenses, and budget allocations

3. **"Spending Pattern Analysis Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=spending+pattern+analysis`
   - **What to look for:** Category-wise spending proportions

### **Data Requirements:**
- **Minimum:** 500 users with 3+ months of data each
- **Ideal:** 5,000+ users
- **Columns needed:**
  - `user_id` (identifier)
  - `monthly_income` (numeric)
  - `category` (categorical)
  - `allocated_budget` (numeric)
  - `actual_spent` (numeric)
  - `date` (datetime)

### **How to Use:**
1. Download budget dataset
2. Calculate spending proportions per category
3. Train optimization model to suggest allocations based on income and goals
4. Use historical spending to predict future needs

---

## 4. 🎯 Goal Achievement Prediction Model

### **Primary Dataset:**

**Dataset Name:** Financial Goals and Savings Progress  
**Kaggle Link:** `https://www.kaggle.com/datasets/search?q=financial+goals+savings`

**Recommended Datasets:**

1. **"Savings Goal Tracking Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=savings+goal+tracking`
   - **What to look for:** Goals with target amounts, current amounts, deadlines, contributions
   - **Size:** 1,000+ goals with completion status
   - **Format:** CSV with `goal_id`, `target_amount`, `current_amount`, `monthly_contribution`, `deadline`, `completed`, `completion_date`

2. **"Personal Finance Goals Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=personal+finance+goals`
   - **What to look for:** Goal progress over time

3. **"Financial Planning Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=financial+planning`
   - **What to look for:** Long-term financial goals with contribution history

### **Data Requirements:**
- **Minimum:** 500 goals with completion data
- **Ideal:** 5,000+ goals
- **Columns needed:**
  - `goal_id` (identifier)
  - `target_amount` (numeric)
  - `current_amount` (numeric, time series)
  - `monthly_contribution` (numeric)
  - `deadline` (datetime)
  - `completed` (boolean)
  - `completion_date` (datetime, if completed)
  - `user_income` (numeric)
  - `user_expenses` (numeric, time series)

### **How to Use:**
1. Download goals dataset
2. Calculate contribution consistency and variability
3. Train regression model to predict completion probability
4. Use Monte Carlo simulation for uncertainty estimation

---

## 5. 🚨 Anomaly Detection Model

### **Primary Dataset:**

**Dataset Name:** Fraud Detection Transaction Dataset  
**Kaggle Link:** `https://www.kaggle.com/datasets/search?q=fraud+detection+transaction`

**Recommended Datasets:**

1. **"Credit Card Fraud Detection"** ⭐ **MOST POPULAR**
   - **Kaggle Link:** `https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud`
   - **Direct URL:** `https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud`
   - **Size:** 284,807 transactions
   - **Features:** Amount, time, anonymized features (V1-V28)
   - **Labels:** Fraud (1) or Normal (0)
   - **Note:** This is one of the most popular fraud detection datasets on Kaggle
   - **Usability:** 10.0/10

2. **"Synthetic Financial Dataset for Fraud Detection (PaySim)"**
   - **Kaggle Link:** `https://www.kaggle.com/datasets/ealaxi/paysim1`
   - **Direct URL:** `https://www.kaggle.com/datasets/ealaxi/paysim1`
   - **Size:** 6+ million transactions
   - **Features:** Transaction type, amount, origin, destination, timestamp
   - **Labels:** Fraud flag (isFraud column)
   - **Note:** Simulated mobile money transactions based on real patterns

3. **"Bank Transaction Anomaly Detection"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=bank+transaction+anomaly`
   - **What to look for:** Normal transactions with some flagged as anomalies

4. **"Transaction Anomaly Dataset"**
   - **Search on Kaggle:** `https://www.kaggle.com/datasets/search?q=transaction+anomaly`
   - **What to look for:** Z-score based anomalies or statistical outliers

### **Data Requirements:**
- **Minimum:** 10,000 transactions with 1-5% anomalies
- **Ideal:** 100,000+ transactions
- **Columns needed:**
  - `transaction_id` (identifier)
  - `amount` (numeric)
  - `category` (categorical)
  - `merchant` (text)
  - `date` (datetime)
  - `is_anomaly` or `is_fraud` (boolean label)
  - `user_id` (identifier, for user-specific patterns)

### **How to Use:**
1. Download fraud/anomaly dataset
2. Calculate normal spending patterns per user/category
3. Train Isolation Forest or Autoencoder model
4. Use Z-score or statistical methods for baseline

---

## 🔍 How to Find These Datasets on Kaggle

### **Step-by-Step Guide:**

1. **Go to Kaggle:** `https://www.kaggle.com/datasets`

2. **Use Search Bar:**
   - Type keywords like:
     - "transaction categorization"
     - "personal finance"
     - "bank transaction"
     - "spending pattern"
     - "financial goal"
     - "fraud detection"

3. **Filter Results:**
   - **File Type:** CSV
   - **Size:** Medium to Large (10MB+)
   - **Usability:** High usability score
   - **License:** Open source or CC0

4. **Check Dataset Quality:**
   - ✅ Has description and column explanations
   - ✅ Has sample data preview
   - ✅ Has usage examples/kernels
   - ✅ Recent updates (within 2 years)
   - ✅ Good ratings (4+ stars)

---

## 📋 Specific Kaggle Dataset Recommendations

### **Top 10 Most Useful Kaggle Datasets for Your Models:**

1. **Credit Card Fraud Detection** ⭐⭐⭐⭐⭐
   - **URL:** `https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud`
   - **Best for:** Anomaly Detection Model
   - **Size:** 284K transactions
   - **License:** Database: Open Database, Contents: Database Contents

2. **PaySim Financial Dataset** ⭐⭐⭐⭐⭐
   - **URL:** `https://www.kaggle.com/datasets/ealaxi/paysim1`
   - **Best for:** Anomaly Detection, Transaction Categorization
   - **Size:** 6M+ transactions
   - **License:** Open Database License

3. **IEEE-CIS Fraud Detection** ⭐⭐⭐⭐
   - **URL:** `https://www.kaggle.com/competitions/ieee-fraud-detection/data`
   - **Best for:** Anomaly Detection (competition dataset)
   - **Size:** Large scale
   - **Note:** Competition dataset with train/test splits

4. **Bank Marketing Dataset** ⭐⭐⭐
   - **Search:** `https://www.kaggle.com/datasets/search?q=bank+marketing`
   - **Best for:** Budget Allocation (customer segmentation)
   - **Contains:** Customer financial behavior data

5. **Personal Finance Transactions** ⭐⭐⭐
   - **Search:** `https://www.kaggle.com/datasets/search?q=personal+finance+transaction`
   - **Best for:** Transaction Categorization
   - **Note:** May need to combine multiple smaller datasets

6. **Household Budget Survey** ⭐⭐⭐
   - **Search:** `https://www.kaggle.com/datasets/search?q=household+budget`
   - **Best for:** Budget Allocation Model
   - **Contains:** Budget vs actual spending

7. **Time Series Financial Data** ⭐⭐⭐⭐
   - **Search:** `https://www.kaggle.com/datasets/search?q=time+series+financial`
   - **Best for:** Spending Forecasting Model
   - **Contains:** Historical spending patterns

8. **Expense Tracking Dataset** ⭐⭐⭐
   - **Search:** `https://www.kaggle.com/datasets/search?q=expense+tracking`
   - **Best for:** Transaction Categorization, Spending Forecasting

9. **Savings Goal Dataset** ⭐⭐
   - **Search:** `https://www.kaggle.com/datasets/search?q=savings+goal`
   - **Best for:** Goal Predictor Model
   - **Note:** May be limited, consider synthetic generation

10. **Bank Transaction Dataset** ⭐⭐⭐⭐
    - **Search:** `https://www.kaggle.com/datasets/search?q=bank+transaction`
    - **Best for:** All models (if comprehensive)
    - **Contains:** Real bank transaction data

### **For All Models (Combined Dataset):**

**"Personal Finance Management Dataset"**
- **Search:** `https://www.kaggle.com/datasets/search?q=personal+finance+management`
- **Ideal dataset would have:**
  - Transactions with categories
  - Time series data (dates)
  - User budgets and allocations
  - Financial goals
  - Anomaly labels
- **Alternative:** Combine multiple datasets above

### **Alternative: Create Synthetic Data**

If you can't find suitable datasets, you can:

1. **Use the mock data** already in `src/lib/ai/training-data.ts`
2. **Extend it** with more realistic patterns
3. **Generate synthetic data** using Python:
   ```python
   import pandas as pd
   import numpy as np
   from datetime import datetime, timedelta
   
   # Generate synthetic transaction data
   categories = ['Coffee', 'Dining', 'Shopping', 'Tech', 'Transport', 'Health']
   dates = pd.date_range(start='2023-01-01', end='2024-12-31', freq='D')
   transactions = []
   
   for date in dates:
       for _ in range(np.random.randint(1, 5)):
           transactions.append({
               'date': date,
               'description': f"Transaction {np.random.randint(1000, 9999)}",
               'amount': np.random.randint(500, 50000),
               'category': np.random.choice(categories),
               'merchant': f"Merchant{np.random.randint(1, 100)}",
               'type': 'expense'
           })
   
   df = pd.DataFrame(transactions)
   df.to_csv('synthetic_transactions.csv', index=False)
   ```

---

## 🎯 Recommended Training Workflow

### **Phase 1: Data Collection (Week 1-2)**
1. Download datasets from Kaggle
2. Clean and preprocess data
3. Format to match your interfaces
4. Split into train/validation/test sets

### **Phase 2: Model Training (Week 3-4)**
1. **Transaction Categorizer:** Train BERT/fine-tuned transformer
2. **Spending Forecaster:** Train LSTM/Time Series model
3. **Budget Allocator:** Train optimization model
4. **Goal Predictor:** Train regression + Monte Carlo
5. **Anomaly Detector:** Train Isolation Forest/Autoencoder

### **Phase 3: Integration (Week 5)**
1. Replace mock models with trained models
2. Test accuracy and performance
3. Fine-tune based on user feedback

---

## 📚 Additional Resources

### **Kaggle Learning Paths:**
- **Time Series:** `https://www.kaggle.com/learn/time-series`
- **NLP:** `https://www.kaggle.com/learn/natural-language-processing`
- **Anomaly Detection:** `https://www.kaggle.com/learn/anomaly-detection`

### **Popular Kaggle Competitions (for reference):**
- **Credit Card Fraud Detection:** `https://www.kaggle.com/competitions/ieee-fraud-detection`
- **Personal Finance:** Search for personal finance competitions

### **Data Augmentation:**
If datasets are small, consider:
- Data augmentation techniques
- Transfer learning from larger datasets
- Synthetic data generation
- Combining multiple small datasets

---

## 🔗 Quick Links Summary

| Model | Primary Dataset | Direct Link | Expected Size |
|-------|----------------|-------------|---------------|
| **Transaction Categorizer** | "transaction categorization" | [Search Kaggle](https://www.kaggle.com/datasets/search?q=transaction+categorization) | 10,000+ transactions |
| **Spending Forecaster** | "time series transaction" | [Search Kaggle](https://www.kaggle.com/datasets/search?q=time+series+transaction) | 6+ months of data |
| **Budget Allocator** | "budget allocation spending" | [Search Kaggle](https://www.kaggle.com/datasets/search?q=budget+allocation+spending) | 1,000+ users |
| **Goal Predictor** | "financial goals savings" | [Search Kaggle](https://www.kaggle.com/datasets/search?q=financial+goals+savings) | 500+ goals |
| **Anomaly Detector** | Credit Card Fraud Detection | [Direct Link](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) | 284,807 transactions |

### **Direct Dataset Links (Copy & Paste):**

1. **Credit Card Fraud Detection:**
   ```
   https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud
   ```

2. **PaySim Financial Dataset:**
   ```
   https://www.kaggle.com/datasets/ealaxi/paysim1
   ```

3. **IEEE Fraud Detection Competition:**
   ```
   https://www.kaggle.com/competitions/ieee-fraud-detection/data
   ```

4. **Search for Transaction Categorization:**
   ```
   https://www.kaggle.com/datasets/search?q=transaction+categorization
   ```

5. **Search for Personal Finance:**
   ```
   https://www.kaggle.com/datasets/search?q=personal+finance
   ```

6. **Search for Time Series Financial:**
   ```
   https://www.kaggle.com/datasets/search?q=time+series+financial
   ```

7. **Search for Budget Allocation:**
   ```
   https://www.kaggle.com/datasets/search?q=budget+allocation
   ```

8. **Search for Savings Goals:**
   ```
   https://www.kaggle.com/datasets/search?q=savings+goal
   ```

---

## 💡 Pro Tips

1. **Start with the Credit Card Fraud Detection dataset** - it's well-documented and popular
2. **Combine multiple datasets** if one doesn't have all required fields
3. **Use data augmentation** to increase dataset size
4. **Check dataset licenses** before commercial use
5. **Join Kaggle discussions** to find similar projects and datasets
6. **Use Kaggle Notebooks** to explore datasets before downloading

---

## 🚀 Next Steps

1. **Create Kaggle account** (if you don't have one): `https://www.kaggle.com/account/register`
2. **Search for datasets** using the queries above
3. **Download and explore** datasets in Kaggle Notebooks
4. **Format data** to match your `TrainingTransaction` interface
5. **Train models** using your preferred ML framework (TensorFlow, PyTorch, scikit-learn)
6. **Export trained models** and integrate into your application

---

**Remember:** The quality of your models depends heavily on the quality and quantity of training data. Invest time in finding good datasets and cleaning them properly!

---

## 🎯 Quick Start: Recommended Dataset for Each Model

### **Best Single Dataset Per Model:**

| Model | Recommended Dataset | Direct Link | Why This Dataset |
|-------|-------------------|-------------|-----------------|
| **1. Transaction Categorizer** | Personal Finance Transactions | [Search Here](https://www.kaggle.com/datasets/search?q=personal+finance+transaction) | Has descriptions, amounts, categories |
| **2. Spending Forecaster** | PaySim Financial Dataset | [Click Here](https://www.kaggle.com/datasets/ealaxi/paysim1) | 6M+ transactions with timestamps |
| **3. Budget Allocator** | Household Budget Survey | [Search Here](https://www.kaggle.com/datasets/search?q=household+budget) | Has income, budgets, spending |
| **4. Goal Predictor** | Create Synthetic Data | Use `training-data.ts` as base | Real goal data is rare |
| **5. Anomaly Detector** | Credit Card Fraud Detection | [Click Here](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) | 284K transactions, labeled fraud |

### **Universal Dataset (Works for All Models):**

**PaySim Financial Dataset** - `https://www.kaggle.com/datasets/ealaxi/paysim1`
- ✅ Has transactions with amounts and timestamps
- ✅ Has fraud labels (for anomaly detection)
- ✅ Large enough for time series (for forecasting)
- ✅ Can derive categories from transaction types
- ✅ Has user patterns (for budget allocation)

**Note:** You may need to supplement with additional datasets for specific features.

---

## 📥 How to Download Datasets from Kaggle

### **Method 1: Using Kaggle API (Recommended)**

1. **Install Kaggle API:**
   ```bash
   pip install kaggle
   ```

2. **Get API Credentials:**
   - Go to: `https://www.kaggle.com/account`
   - Scroll to "API" section
   - Click "Create New API Token"
   - This downloads `kaggle.json`

3. **Place credentials:**
   ```bash
   mkdir -p ~/.kaggle
   mv kaggle.json ~/.kaggle/
   chmod 600 ~/.kaggle/kaggle.json
   ```

4. **Download dataset:**
   ```bash
   # For Credit Card Fraud Detection
   kaggle datasets download -d mlg-ulb/creditcardfraud
   
   # For PaySim
   kaggle datasets download -d ealaxi/paysim1
   
   # Extract
   unzip creditcardfraud.zip
   unzip paysim1.zip
   ```

### **Method 2: Manual Download**

1. Go to the dataset page on Kaggle
2. Click "Download" button (top right)
3. Extract the ZIP file
4. Load CSV into your training script

### **Method 3: Using Kaggle Notebooks**

1. Create a new Kaggle Notebook
2. Add dataset to notebook (right sidebar)
3. Use directly in notebook for exploration
4. Export processed data

---

## 🔄 Data Preprocessing Checklist

Before training, ensure your data:

- [ ] **Matches your interface:** Data structure matches `TrainingTransaction`
- [ ] **Has required columns:** date, description, amount, category, type
- [ ] **Is cleaned:** No null values, consistent formats
- [ ] **Is normalized:** Amounts in same currency (UGX)
- [ ] **Is split:** Train (70%), Validation (15%), Test (15%)
- [ ] **Is balanced:** Categories have sufficient samples
- [ ] **Has labels:** Categories for categorization, fraud flags for anomaly

---

## 📊 Expected Dataset Sizes

| Model | Minimum | Ideal | Maximum |
|-------|---------|-------|---------|
| Transaction Categorizer | 5,000 | 50,000 | 500,000+ |
| Spending Forecaster | 3 months | 12 months | 24+ months |
| Budget Allocator | 500 users | 5,000 users | 50,000+ users |
| Goal Predictor | 500 goals | 5,000 goals | 50,000+ goals |
| Anomaly Detector | 10,000 | 100,000 | 1,000,000+ |

**Note:** More data = Better models, but also longer training time. Start with minimum, scale up as needed.

---

## 🎓 Learning Resources

### **Kaggle Courses (Free):**
- **Intro to Machine Learning:** `https://www.kaggle.com/learn/intro-to-machine-learning`
- **Time Series:** `https://www.kaggle.com/learn/time-series`
- **NLP:** `https://www.kaggle.com/learn/natural-language-processing`
- **Feature Engineering:** `https://www.kaggle.com/learn/feature-engineering`

### **Kaggle Discussions:**
- Search for similar projects: `https://www.kaggle.com/discussions`
- Ask questions about datasets
- Find code examples and kernels

---

## ✅ Final Checklist

Before starting training:

- [ ] Created Kaggle account
- [ ] Downloaded at least one dataset per model
- [ ] Explored data in Kaggle Notebooks
- [ ] Understood data structure and columns
- [ ] Cleaned and preprocessed data
- [ ] Split into train/validation/test
- [ ] Verified data matches your interfaces
- [ ] Set up training environment (Python, TensorFlow/PyTorch)
- [ ] Ready to replace mock models with real trained models

---

**Good luck with training! 🚀**
