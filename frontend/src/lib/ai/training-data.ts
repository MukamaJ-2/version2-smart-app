/**
 * Training Data Preparation
 * This module prepares and structures data for AI model training
 */

export interface TrainingTransaction {
  description: string;
  amount: number;
  merchant?: string;
  category: string;
  type: "income" | "expense";
  date: string;
  userPattern?: string; // User's typical behavior
}

export interface TrainingSpendingPattern {
  category: string;
  amounts: number[];
  dates: string[];
  frequencies: number[]; // Transactions per week
  seasonalFactors: Record<string, number>; // Month -> multiplier
}

export interface TrainingGoal {
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  deadline: string;
  achieved: boolean;
  actualCompletionDate?: string;
  spendingPatterns: TrainingSpendingPattern[];
}

export interface TrainingBudget {
  category: string;
  allocated: number;
  actualSpent: number[];
  income: number;
  goals: string[];
  success: boolean; // Whether budget was maintained
}

/**
 * Generate synthetic training data based on realistic patterns
 * In production, this would come from actual user data
 */
export function generateTrainingData() {
  // Transaction categorization training data
  const baseTransactions: TrainingTransaction[] = [
    // Coffee/Drinks
    { description: "Starbucks Coffee", amount: 450, merchant: "Starbucks", category: "Coffee", type: "expense", date: "2026-01-11" },
    { description: "Cafe Nero", amount: 380, merchant: "Cafe Nero", category: "Coffee", type: "expense", date: "2026-01-10" },
    { description: "Coffee Shop", amount: 520, merchant: "Local Cafe", category: "Coffee", type: "expense", date: "2026-01-09" },
    
    // Dining
    { description: "Restaurant Dinner", amount: 1850, merchant: "Restaurant", category: "Dining", type: "expense", date: "2026-01-09" },
    { description: "Lunch at Pizza Place", amount: 1200, merchant: "Pizza Place", category: "Dining", type: "expense", date: "2026-01-08" },
    { description: "Fast Food", amount: 650, merchant: "McDonald's", category: "Dining", type: "expense", date: "2026-01-07" },
    
    // Shopping
    { description: "Amazon Purchase", amount: 2499, merchant: "Amazon", category: "Shopping", type: "expense", date: "2026-01-10" },
    { description: "Online Shopping", amount: 1500, merchant: "Online Store", category: "Shopping", type: "expense", date: "2026-01-06" },
    { description: "Clothing Store", amount: 3200, merchant: "Fashion Store", category: "Shopping", type: "expense", date: "2026-01-05" },
    { description: "Supermarket Groceries", amount: 4200, merchant: "Supermarket", category: "Shopping", type: "expense", date: "2026-01-04" },
    { description: "Market Purchase", amount: 1800, merchant: "Local Market", category: "Shopping", type: "expense", date: "2026-01-03" },
    
    // Tech
    { description: "Netflix Subscription", amount: 649, merchant: "Netflix", category: "Tech", type: "expense", date: "2026-01-09" },
    { description: "Software Purchase", amount: 4500, merchant: "App Store", category: "Tech", type: "expense", date: "2026-01-04" },
    { description: "Amazon - Laptop", amount: 45000, merchant: "Amazon", category: "Tech", type: "expense", date: "2026-01-03" },
    { description: "Cloud Subscription", amount: 3000, merchant: "Cloud Provider", category: "Tech", type: "expense", date: "2026-01-02" },
    
    // Transport
    { description: "Uber Ride", amount: 320, merchant: "Uber", category: "Transport", type: "expense", date: "2026-01-10" },
    { description: "Taxi", amount: 450, merchant: "Taxi Service", category: "Transport", type: "expense", date: "2026-01-05" },
    { description: "Fuel Station", amount: 2500, merchant: "Gas Station", category: "Transport", type: "expense", date: "2026-01-02" },
    { description: "Bus Ticket", amount: 200, merchant: "Transit", category: "Transport", type: "expense", date: "2026-01-01" },
    
    // Health
    { description: "Gym Membership", amount: 2500, merchant: "Gym", category: "Health", type: "expense", date: "2026-01-08" },
    { description: "Pharmacy", amount: 1200, merchant: "Pharmacy", category: "Health", type: "expense", date: "2026-01-07" },
    { description: "Doctor Visit", amount: 3500, merchant: "Clinic", category: "Health", type: "expense", date: "2026-01-06" },
    { description: "Hospital Bill", amount: 15000, merchant: "Hospital", category: "Health", type: "expense", date: "2026-01-05" },
    
    // Rent / Housing
    { description: "Rent Payment", amount: 90000, merchant: "Landlord", category: "Rent", type: "expense", date: "2026-01-05" },
    { description: "Paid apartment rent for September", amount: 400000, merchant: "Landlord", category: "Rent", type: "expense", date: "2026-01-04" },
    { description: "Monthly house rent cleared", amount: 350000, merchant: "Landlord", category: "Rent", type: "expense", date: "2026-01-03" },
    
    // Utilities
    { description: "Electricity Bill", amount: 12000, merchant: "Utility Co", category: "Utilities", type: "expense", date: "2026-01-04" },
    { description: "Water bill", amount: 35000, merchant: "Water Utility", category: "Utilities", type: "expense", date: "2026-01-03" },
    { description: "Paid internet subscription", amount: 8000, merchant: "ISP", category: "Utilities", type: "expense", date: "2026-01-02" },
    { description: "Cooking gas refill", amount: 45000, merchant: "Gas Supplier", category: "Utilities", type: "expense", date: "2026-01-01" },
    
    // Food / Groceries
    { description: "Bought groceries for the week", amount: 50000, merchant: "Supermarket", category: "Food", type: "expense", date: "2026-01-03" },
    { description: "Market food shopping", amount: 18000, merchant: "Local Market", category: "Food", type: "expense", date: "2026-01-02" },
    
    // Eating Out
    { description: "Ate lunch at a restaurant", amount: 12000, merchant: "Restaurant", category: "Eating Out", type: "expense", date: "2026-01-02" },
    { description: "Fast food purchase", amount: 8500, merchant: "KFC", category: "Eating Out", type: "expense", date: "2026-01-01" },
    
    // Education
    { description: "Paid school fees", amount: 250000, merchant: "School", category: "Education", type: "expense", date: "2026-01-02" },
    { description: "Bought textbooks", amount: 60000, merchant: "Bookstore", category: "Education", type: "expense", date: "2026-01-01" },
    
    // Communication
    { description: "Bought airtime", amount: 5000, merchant: "Telco", category: "Communication", type: "expense", date: "2026-01-02" },
    { description: "Paid mobile data bundle", amount: 10000, merchant: "Telco", category: "Communication", type: "expense", date: "2026-01-01" },
    
    // Clothing
    { description: "Bought new shoes", amount: 80000, merchant: "Shoe Store", category: "Clothing", type: "expense", date: "2026-01-02" },
    { description: "Clothing shopping", amount: 120000, merchant: "Fashion Store", category: "Clothing", type: "expense", date: "2026-01-01" },
    
    // Entertainment
    { description: "Paid for movie ticket", amount: 15000, merchant: "Cinema", category: "Entertainment", type: "expense", date: "2026-01-02" },
    { description: "Concert ticket purchase", amount: 45000, merchant: "Ticket Vendor", category: "Entertainment", type: "expense", date: "2026-01-01" },
    
    // Personal Care
    { description: "Salon visit payment", amount: 20000, merchant: "Salon", category: "Personal Care", type: "expense", date: "2026-01-02" },
    { description: "Bought toiletries", amount: 15000, merchant: "Supermarket", category: "Personal Care", type: "expense", date: "2026-01-01" },
    
    // Savings
    { description: "Saved 100000 UGX", amount: 100000, merchant: "Bank", category: "Savings", type: "income", date: "2026-01-02" },
    { description: "Deposited money into savings", amount: 75000, merchant: "Bank", category: "Savings", type: "income", date: "2026-01-01" },
    
    // Gifts / Donations
    { description: "Sent money to family", amount: 40000, merchant: "Mobile Money", category: "Gifts / Donations", type: "expense", date: "2026-01-02" },
    { description: "Donated to church", amount: 30000, merchant: "Church", category: "Gifts / Donations", type: "expense", date: "2026-01-01" },
    
    // Insurance
    { description: "Health insurance premium", amount: 120000, merchant: "Insurer", category: "Insurance", type: "expense", date: "2026-01-02" },
    
    // Debt Payments
    { description: "Credit card payment", amount: 150000, merchant: "Bank", category: "Debt Payments", type: "expense", date: "2026-01-01" },
    
    // Miscellaneous
    { description: "Miscellaneous charges", amount: 12000, merchant: "Other", category: "Miscellaneous", type: "expense", date: "2026-01-01" },
    
    // Travel
    { description: "Flight Ticket", amount: 85000, merchant: "Airline", category: "Travel", type: "expense", date: "2026-01-03" },
    { description: "Hotel Booking", amount: 60000, merchant: "Hotel", category: "Travel", type: "expense", date: "2026-01-02" },
    { description: "Vacation Package", amount: 120000, merchant: "Travel Agency", category: "Travel", type: "expense", date: "2026-01-01" },
    
    // Income
    { description: "Salary Deposit", amount: 280000, merchant: "Employer", category: "Income", type: "income", date: "2026-01-11" },
    { description: "Freelance Payment", amount: 45000, merchant: "Client", category: "Income", type: "income", date: "2026-01-07" },
    { description: "Investment Return", amount: 15000, merchant: "Bank", category: "Income", type: "income", date: "2026-01-05" },
  ];

  // Expand dataset with light variations to reduce overfitting
  const transactionTrainingData: TrainingTransaction[] = [];
  const dateOffsets = [0, 1, 2, 3];
  baseTransactions.forEach((tx, index) => {
    dateOffsets.forEach((offset) => {
      const date = new Date(tx.date);
      date.setDate(date.getDate() - offset);
      transactionTrainingData.push({
        ...tx,
        amount: Math.round(tx.amount * (0.9 + (index % 3) * 0.05)),
        date: date.toISOString().split("T")[0],
      });
    });
  });

  return {
    transactions: transactionTrainingData,
    // Add more training data types as needed
  };
}

