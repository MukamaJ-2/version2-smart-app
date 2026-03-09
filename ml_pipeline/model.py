#!/usr/bin/env python
# coding: utf-8

# # Transaction Anomaly Detection
# 
# This notebook trains an Isolation Forest model to detect anomalous transactions. 
# We will generate synthetic transaction data that mimics the structure of the Smart Personal Finance app, engineer relevant behavioral and temporal features, train the model, and export it for use in the backend API.

# In[1]:


import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import warnings
warnings.filterwarnings('ignore')


# ## 1. Data Generation
# 
# We generate synthetic transactions with typical categories, amounts, and dates. We will also inject some clear anomalies (e.g., extremely large amounts, unusual times).

# In[2]:


# Load the real-world Kaggle personal finance dataset
# The dataset contains dirty amounts (mixed with currency symbols) and messy dates
df = pd.read_csv('/home/mukama/Pictures/smart-personal-finance/ml_pipeline/data/budgetwise_finance_dataset.csv')
print(f"Loaded {len(df)} raw transactions.")

# 1. Clean the 'amount' column
# Remove any non-numeric characters (like Rs, $, commas, spaces) except the decimal point
df['amount'] = df['amount'].astype(str).str.replace(r'[^\d\.]', '', regex=True)
# Convert to numeric, dropping rows where the amount is entirely missing/unparseable
df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
df = df.dropna(subset=['amount']).copy()

# 2. Clean and standardized the 'date' column
# Try parsing multiple formats and coercing failures to NaT (Not a Time)
df['datetime'] = pd.to_datetime(df['date'], errors='coerce')
# Drop rows where the date couldn't be parsed
df = df.dropna(subset=['datetime']).copy()

# Sort chronologically to prepare for feature engineering (like time differences)
df = df.sort_values('datetime').reset_index(drop=True)

# Rename transaction_type to type for compatibility with the rest of the pipeline
if 'transaction_type' in df.columns:
    df = df.rename(columns={'transaction_type': 'type'})

# Define our own temporary 'is_anomaly' column to train on.
# Since this dataset doesn't have true anomaly labels, 
# we will flag the top 5% of highest transactions as anomalies for training purposes.
threshold = df['amount'].quantile(0.95)
df['is_anomaly'] = (df['amount'] > threshold).astype(int)

print(f"Cleaned dataset contains {len(df)} transactions.")
df.head()


# ## 2. Feature Engineering
# 
# To help the model understand behavior, we extract features from timestamps and historical averages.

# In[3]:


# Function to engineer features from the cleaned dataset
def extract_features(df):
    df = df.copy()

    # Temporal features: Extract day of week from the standardized datetime
    df['day_of_week'] = df['datetime'].dt.dayofweek
    # Create a binary feature for weekends (Saturday=5, Sunday=6)
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

    # Harmonize the target categories (lowercase, strip whitespace)
    if 'category' in df.columns:
        df['category'] = df['category'].astype(str).str.lower().str.strip()

    # Calculate historical category averages using an expanding mean PER USER
    # It helps the model see if a new transaction is unusually high for that user's specific category baseline
    df['cat_avg_amount'] = df.groupby(['user_id', 'category'])['amount'].transform(lambda x: x.expanding().mean())
    # Fill NaN for first occurrences with the amount itself
    df['cat_avg_amount'] = df['cat_avg_amount'].fillna(df['amount'])

    # Ratio of this transaction amount to the historical average for this specific user/category
    df['amount_vs_avg'] = df['amount'] / (df['cat_avg_amount'] + 1)

    # Time since user's last transaction (in days)
    # NOTE: Group by user_id to avoid mixing up timestamps between different users!
    df['time_diff_days'] = df.groupby('user_id')['datetime'].diff().dt.total_seconds() / (3600.0 * 24)
    df['time_diff_days'] = df['time_diff_days'].fillna(0)

    return df

# Apply feature engineering
df_feat = extract_features(df)
df_feat.head()


# ## 2.5 Exploratory Data Analysis (EDA)
# 
# Before engineering features, let's explore the cleaned dataset to understand distributions, categories, and potential anomalies.

# In[4]:


# 1. Basic Information & Descriptive Statistics
print("--- Dataset Info ---")
df.info()
print("\n--- Descriptive Statistics ---")
print(df.describe(include='all'))
print("\n--- Missing Values ---")
print(df.isnull().sum())


# In[5]:


# 2. Visualizing the Distribution of Transaction Amounts
plt.figure(figsize=(14, 5))

# Histogram with KDE to see the skewness of spending
plt.subplot(1, 2, 1)
sns.histplot(df['amount'], bins=50, kde=True, color='skyblue')
plt.title('Distribution of Transaction Amounts')
plt.xlabel('Amount')
plt.ylabel('Frequency')

