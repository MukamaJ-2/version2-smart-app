# Complete Guide: How Each AI Model is Trained and Used

## 📚 Table of Contents

1. [Overview](#overview)
2. [Model 1: Transaction Categorizer](#model-1-transaction-categorizer)
3. [Model 2: Spending Forecaster](#model-2-spending-forecaster)
4. [Model 3: Budget Allocator](#model-3-budget-allocator)
5. [Model 4: Goal Predictor](#model-4-goal-predictor)
5. [Model 5: Anomaly Detector](#model-5-anomaly-detector)
6. [AI Service Layer](#ai-service-layer)
7. [Data Flow Architecture](#data-flow-architecture)
8. [Integration Examples](#integration-examples)

---

## Overview

UniGuard Wallet uses **5 trained AI models** that work together to provide intelligent financial insights. All models are currently **simulated** (using rule-based algorithms that mimic real ML models) but are designed to be easily replaced with actual trained models.

---

## Model 1: Transaction Categorizer

### 🎯 Purpose
Automatically categorizes transactions based on description, amount, and merchant name.

### 📚 How It's Trained (Simulated)

**Training Process:**
```typescript
// Simulated training (train.ts)
1. Epochs: 10 iterations
2. Starting accuracy: 30%
3. Final accuracy: 95%
4. Loss decreases from 1.0 to 0.1
```

**Training Data:**
- Historical transactions with known categories
- Features extracted: description keywords, amounts, merchant names
- Pattern learning: "Starbucks" → Coffee, "Amazon + large amount" → Tech

**Model Weights (Learned Patterns):**
```typescript
Coffee: {
  hasCoffee: 0.95,      // Strong indicator
  amount: -0.3,         // Negative (coffee is usually small)
  isSmall: 0.8         // Small amounts are common
}
Tech: {
  hasTech: 0.9,
  amount: 0.5,          // Positive (tech is expensive)
  isLarge: 0.7,
  hasShopping: 0.3      // Amazon can be tech
}
```

### 🔧 How It Works Internally

**Step-by-Step Process:**

1. **Feature Extraction** (`training-data.ts`)
   ```typescript
   Input: "Paid 45k to Amazon for laptop"
   
   Features extracted:
   - hasCoffee: false
   - hasFood: false
   - hasShopping: true (Amazon keyword)
   - hasTech: true (laptop keyword)
   - amount: 45000
   - isLarge: true (45000 > 10000)
   - merchant: "amazon"
   ```

2. **Score Calculation** (`transaction-categorizer.ts:100-143`)
   ```typescript
   For each category:
     score = Σ(weight × feature_value)
     
   Example for "Tech":
     score = 0.9 × hasTech (true)      = 0.9
           + 0.5 × normalized(45000)   = 0.45
           + 0.7 × isLarge (true)      = 0.7
           + 0.3 × hasShopping (true)  = 0.3
           + 0.4 (Amazon + large amount bonus)
     Total = 2.75
   ```

3. **Confidence Calculation** (Softmax normalization)
   ```typescript
   confidence = exp(score) / Σ(exp(all_scores))
   // Ensures probabilities sum to 1
   ```

4. **Result**
   ```typescript
   {
     category: "Tech",
     confidence: 0.95,  // 95% sure
     alternatives: [
       { category: "Shopping", confidence: 0.03 },
       { category: "Other", confidence: 0.02 }
     ]
   }
   ```

### 🎨 How It's Used in the App

**Location:** `src/pages/Transactions.tsx`

**Integration Points:**

1. **QuickEntry Component** (Line 89-125)
   ```typescript
   // User types: "Paid 45k to Amazon for laptop"
   const parsed = parseNaturalLanguage(input);
   // Calls AI service
   const aiResult = aiService.categorizeTransaction(
     parsed.description, 
     parsed.amount, 
     merchant
   );
   // Auto-fills category with 95% confidence badge
   ```

2. **Transaction List** (Line 516-520)
   ```typescript
   // Shows AI badge on all transactions
   <Badge variant="outline">
     <Sparkles /> AI
   </Badge>
   ```

**User Flow:**
```
User types transaction → AI extracts features → 
Model calculates scores → Returns category + confidence → 
UI displays with AI badge
```

---

## Model 2: Spending Forecaster

### 🎯 Purpose
Predicts future spending patterns and when Flux Pods will be depleted.

### 📚 How It's Trained (Simulated)

**Training Process:**
```typescript
// Simulated LSTM training (train.ts)
1. Epochs: 15 iterations
2. Starting MSE: 50,000
3. Final MSE: 5,000
4. Learns: Spending patterns, trends, seasonality
```

**Training Data:**
- Historical transactions by category
- Time series data (dates, amounts)
- Seasonal patterns (December = 1.15x multiplier)

**What It Learns:**
- Average spending per category
- Spending velocity (transactions per day)
- Trend patterns (increasing/decreasing)
- Seasonal factors (holiday spending)

### 🔧 How It Works Internally

**Step-by-Step Process:**

1. **Data Filtering** (`spending-forecaster.ts:30-47`)
   ```typescript
   // Filter transactions for category
   const categoryTx = historicalTransactions.filter(
     tx => tx.category === "Dining" && tx.type === "expense"
   );
   ```

2. **Calculate Base Metrics** (Line 49-60)
   ```typescript
   // Average transaction amount
   averageTransaction = totalSpent / transactionCount
   
   // Spending velocity (transactions per day)
   timeSpan = (lastDate - firstDate) / days
   transactionsPerDay = transactionCount / timeSpan
   
   // Base monthly prediction
   baseMonthlySpending = averageTransaction × transactionsPerDay × 30
   ```

3. **Trend Analysis** (Line 62-81)
   ```typescript
   // Compare recent vs older transactions
   recentAvg = average of last 5 transactions
   olderAvg = average of previous 5 transactions
   
   trendChange = (recentAvg - olderAvg) / olderAvg
   
   if (trendChange > 0.1) trend = "increasing"
   else if (trendChange < -0.1) trend = "decreasing"
   else trend = "stable"
   
   // Apply trend to prediction
   predictedAmount = baseMonthlySpending × (1 + trendChange)
   ```

4. **Seasonal Adjustment** (Line 83-91)
   ```typescript
   currentMonth = new Date().getMonth()
   seasonalMultipliers = {
     11: 1.15,  // December (holidays)
     0: 1.1,    // January (new year)
     9: 1.05    // October (pre-holiday)
   }
   predictedAmount *= seasonalMultipliers[currentMonth]
   ```

5. **Confidence Interval** (Line 93-96)
   ```typescript
   // Calculate variance and standard deviation
   variance = Σ(amount - mean)² / count
   stdDev = √variance
   confidenceMargin = stdDev × 1.96  // 95% confidence
   
   confidenceInterval = {
     lower: predictedAmount - confidenceMargin,
     upper: predictedAmount + confidenceMargin
   }
   ```

6. **Depletion Prediction** (Line 98-101)
   ```typescript
   remaining = allocated - spent
   dailySpending = predictedAmount / 30
   daysUntilDepletion = remaining / dailySpending
   ```

7. **Risk Assessment** (Line 103-110)
   ```typescript
   utilizationRate = spent / allocated
   
   if (utilizationRate > 0.8 || daysUntilDepletion < 7)
     riskLevel = "high"
   else if (utilizationRate < 0.5 && daysUntilDepletion > 20)
     riskLevel = "low"
   else
     riskLevel = "medium"
   ```

### 🎨 How It's Used in the App

**Location:** `src/pages/FluxPods.tsx`

**Integration Points:**

1. **Pod Cards** (Line 394-404)
   ```typescript
   // When Flux Pods page loads
   useEffect(() => {
     fluxPods.forEach(pod => {
       const forecast = aiService.forecastSpending(
         pod.name,
         pod.allocated,
         pod.spent
       );
       // Updates velocity with AI prediction
       // Shows trend indicator (↑/↓/→)
       // Displays risk level
     });
   }, [fluxPods]);
   ```

2. **Display** (Line 396-403)
   ```typescript
   <div>
     <TrendingDown /> {forecast.daysUntilDepletion}d left
     <Badge>AI</Badge>  // Shows AI-powered prediction
   </div>
   ```

**User Flow:**
```
User views Flux Pod → AI analyzes historical spending → 
Calculates trend & seasonality → Predicts depletion date → 
Shows days left with confidence interval
```

---

## Model 3: Budget Allocator

### 🎯 Purpose
Suggests optimal budget allocations for Flux Pods based on historical spending patterns.

### 📚 How It's Trained (Simulated)

**Training Process:**
- Uses historical spending data
- Learns spending patterns per category
- Optimizes allocation to match spending + safety buffer
- No explicit training epochs (rule-based optimization)

**What It Learns:**
- Average monthly spending per category
- Spending proportions
- Safety buffer requirements (10-15%)

### 🔧 How It Works Internally

**Step-by-Step Process:**

1. **Calculate Historical Spending** (`budget-allocator.ts:36-51`)
   ```typescript
   // Group transactions by category
   categorySpending = {
     "Dining": { total: 15000, count: 12, avg: 1250 },
     "Transport": { total: 8000, count: 20, avg: 400 },
     ...
   }
   ```

2. **Normalize to Monthly** (Line 53-59)
   ```typescript
   timeSpan = (lastDate - firstDate) / days
   monthlySpendingTotal = Σ(category.total / timeSpan × 30)
   ```

3. **Calculate Available Budget** (Line 61-69)
   ```typescript
   totalGoalContributions = Σ(goal.monthlyContribution)
   buffer = monthlyIncome × 0.1  // 10% safety buffer
   allocatable = monthlyIncome - totalGoalContributions - buffer
   ```

4. **Generate Suggestions** (Line 75-107)
   ```typescript
   categories.forEach(category => {
     historicalMonthly = (category.total / timeSpan) × 30
     
     // Suggested = historical + 10% buffer
     suggestedAmount = historicalMonthly × 1.1
     
     // Confidence based on data quality
     confidence = 0.5 + (count / 10) × 0.3 + (timeSpan / 90) × 0.2
     
     reasoning = `Based on your historical spending of ${historicalMonthly} UGX/month`
   });
   ```

5. **Scale if Over Budget** (Line 112-123)
   ```typescript
   if (totalSuggested > allocatable) {
     scaleFactor = allocatable / totalSuggested
     // Scale all suggestions proportionally
     allocations.forEach(alloc => {
       alloc.suggestedAmount *= scaleFactor
     });
   }
   ```

6. **Risk Assessment** (Line 125-132)
   ```typescript
   utilizationRate = totalSuggested / allocatable
   
   if (utilizationRate > 0.95) riskAssessment = "high"
   else if (utilizationRate < 0.7) riskAssessment = "low"
   else riskAssessment = "medium"
   ```

### 🎨 How It's Used in the App

**Location:** `src/pages/FluxPods.tsx`

**Integration Points:**

1. **New Pod Dialog** (Line 503-580)
   ```typescript
   // When user types pod name
   useEffect(() => {
     if (name.length > 2) {
       const suggestion = aiService.suggestNewPodAllocation(
         name,           // "Entertainment"
         availableBudget,
         existingPods
       );
       
       // Auto-fills suggested amount
       setAllocated(suggestion.suggestedAmount);
     }
   }, [name]);
   ```

2. **Display Suggestion** (Line 554-567)
   ```typescript
   {aiSuggestion && (
     <div className="ai-suggestion-box">
       <Sparkles /> AI Suggestion
       <p>{aiSuggestion.reasoning}</p>
       <Button onClick={() => setAllocated(aiSuggestion.amount)}>
         Use Suggested: {formatCurrency(aiSuggestion.amount)}
       </Button>
     </div>
   )}
   ```

**User Flow:**
```
User creates new pod → Types name → AI matches to category → 
Analyzes historical spending → Suggests amount with reasoning → 
User accepts or modifies
```

---

## Model 4: Goal Predictor

### 🎯 Purpose
Predicts probability of achieving financial goals on time using Monte Carlo simulation.

### 📚 How It's Trained (Simulated)

**Training Process:**
```typescript
// Simulated training (train.ts)
1. Epochs: 12 iterations
2. Starting accuracy: 40%
3. Final accuracy: 92%
4. Learns: Goal completion patterns, contribution variability
```

**What It Learns:**
- Contribution variability patterns
- Spending impact on savings
- Goal completion probabilities
- Risk factors

### 🔧 How It Works Internally

**Step-by-Step Process:**

1. **Calculate Base Metrics** (`goal-predictor.ts:40-54`)
   ```typescript
   remaining = targetAmount - currentAmount
   daysUntilDeadline = (deadline - now) / days
   monthsUntilDeadline = daysUntilDeadline / 30
   
   requiredMonthly = remaining / monthsUntilDeadline
   monthsAtCurrentRate = remaining / currentContribution
   ```

2. **Monte Carlo Simulation** (Line 56-78)
   ```typescript
   // Run 1000 simulations
   for (i = 0; i < 1000; i++) {
     // Add randomness to contribution (10% variability)
     simulatedContribution = currentContribution × 
       (1 + (random - 0.5) × 0.2)
     
     // Simulate spending changes (5% variability)
     effectiveContribution = simulatedContribution × 
       (1 - (random - 0.5) × 0.1)
     
     simulatedMonths = remaining / effectiveContribution
     simulatedCompletion = now + simulatedMonths
     
     if (simulatedCompletion <= deadline) {
       successCount++
     }
   }
   
   completionProbability = successCount / 1000
   ```

3. **Confidence Interval** (Line 80-88)
   ```typescript
   stdDev = monthsAtCurrentRate × 0.15  // 15% standard deviation
   lowerMonths = monthsAtCurrentRate - 1.96 × stdDev
   upperMonths = monthsAtCurrentRate + 1.96 × stdDev
   
   confidenceInterval = {
     lower: now + lowerMonths,
     upper: now + upperMonths
   }
   ```

4. **Risk Factors** (Line 90-100)
   ```typescript
   if (currentContribution < requiredMonthly × 0.9)
     riskFactors.push("Below required rate")
   
   if (completionProbability < 0.7)
     riskFactors.push("Low probability")
   
   if (daysUntilDeadline < 60 && remaining > currentAmount)
     riskFactors.push("Tight deadline")
   ```

5. **Recommended Contribution** (Line 102-106)
   ```typescript
   recommendedContribution = max(
     requiredMonthly × 1.1,      // 10% buffer
     currentContribution × 1.05   // At least 5% increase
   )
   ```

6. **Success Likelihood** (Line 108-114)
   ```typescript
   if (probability >= 0.9) → "very-high"
   else if (probability >= 0.75) → "high"
   else if (probability >= 0.5) → "medium"
   else if (probability >= 0.25) → "low"
   else → "very-low"
   ```

7. **Acceleration Opportunities** (Line 116-144)
   ```typescript
   // Analyze spending patterns
   topCategories = top 3 spending categories
   
   topCategories.forEach(category => {
     monthlyAmount = category.total / 30 × 30
     potentialSavings = monthlyAmount × 0.2  // 20% reduction
     daysSaved = (potentialSavings / recommendedContribution) × 30
     
     if (daysSaved > 5) {
       accelerationOpportunities.push({
         action: `Reduce ${category} spending by 20%`,
         impact: daysSaved,
         confidence: 0.7
       });
     }
   });
   ```

### 🎨 How It's Used in the App

**Location:** `src/pages/Goals.tsx`

**Integration Points:**

1. **Goal Cards** (Line 716-770)
   ```typescript
   // When Goals page loads
   useEffect(() => {
     goals.forEach(goal => {
       const prediction = aiService.predictGoal(
         goal,
         activeGoals
       );
       
       // Stores prediction
       predictions[goal.id] = {
         probability: prediction.completionProbability,
         monthsToComplete: prediction.monthsToComplete,
         successLikelihood: prediction.successLikelihood
       };
     });
   }, [goals]);
   ```

2. **Display** (Line 535-541)
   ```typescript
   <div>
     <config.icon /> {config.label}
     <Clock /> {days} days left
     <Badge>
       <Sparkles /> {Math.round(probability × 100)}% success
     </Badge>
   </div>
   ```

3. **What-if Analysis** (Line 222-460)
   ```typescript
   // Uses acceleration opportunities
   accelerationOpportunities.forEach(opp => {
     // Shows: "Reduce Dining spending by 20% → Save 15 days"
   });
   ```

**User Flow:**
```
User views goal → AI runs Monte Carlo simulation → 
Calculates probability → Identifies risk factors → 
Suggests acceleration opportunities → Displays success probability
```

---

## Model 5: Anomaly Detector

### 🎯 Purpose
Detects unusual transactions that might be errors or fraud.

### 📚 How It's Trained (Simulated)

**Training Process:**
- Uses Isolation Forest algorithm (simulated with Z-score)
- Learns normal spending patterns per category
- No explicit training (statistical analysis)

**What It Learns:**
- Mean and standard deviation per category
- Normal transaction amounts
- Duplicate patterns
- Merchant patterns

### 🔧 How It Works Internally

**Step-by-Step Process:**

1. **Check Data Sufficiency** (`anomaly-detector.ts:23-31`)
   ```typescript
   if (historicalTransactions.length < 10) {
     return { isAnomaly: false, reason: "Insufficient data" };
   }
   ```

2. **Filter by Category** (Line 33-46)
   ```typescript
   categoryTx = historicalTransactions.filter(
     tx => tx.category === transaction.category
   );
   
   if (categoryTx.length === 0) {
     // New category = potential anomaly
     return { isAnomaly: true, severity: "medium" };
   }
   ```

3. **Calculate Statistics** (Line 48-52)
   ```typescript
   amounts = categoryTx.map(tx => tx.amount)
   mean = Σ(amounts) / count
   variance = Σ(amount - mean)² / count
   stdDev = √variance
   ```

4. **Z-Score Calculation** (Line 54-86)
   ```typescript
   zScore = |(amount - mean) / stdDev|
   
   if (zScore > 3) {
     // Very unusual (3+ standard deviations)
     isAnomaly = true
     severity = "high"
     anomalyScore = zScore / 5  // Normalize to 0-1
   }
   else if (zScore > 2) {
     // Moderately unusual
     isAnomaly = true
     severity = "medium"
     anomalyScore = zScore / 4
   }
   else if (zScore > 1.5) {
     // Slightly unusual
     isAnomaly = true
     severity = "low"
     anomalyScore = zScore / 3
   }
   ```

5. **Duplicate Detection** (Line 88-101)
   ```typescript
   sameDay = historicalTransactions.filter(
     tx => tx.date === transaction.date &&
           |tx.amount - amount| < 10 &&
           tx.category === category
   );
   
   if (sameDay.length > 0) {
     isAnomaly = true
     severity = "medium"
     reason = "Possible duplicate transaction"
   }
   ```

6. **Merchant Pattern Check** (Line 103-115)
   ```typescript
   merchantTx = historicalTransactions.filter(
     tx => tx.merchant === transaction.merchant
   );
   
   if (merchantTx.length === 0 && amount > mean × 1.5) {
     // First transaction with new merchant + large amount
     isAnomaly = true
     severity = "medium"
     reason = "First transaction with [merchant] - verify"
   }
   ```

### 🎨 How It's Used in the App

**Location:** `src/pages/Transactions.tsx`

**Integration Points:**

1. **Transaction Detection** (Line 244-260)
   ```typescript
   // When transactions load
   useEffect(() => {
     transactions.forEach(tx => {
       const result = aiService.detectAnomaly(tx);
       
       if (result.isAnomaly) {
         anomalies[tx.id] = {
           isAnomaly: true,
           severity: result.severity,
           reason: result.reason
         };
       }
     });
   }, [transactions]);
   ```

2. **Display Alert** (Line 516-530)
   ```typescript
   {anomalies[tx.id]?.isAnomaly && (
     <Badge 
       className={
         severity === "high" ? "border-destructive" :
         severity === "medium" ? "border-warning" :
         "border-muted"
       }
       title={anomalies[tx.id].reason}
     >
       <AlertTriangle /> AI Alert
     </Badge>
   )}
   ```

**User Flow:**
```
Transaction added → AI calculates Z-score → 
Checks for duplicates → Analyzes merchant patterns → 
Flags if anomalous → Shows alert badge with severity
```

---

## AI Service Layer

### 🎯 Purpose
Centralized interface for all AI models, manages data and provides unified API.

### 🔧 How It Works

**Architecture:**
```typescript
class AIService {
  private historicalTransactions: TrainingTransaction[]
  private monthlyIncome: number
  
  // Initialize with user data
  initialize(transactions, income)
  
  // Model interfaces
  categorizeTransaction(...)
  forecastSpending(...)
  suggestBudgetAllocation(...)
  predictGoal(...)
  detectAnomaly(...)
  
  // Dashboard insights
  getDashboardInsights()
}
```

**Data Flow:**
```
User Data → AIService.initialize() → 
Stored in memory → Models access when needed → 
Predictions returned → UI displays
```

**Usage Pattern:**
```typescript
// 1. Initialize (once per page load)
aiService.initialize(transactions, 280000);

// 2. Use models
const category = aiService.categorizeTransaction(description, amount);
const forecast = aiService.forecastSpending(category, allocated, spent);
const prediction = aiService.predictGoal(goal, activeGoals);
```

---

## Data Flow Architecture

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERACTION                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              UI COMPONENT (React Page)                   │
│  - Transactions.tsx                                      │
│  - FluxPods.tsx                                         │
│  - Goals.tsx                                             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  AI SERVICE LAYER                       │
│              (ai-service.ts)                            │
│  - Manages historical data                              │
│  - Routes requests to models                            │
│  - Provides unified API                                 │
└───────┬───────────┬───────────┬───────────┬─────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Categorizer│ │Forecaster│ │ Allocator│ │ Predictor│
└────┬──────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │              │            │            │
     ▼              ▼            ▼            ▼
┌─────────────────────────────────────────────────────────┐
│              TRAINING DATA                              │
│         (training-data.ts)                              │
│  - Feature extraction                                   │
│  - Data normalization                                   │
│  - Pattern recognition                                   │
└─────────────────────────────────────────────────────────┘
```

### Step-by-Step Example: Adding a Transaction

```
1. User types: "Paid 45k to Amazon for laptop"
   ↓
2. Transactions.tsx → parseNaturalLanguage()
   ↓
3. Extracts: amount=45000, merchant="Amazon", description
   ↓
4. aiService.categorizeTransaction(description, amount, merchant)
   ↓
5. Transaction Categorizer:
   - Extracts features (hasTech=true, amount=45000, isLarge=true)
   - Calculates scores (Tech=2.75, Shopping=1.2, Other=0.5)
   - Returns: {category: "Tech", confidence: 0.95}
   ↓
6. aiService.detectAnomaly(transaction)
   ↓
7. Anomaly Detector:
   - Calculates Z-score (if amount unusual)
   - Checks for duplicates
   - Returns: {isAnomaly: false}
   ↓
8. UI displays:
   - Category: "Tech" (auto-filled)
   - Confidence badge: "95%"
   - AI badge: ✨
   ↓
9. Transaction saved
   ↓
10. Historical data updated → Models learn from new data
```

---

## Integration Examples

### Example 1: Creating a New Flux Pod

```typescript
// User types "Entertainment" in New Pod dialog

1. useEffect triggers when name changes
   ↓
2. aiService.suggestNewPodAllocation("Entertainment", ...)
   ↓
3. Budget Allocator:
   - Matches "Entertainment" to category
   - Finds historical Entertainment spending
   - Calculates: monthlySpending = 12,000 UGX
   - Suggests: 12,000 × 1.15 = 13,800 UGX
   ↓
4. UI shows:
   <div className="ai-suggestion">
     <Sparkles /> AI Suggestion
     <p>Based on your historical Entertainment spending of 12,000 UGX/month</p>
     <Button>Use Suggested: 13,800 UGX</Button>
   </div>
   ↓
5. User clicks "Use Suggested" → Amount auto-fills
```

### Example 2: Viewing Goal Predictions

```typescript
// User views "Emergency Fund" goal

1. Goals page loads → useEffect runs
   ↓
2. aiService.predictGoal(goal, activeGoals)
   ↓
3. Goal Predictor:
   - Calculates: remaining = 55,000, monthsAtCurrentRate = 2.2
   - Runs Monte Carlo: 1000 simulations
   - Success count: 850 → probability = 0.85
   - Risk factors: None (on track)
   - Acceleration: "Reduce Dining by 20% → Save 8 days"
   ↓
4. UI displays:
   <Badge>
     <Sparkles /> 85% success
   </Badge>
   <span>Predicted: 2.2 months</span>
   ↓
5. What-if Analysis shows acceleration opportunities
```

### Example 3: Anomaly Detection

```typescript
// User adds transaction: "Coffee Shop - 15,000 UGX"

1. Transaction added to list
   ↓
2. useEffect detects new transaction
   ↓
3. aiService.detectAnomaly(transaction)
   ↓
4. Anomaly Detector:
   - Filters Coffee category transactions
   - Calculates: mean = 450, stdDev = 120
   - Z-score: |(15000 - 450) / 120| = 121.25
   - Z-score > 3 → HIGH SEVERITY
   ↓
5. UI displays:
   <Badge className="border-destructive">
     <AlertTriangle /> AI Alert
   </Badge>
   Tooltip: "Amount (15,000 UGX) is 121.3x the average for Coffee - Unusually large transaction"
   ↓
6. User can verify or correct
```

---

## Summary

### Model Comparison

| Model | Type | Training | Input | Output | Used In |
|-------|------|----------|-------|--------|---------|
| **Categorizer** | Classification | 10 epochs, 95% accuracy | Description, Amount, Merchant | Category + Confidence | Transactions (QuickEntry) |
| **Forecaster** | Time Series | 15 epochs, MSE: 5,000 | Historical transactions, Current spending | Predicted amount, Trend, Days left | Flux Pods (velocity) |
| **Allocator** | Optimization | Rule-based | Historical spending, Income, Goals | Suggested allocations | Flux Pods (New Pod) |
| **Predictor** | Monte Carlo | 12 epochs, 92% accuracy | Goal data, Historical transactions | Probability, Risk factors | Goals (predictions) |
| **Anomaly** | Statistical | Z-score based | Transaction, Historical data | Anomaly flag, Severity | Transactions (alerts) |

### Key Features

✅ **All models are initialized** with user's historical data
✅ **Real-time predictions** update as data changes
✅ **Confidence scores** shown for transparency
✅ **Visual indicators** (AI badges, alerts) throughout UI
✅ **Seamless integration** via AI Service layer

---

**This guide explains the complete architecture and flow of all AI models in UniGuard Wallet!** 🚀