/**
 * Extract features from transaction for model training
 */
export function extractTransactionFeatures(tx: TrainingTransaction) {
  const description = tx.description.toLowerCase();
  const amount = Math.abs(tx.amount);
  const merchant = tx.merchant?.toLowerCase() || "";
  const text = `${description} ${merchant}`;
  
  return {
    // Text features
    hasCoffee: /coffee|cafe|espresso|latte|starbucks|nero/i.test(text),
    hasShopping: /amazon|purchase|shopping|store|retail|buy|mall|order/i.test(text),
    hasTech: /netflix|software|app|laptop|tech|subscription|saas|cloud/i.test(text),
    hasTransport:
      /uber|bolt|taxify|safeboda|boda|bodaboda|matatu|taxi|farasi|in\s?driver|pioneer|special\s+hire|ride|fuel|petrol|gas|transport|bus|train|metro/i.test(
        text
      ),
    hasHealth: /gym|pharmacy|doctor|health|medical|fitness|clinic|hospital/i.test(text),
    hasHousing: /rent|mortgage|housing|accommodation|apartment|landlord/i.test(text),
    hasTravel: /flight|airline|hotel|airbnb|booking|travel|trip/i.test(text),
    hasIncome: /salary|deposit|payroll|bonus|interest|dividend|refund|reversal|income|received|earned/i.test(text),
    hasUtilities:
      /utility|yaka|sts|electric|electricity|power|water|gas|internet|cable|umeme|nwsc|token|prepaid/i.test(text),
    hasFood:
      /food|groceries|supermarket|market|rice|beans|maize|kitchen|oil|sugar|kikuubo|nakasero|owino|balikuddembe/i.test(
        text
      ),
    hasEatingOut:
      /restaurant|cafe|kfc|mcdonald|takeaway|takeout|snacks|fast\s?food|dining|lunch|dinner|pizza|burger|rolex|chapati/i.test(
        text
      ),
    hasEducation: /school|fees|tuition|textbook|exam|course|stationery/i.test(text),
    hasCommunication:
      /airtime|data|bundle|mobile|sim|telecom|internet data|mtn|airtel|rokespot/i.test(text),
    hasClothing: /clothing|clothes|shoe|shoes|jacket|uniform|fashion/i.test(text),
    hasEntertainment: /movie|cinema|concert|games|gaming|streaming|ticket|leisure|netflix|showmax|spotify|disney|prime\s?video|youtube/i.test(text),
    hasPersonalCare: /salon|barber|haircut|toiletries|cosmetics|skincare|groom/i.test(text),
    hasSavings: /savings|saved|emergency fund|deposit/i.test(text),
    hasGifts: /gift|donation|donated|charity|church|family support/i.test(text),
    hasInsurance: /insurance|premium/i.test(text),
    hasDebt: /debt|loan|credit card|repayment|paid off/i.test(text),
    hasMisc: /misc|miscellaneous|other charges|unexpected|random/i.test(text),
    
    // Amount features
    amount: amount,
    amountLog: Math.log10(amount + 1),
    isLarge: amount > 10000,
    isSmall: amount < 1000,
    isMedium: amount >= 1000 && amount <= 10000,
    
    // Pattern features
    merchantLength: merchant.length,
    descriptionLength: description.length,
    hasNumbers: /\d/.test(description),
    isIncomeType: tx.type === "income",
    isExpenseType: tx.type === "expense",
  };
}

/**
 * Prepare spending pattern data for forecasting models
 */
export function prepareSpendingPatternData(transactions: TrainingTransaction[]) {
  const patterns: Record<string, TrainingSpendingPattern> = {};
  
  transactions.forEach((tx) => {
    if (tx.type === "expense" && !patterns[tx.category]) {
      patterns[tx.category] = {
        category: tx.category,
        amounts: [],
        dates: [],
        frequencies: [],
        seasonalFactors: {},
      };
    }
    
    if (tx.type === "expense") {
      patterns[tx.category].amounts.push(tx.amount);
      patterns[tx.category].dates.push(tx.date);
    }
  });
  
  // Calculate monthly averages and seasonal factors
  Object.values(patterns).forEach((pattern) => {
    const monthlyTotal = pattern.amounts.reduce((sum, amt) => sum + amt, 0);
    pattern.frequencies = [monthlyTotal / 30]; // Average daily
  });
  
  return Object.values(patterns);
}

