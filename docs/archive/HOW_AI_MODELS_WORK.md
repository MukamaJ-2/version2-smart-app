# How Each AI Model Works - Simple Explanation

This document explains how every AI model in UniGuard Wallet works, in plain English that anyone can understand.

---

## 🎯 Overview: The Big Picture

Think of AI models like smart assistants that learn patterns from your financial data. Each model is like a specialist:

1. **Transaction Categorizer** = A smart filing clerk
2. **Spending Forecaster** = A financial fortune teller
3. **Budget Allocator** = A financial advisor
4. **Goal Predictor** = A success calculator
5. **Anomaly Detector** = A security guard

All models work together through the **AI Service** (like a central command center) to help you manage your money better.

---

## 1. 📝 Transaction Categorization Model

### **What It Does:**
Automatically figures out what category a transaction belongs to (Coffee, Dining, Tech, etc.) when you add it.

### **How It Was "Trained":**
The model learned patterns from example transactions:
- "Starbucks Coffee" → Coffee category
- "Amazon Purchase" → Shopping (but if amount > 20,000 UGX, it's Tech)
- "Uber Ride" → Transport
- "Netflix Subscription" → Tech

It learned **weights** (importance scores) for different clues:
- If description has "coffee" → +0.95 points for Coffee category
- If amount is small (< 1,000 UGX) → +0.8 points for Coffee
- If merchant is "Amazon" → +0.3 points for Shopping
- If amount is large (> 20,000 UGX) → +0.4 points for Tech

### **How It Works (Step by Step):**

1. **You type:** "Paid 45k to Amazon for laptop"

2. **Model extracts features:**
   - Description: "paid 45k to amazon for laptop"
   - Amount: 45,000 UGX
   - Merchant: "Amazon"
   - Has "tech" words? Yes (laptop)
   - Amount is large? Yes (> 20,000)

3. **Model scores each category:**
   - **Shopping:** 0.85 (has "amazon") + 0.4 (medium amount) = 1.25 points
   - **Tech:** 0.9 (has "laptop") + 0.5 (large amount) + 0.4 (Amazon + large) = 1.8 points
   - **Coffee:** 0 points (no coffee words)
   - ... and so on

4. **Model picks winner:** Tech (1.8 points is highest)

5. **Model calculates confidence:** 95% confident it's Tech

6. **Result:** Transaction auto-categorized as "Tech" with 95% confidence

### **Where It's Used:**
- **Transactions Page** → QuickEntry component
- When you type a transaction, it automatically suggests the category
- Shows confidence percentage (e.g., "95% confidence")

### **Real Example:**
```
Input: "Starbucks Coffee 450"
Model thinks:
- Has "coffee" word? ✓ (+0.95)
- Amount is small? ✓ (+0.8)
- Merchant is Starbucks? ✓ (+0.3)
Total: 2.05 points for Coffee category

Result: Category = "Coffee", Confidence = 98%
```

---

## 2. 📈 Spending Forecasting Model

### **What It Does:**
Predicts how much you'll spend in the future and when your budget will run out.

### **How It Was "Trained":**
The model learned to recognize spending patterns:
- How often you spend in each category
- How much you typically spend
- Whether your spending is increasing or decreasing
- Seasonal patterns (e.g., more spending in December)

### **How It Works (Step by Step):**

1. **Looks at your history:**
   - Finds all "Dining" transactions
   - Calculates: You spent 18,500 UGX in last 30 days
   - That's 616 UGX per day on average

2. **Calculates trend:**
   - Recent 5 transactions: Average 2,200 UGX
   - Older 5 transactions: Average 1,850 UGX
   - Trend: Increasing by 19% (spending more!)

3. **Predicts future:**
   - Base prediction: 18,500 UGX/month
   - Apply trend: 18,500 × 1.19 = 22,015 UGX/month (accounting for increase)
   - Seasonal factor: December? Add 15% = 25,317 UGX/month

4. **Calculates when budget runs out:**
   - You allocated: 10,000 UGX
   - You've spent: 9,800 UGX
   - Remaining: 200 UGX
   - Daily spending: 25,317 / 30 = 844 UGX/day
   - Days left: 200 ÷ 844 = 0.24 days (less than 1 day!)

5. **Assesses risk:**
   - Less than 1 day left = **HIGH RISK** ⚠️

6. **Result:**
   - Predicted spending: 25,317 UGX/month
   - Days until depletion: 0.24 days
   - Risk level: HIGH
   - Trend: INCREASING

### **Where It's Used:**
- **Flux Pods Page** → Shows "X days left" with AI predictions
- Updates in real-time as you spend
- Shows trend arrows (↑ increasing, ↓ decreasing, → stable)

### **Real Example:**
```
Your "Entertainment" pod:
- Allocated: 15,000 UGX
- Spent: 12,500 UGX
- Historical average: 13,000 UGX/month
- Trend: Increasing 12%

AI Prediction:
- Next month: 14,560 UGX (13,000 × 1.12)
- Days left: 4 days
- Risk: HIGH (spending too fast!)
- Recommendation: "Consider reducing spending or increasing budget"
```

---

## 3. 💰 Budget Allocation Model

### **What It Does:**
Suggests how much money you should allocate to each spending category (Flux Pod).

### **How It Was "Trained":**
The model learned from:
- Your historical spending patterns
- Your income level
- Your financial goals
- Typical budget proportions

### **How It Works (Step by Step):**

1. **Analyzes your spending history:**
   - Last 3 months: You spent 25,000 UGX/month on Dining
   - Last 3 months: You spent 8,000 UGX/month on Transport
   - Last 3 months: You spent 12,000 UGX/month on Shopping

2. **Calculates your income:**
   - Monthly income: 280,000 UGX
   - Goal contributions: 40,000 UGX
   - Safety buffer (10%): 28,000 UGX
   - Available for allocation: 212,000 UGX

3. **Suggests allocations:**
   - **Dining:** 25,000 × 1.1 = 27,500 UGX (10% buffer for safety)
   - **Transport:** 8,000 × 1.1 = 8,800 UGX
   - **Shopping:** 12,000 × 1.1 = 13,200 UGX
   - Total suggested: 49,500 UGX

4. **Checks if it fits:**
   - Total (49,500) < Available (212,000)? ✓ Yes, fits!
   - Risk: LOW (plenty of room)

5. **Provides reasoning:**
   - "Based on your historical Dining spending of 25,000 UGX/month"
   - "Increased by 10% for safety buffer"

### **Where It's Used:**
- **Flux Pods Page** → "New Pod" dialog
- When you type a pod name, it suggests an amount
- Shows reasoning: "Based on your historical spending..."

### **Real Example:**
```
You type: "Entertainment"

Model thinks:
- Matches "Entertainment" category
- Your history: You spent 15,000 UGX/month on entertainment
- Suggests: 17,250 UGX (15,000 × 1.15 for 15% buffer)

Shows:
"Based on your historical Entertainment spending of 15,000 UGX/month"
[Button: Use Suggested: 17,250 UGX]
```

---

## 4. 🎯 Goal Achievement Prediction Model

### **What It Does:**
Predicts whether you'll achieve your financial goals on time and how likely you are to succeed.

### **How It Was "Trained":**
The model learned from:
- Historical goal completion patterns
- Contribution consistency
- Spending variability
- Income stability

### **How It Works (Step by Step):**

1. **Gets your goal info:**
   - Target: 300,000 UGX
   - Current: 245,000 UGX
   - Remaining: 55,000 UGX
   - Monthly contribution: 25,000 UGX
   - Deadline: 60 days away

2. **Calculates basic math:**
   - At current rate: 55,000 ÷ 25,000 = 2.2 months to complete
   - Deadline: 60 days = 2 months
   - Problem: Need 2.2 months but only have 2 months!

3. **Runs Monte Carlo simulation (1,000 scenarios):**
   - Simulates 1,000 different futures:
     - Scenario 1: Contribution varies by 10%, completes in 2.1 months → SUCCESS ✓
     - Scenario 2: Contribution varies by 10%, completes in 2.3 months → FAILURE ✗
     - Scenario 3: Spending increases, completes in 2.4 months → FAILURE ✗
     - ... (997 more scenarios)

4. **Counts successes:**
   - Out of 1,000 scenarios, 780 completed on time
   - Success rate: 780 ÷ 1,000 = 78% probability

5. **Identifies risks:**
   - Current contribution (25,000) < Required (27,500) → RISK
   - Low probability (78% < 90%) → RISK
   - Tight deadline (60 days) → RISK

6. **Suggests improvements:**
   - Recommended: 30,250 UGX/month (10% buffer)
   - If you reduce "Dining" by 20%, save 5,000 UGX/month
   - This would save 12 days!

7. **Result:**
   - Success probability: 78%
   - Predicted completion: 2.2 months
   - Success likelihood: HIGH (78% is good)
   - Risk factors: 3 identified
   - Acceleration opportunities: 2 suggestions

### **Where It's Used:**
- **Goals Page** → Each goal card shows AI prediction
- Shows success probability badge (e.g., "78% success")
- "What-if" analysis uses this model

### **Real Example:**
```
Goal: "Emergency Fund"
- Target: 300,000 UGX
- Current: 245,000 UGX
- Monthly: 25,000 UGX
- Deadline: 60 days

AI Prediction:
- Success probability: 78%
- Predicted completion: 66 days (6 days late)
- Risk: "Current contribution below required rate"
- Recommendation: Increase to 30,250 UGX/month
- If you reduce Dining by 20%: Save 12 days!
```

---

## 5. 🚨 Anomaly Detection Model

### **What It Does:**
Detects unusual or suspicious transactions that don't match your normal spending patterns.

### **How It Was "Trained":**
The model learned what "normal" looks like:
- Your typical transaction amounts
- Your usual merchants
- Your spending frequency
- Patterns that indicate duplicates or fraud

### **How It Works (Step by Step):**

1. **Gets a new transaction:**
   - Description: "Amazon Purchase"
   - Amount: 150,000 UGX
   - Category: Shopping
   - Date: Today

2. **Looks at your history:**
   - All "Shopping" transactions: 2,499, 1,500, 3,200, 1,800 UGX
   - Average: 2,250 UGX
   - Standard deviation: 650 UGX

3. **Calculates Z-score (how unusual):**
   - Your transaction: 150,000 UGX
   - Average: 2,250 UGX
   - Difference: 147,750 UGX
   - Z-score: 147,750 ÷ 650 = 227 standard deviations!
   - **This is EXTREMELY unusual!** (Normal is 0-3)

4. **Checks for duplicates:**
   - Same day, same amount? No duplicates found

5. **Checks merchant pattern:**
   - First time with this merchant? No, you've used Amazon before
   - But amount is 60x your average → ANOMALY!

6. **Determines severity:**
   - Z-score > 3 = HIGH severity
   - Reason: "Amount (150,000 UGX) is 227x the average for Shopping - Unusually large transaction"

7. **Result:**
   - Is anomaly: YES
   - Severity: HIGH
   - Reason: "Unusually large transaction"
   - Action: "Please verify this transaction is correct"

### **Where It's Used:**
- **Transactions Page** → Every transaction is checked
- Shows red/yellow alert badge if anomaly detected
- Helps catch fraud, duplicates, or mistakes

### **Real Example:**
```
Normal: You usually spend 2,500 UGX at Amazon
Today: You spent 150,000 UGX at Amazon

Model thinks:
- Average: 2,500 UGX
- Your amount: 150,000 UGX
- Z-score: 227 (extremely high!)
- Severity: HIGH
- Reason: "Unusually large transaction - verify this is correct"

Shows: Red alert badge on transaction
```

---

## 🔄 How All Models Work Together

### **The AI Service (Central Command)**

The AI Service is like a manager that coordinates all models:

1. **Initialization:**
   - When app loads, it collects all your transactions
   - Stores them as "training data"
   - Sets your monthly income

2. **When you add a transaction:**
   ```
   User → AI Service → Transaction Categorizer → Category
                  ↓
            Anomaly Detector → Is it unusual?
   ```

3. **When you view Flux Pods:**
   ```
   User → AI Service → Spending Forecaster → Predictions
                  ↓
            Budget Allocator → Suggestions
   ```

4. **When you view Goals:**
   ```
   User → AI Service → Goal Predictor → Success probability
   ```

### **Real-World Flow Example:**

**Scenario: You add a transaction "Paid 45k to Amazon for laptop"**

1. **Transaction Categorizer** runs:
   - Analyzes: "amazon", "laptop", 45,000 UGX
   - Result: "Tech" category (95% confidence)

2. **Anomaly Detector** runs:
   - Compares 45,000 UGX to your average Tech spending
   - Your average: 5,000 UGX
   - Z-score: 8 (high but reasonable for a laptop)
   - Result: Not an anomaly (laptops are expensive)

3. **Spending Forecaster** updates:
   - Recalculates Tech pod predictions
   - Updates "days left" estimate

4. **Goal Predictor** updates:
   - If this affects your savings, recalculates goal probabilities

5. **UI Updates:**
   - Transaction shows "Tech" category
   - Shows "AI" badge
   - No anomaly alert (it's normal)
   - Flux Pods update predictions
   - Goals update success probabilities

---

## 📊 Model Accuracy & Confidence

### **How Models Express Uncertainty:**

1. **Confidence Scores (0-100%):**
   - 95% = Very confident
   - 75% = Confident
   - 50% = Uncertain
   - 25% = Not confident

2. **Confidence Intervals:**
   - "You'll spend between 20,000-30,000 UGX"
   - Shows the range of possible outcomes

3. **Risk Levels:**
   - LOW = Safe, everything looks good
   - MEDIUM = Some caution needed
   - HIGH = Action required!

### **Why Models Might Be Wrong:**

1. **Not enough data:**
   - New user with few transactions
   - Model says: "Limited data, using estimates"

2. **Unusual patterns:**
   - You suddenly change spending habits
   - Model needs time to learn new patterns

3. **Edge cases:**
   - Very unusual transactions
   - Model might misclassify

4. **Seasonal changes:**
   - Holiday spending spikes
   - Model adjusts but might be off initially

---

## 🎓 Learning & Improvement

### **How Models Learn:**

1. **From your corrections:**
   - You change a category → Model learns
   - Next time, it remembers your preference

2. **From your patterns:**
   - As you add more transactions, models get smarter
   - They learn YOUR specific spending habits

3. **From your feedback:**
   - If you ignore suggestions, models adjust
   - They learn what works for YOU

### **Continuous Improvement:**

- **Week 1:** Models use general patterns
- **Month 1:** Models learn your specific habits
- **Month 3:** Models are highly personalized
- **Month 6+:** Models are experts on YOUR finances

---

## 🔍 Technical Details (Simplified)

### **What "Training" Means:**

In real AI, training means:
1. Show model thousands of examples
2. Model learns patterns
3. Model adjusts internal "weights"
4. Model gets better at predictions

In our system (simulated):
- We use pre-defined patterns (like rules)
- These patterns simulate what a trained model would do
- Results are realistic but not from actual machine learning

### **What "Weights" Mean:**

Think of weights like importance scores:
- "Coffee" word in description = 0.95 weight (very important!)
- Amount size = 0.3 weight (somewhat important)
- Merchant name = 0.2 weight (less important)

Higher weight = more influence on the decision.

### **What "Features" Mean:**

Features are clues the model looks at:
- Description text
- Amount
- Merchant name
- Date/time
- Your history

Like a detective gathering clues to solve a case!

---

## 💡 Key Takeaways

1. **Each model is a specialist:**
   - Categorizer = Filing clerk
   - Forecaster = Fortune teller
   - Allocator = Financial advisor
   - Predictor = Success calculator
   - Detector = Security guard

2. **Models work together:**
   - All connected through AI Service
   - Share your transaction data
   - Update in real-time

3. **Models learn from you:**
   - More data = Better predictions
   - Your corrections = Better accuracy
   - Time = More personalized

4. **Models show confidence:**
   - Not always 100% certain
   - Express uncertainty clearly
   - Let you make final decisions

5. **Models are helpful, not perfect:**
   - They suggest, you decide
   - They learn from mistakes
   - They improve over time

---

## 🎯 Summary

**Transaction Categorizer:** "This looks like Coffee to me (95% sure)"

**Spending Forecaster:** "You'll spend 25,000 UGX next month, budget runs out in 4 days!"

**Budget Allocator:** "Based on your history, I suggest 27,500 UGX for Dining"

**Goal Predictor:** "You have a 78% chance of success, but increase contribution to be safe"

**Anomaly Detector:** "This transaction is unusual - please verify!"

All working together to make your financial life easier! 🚀

---

**Remember:** These are AI assistants, not replacements for your judgment. They provide insights, but you make the final decisions!

