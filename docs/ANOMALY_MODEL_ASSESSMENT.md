# Anomaly Detection Model Assessment

## Summary: The trained model does **not** satisfy requirements for drop-in use

The Isolation Forest model in `ml_pipeline/model.ipynb` cannot be used as-is for UniGuard because of dataset, schema, and design mismatches. A different approach is needed.

---

## 1. Dataset Used in the Notebook

| Aspect | Notebook (`model.ipynb`) | UniGuard App |
|--------|--------------------------|--------------|
| **Source** | `data/budgetwise_finance_dataset.csv` | User transactions in Supabase |
| **Currency** | INR (Indian Rupees) | UGX (Ugandan Shillings) |
| **Amount scale** | ~500–6M INR (mean ~6M after cleaning) | ~1,000–50M+ UGX |
| **Users** | 150 Indian users | Any user, any region |
| **Rows** | ~5,600 after cleaning | Per-user, varies |

---

## 2. Critical Mismatches

### 2.1 Currency & Amount Scale

- **Training**: Amounts are in INR (e.g. 3,888, 62,061, 999,999,999).
- **Inference**: UniGuard amounts are in UGX (e.g. 50,000, 500,000, 5,000,000).
- **Effect**: The pipeline uses `StandardScaler` on raw amounts. The scaler was fit on INR. UGX amounts are ~50–100× larger, so they will almost always be treated as anomalies regardless of category.

### 2.2 Anomaly Labels Are Synthetic

- The notebook does **not** use real anomaly/fraud labels.
- It creates labels by:
  - Top 5% of highest amounts, or
  - IQR-based outliers (amount outside Q1−1.5×IQR or Q3+1.5×IQR).
- So the model learns “unusually large amounts” in the training distribution, not true anomalies.

### 2.3 Global vs Per-User Behavior

- The model is trained on **global** data (all 150 users together).
- It learns patterns like “for category X, amount Y is unusual” across the whole dataset.
- UniGuard needs “unusual **for this user**”:
  - User A: rent 500,000 UGX → normal.
  - User B: rent 500,000 UGX → anomaly if they usually pay 100,000.
- A single global model cannot capture per-user spending habits.

### 2.4 Schema Differences

| Notebook expects | UniGuard has |
|------------------|--------------|
| `transaction_type` (Expense/Income) | `type` (expense/income) ✓ |
| `category` | `category` ✓ |
| `amount` | `amount` ✓ |
| `payment_mode` (card, upi, cash, etc.) | **Missing** – would need default e.g. "Unknown" |

---

## 3. What the Model Actually Learns

- **Features**: `transaction_type`, `category`, `amount`, `payment_mode`.
- **Preprocessing**: `StandardScaler` on amount, `OneHotEncoder` on categoricals.
- **Model**: `IsolationForest(contamination=0.1)`.
- **Behavior**: Flags points that are “far” from the training distribution in this feature space.

Because the training distribution is INR-based and global, it does not match UniGuard’s UGX and per-user context.

---

## 4. Requirements for “Works for All Users”

To support different spending habits across users, anomaly detection must be **user-relative**:

1. Compare each transaction to **that user’s** history.
2. Use amounts normalized by category (e.g. z-score per user per category).
3. Or use a model trained on per-user features (e.g. amount / user’s category mean).

The current notebook model does none of this; it uses global, absolute amounts.

---

## 5. Recommended Paths Forward

### Option A: Keep the Simulated Detector (Current)

- The current `anomaly-detector.ts` is already user-relative:
  - Uses the user’s own history.
  - Z-scores per category.
  - Falls back to `trainedCategoryStats` when history is sparse.
- **Pros**: Works for all users, no backend changes.  
- **Cons**: Uses fixed stats; not a trained ML model.

### Option B: Use the Trained Model with Per-User Normalization

- At inference:
  1. Normalize amount by the user’s category mean (or median).
  2. Map UniGuard categories to the notebook’s category set.
  3. Pass `payment_mode="Unknown"` if needed.
- **Pros**: Uses the trained model.  
- **Cons**: Requires significant feature engineering and alignment; the notebook’s pipeline is not designed for this.

### Option C: Retrain on UniGuard-Relevant Data (Recommended)

- **Data**: Use real UGX transactions (or synthetic UGX data) with per-user structure.
- **Labels**: Either:
  - User-confirmed anomalies (e.g. “not an anomaly”),
  - Or synthetic labels based on per-user z-scores.
- **Features**: Per-user normalized amounts (e.g. amount / user_category_mean).
- **Output**: Export a pipeline compatible with the app’s schema.

### Option D: Hybrid (Trained Model + User History)

- Add an API endpoint that:
  1. Receives a transaction and the user’s recent history.
  2. Normalizes amounts per user per category.
  3. Calls the trained model.
- **Pros**: Uses the trained model.  
- **Cons**: Needs backend changes and normalization logic; still limited by INR training data.

---

## 6. Conclusion

The notebook’s Isolation Forest model and dataset **do not** meet the requirements for direct use in UniGuard because of:

1. Currency and scale mismatch (INR vs UGX).
2. Global training vs need for per-user behavior.
3. Synthetic anomaly labels instead of real ones.
4. Missing `payment_mode` in UniGuard.

To use a trained model, you should either:

- Retrain on UGX and per-user normalized features (Option C), or  
- Implement per-user normalization and schema mapping before calling the current model (Option B/D).

Until then, the existing simulated detector remains the most suitable option for user-relative anomaly detection.