# Boxplot to clearly visualize the extreme outliers (potential anomalies)
plt.subplot(1, 2, 2)
sns.boxplot(x=df['amount'], color='lightgreen')
plt.title('Boxplot of Transaction Amounts (Outliers)')
plt.xlabel('Amount')

plt.tight_layout()
plt.show()


# In[6]:


# 3. Categorical Analysis: Transactions by Category
plt.figure(figsize=(12, 6))

# Count plot of categories
order = df['category'].value_counts().index
sns.countplot(data=df, y='category', order=order, palette='viridis')

plt.title('Number of Transactions per Category')
plt.xlabel('Count')
plt.ylabel('Category')
plt.show()


# In[7]:


# 4. Temporal Analysis: Spending Patterns Over Time
# Group by Date (ignoring times if they existed) and sum the amounts
daily_spending = df.groupby(df['datetime'].dt.date)['amount'].sum().reset_index()

plt.figure(figsize=(14, 6))
sns.lineplot(data=daily_spending, x='datetime', y='amount', color='coral')
plt.title('Total Daily Transaction Volumes Over Time')
plt.xlabel('Date')
plt.ylabel('Total Amount Spent/Received')
plt.xticks(rotation=45)
plt.show()


# ## 3. Preprocessing Pipeline
# 
# We will build a pipeline that includes standard scaling and specific feature selection.

# In[8]:


# Import machine learning pipeline components and Isolation Forest
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import IsolationForest

# Define numerical features (swapped hour for time_diff_days)
numeric_features = ['amount', 'amount_vs_avg', 'time_diff_days']
# Define categorical features
categorical_features = ['category', 'type', 'is_weekend']

# Preprocessing for numerical data: impute missing values with median, then scale
numeric_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler())
])

# Preprocessing for categorical data: impute missing with a constant, then one-hot encode
categorical_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
    ('onehot', OneHotEncoder(handle_unknown='ignore'))
])

# Combine into a ColumnTransformer
preprocessor = ColumnTransformer(
    transformers=[
        ('num', numeric_transformer, numeric_features),
        ('cat', categorical_transformer, categorical_features)
    ])

# Create the main ML pipeline
model_pipeline = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('classifier', IsolationForest(contamination=0.05, random_state=42, n_estimators=100))
])


# ## 4. Model Training & Evaluation

# In[9]:


# Train the model using the engineered features
model_pipeline.fit(df_feat)

# Predict anomalies: -1 for anomaly, 1 for normal
predictions = model_pipeline.predict(df_feat)
df_feat['pred_anomaly'] = [1 if p == -1 else 0 for p in predictions]

from sklearn.metrics import classification_report, confusion_matrix

print("Confusion Matrix:")
print(confusion_matrix(df_feat['is_anomaly'], df_feat['pred_anomaly']))

print("\nClassification Report:")
print(classification_report(df_feat['is_anomaly'], df_feat['pred_anomaly']))


# ## 5. Visualization

# In[10]:


plt.figure(figsize=(12, 6))
sns.scatterplot(data=df_feat, x='datetime', y='amount', hue='pred_anomaly', style='is_anomaly', palette='coolwarm')
plt.title('Transaction Amounts Over Time (Orange = Predicted Anomaly)')
plt.ylabel('Amount (UGX)')
plt.xlabel('Date')
plt.show()


# ## 6. Export the Pipeline for the Backend API
# 
# For the backend to use this without manual feature engineering of historical averages, we should package a function or script, but for now we export the main preprocessor and isolation forest pipeline.

# In[11]:


import os

model_dir = '../backend/training/models/anomaly_detector'
os.makedirs(model_dir, exist_ok=True)

model_path = os.path.join(model_dir, 'anomaly_iforest_pipeline.pkl')
joblib.dump(model_pipeline, model_path)
print(f"Model exported successfully to {model_path}")


# ## 7. Inference Example
# 
# How to use this model to make predictions given user behavioral context.

# In[12]:


# Example of testing inference using the Kaggle dataset's schema
new_tx = pd.DataFrame([{
    'amount': 5000000,     # Very high amount
    'amount_vs_avg': 80.0, # 80x the usual spending for this category
    'time_diff_days': 0.1, # Short time difference
    'category': 'Rent',
    'type': 'Expense',
    'is_weekend': 0
}])

# Feed the sample into the trained pipeline
pred = model_pipeline.predict(new_tx)

# The model outputs -1 meaning 'anomaly' and 1 meaning 'normal'
print("Anomaly (-1) or Normal (1)?", pred[0])

