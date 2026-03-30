/**
 * Transaction Categorization Model
 * Simulates a trained BERT/NLP model for transaction categorization
 */

import { extractTransactionFeatures, type TrainingTransaction } from "../training-data";
import {
  trainedCategoryKeywords,
  trainedCategoryPriors,
  trainedCategoryTokenWeights,
  trainedCategoryWeights,
} from "./artifacts/transaction-categorizer";

export interface CategorizationResult {
  category: string;
  confidence: number;
  alternatives: Array<{ category: string; confidence: number }>;
}

/**
 * Simulated trained model weights and patterns
 * In production, these would come from actual model training
 */
const categoryWeights: Record<string, Record<string, number>> = {
  Rent: {
    hasHousing: 0.9,
    amount: 0.5,
    isLarge: 0.7,
  },
  Utilities: {
    hasUtilities: 0.9,
    amount: 0.2,
    isMedium: 0.5,
  },
  Food: {
    hasFood: 0.85,
    amount: 0.2,
    isMedium: 0.4,
  },
  "Eating Out": {
    hasEatingOut: 0.9,
    amount: 0.2,
    isSmall: 0.4,
  },
  Education: {
    hasEducation: 0.9,
    amount: 0.4,
    isLarge: 0.4,
  },
  Communication: {
    hasCommunication: 0.9,
    amount: 0.1,
    isSmall: 0.4,
  },
  Clothing: {
    hasClothing: 0.9,
    amount: 0.3,
    isMedium: 0.5,
  },
  Entertainment: {
    hasEntertainment: 0.9,
    amount: 0.2,
    isMedium: 0.5,
  },
  "Personal Care": {
    hasPersonalCare: 0.9,
    amount: 0.2,
    isSmall: 0.4,
  },
  Savings: {
    hasSavings: 0.9,
    amount: 0.5,
    isLarge: 0.4,
  },
  "Gifts / Donations": {
    hasGifts: 0.9,
    amount: 0.2,
    isMedium: 0.4,
  },
  Insurance: {
    hasInsurance: 0.9,
    amount: 0.4,
    isMedium: 0.4,
  },
  "Debt Payments": {
    hasDebt: 0.9,
    amount: 0.4,
    isLarge: 0.4,
  },
  Miscellaneous: {
    hasMisc: 0.7,
    amount: 0.1,
  },
  Coffee: {
    hasCoffee: 0.95,
    amount: -0.3, // Negative correlation with large amounts
    isSmall: 0.8,
  },
  Dining: {
    hasFood: 0.9,
    amount: 0.2,
    isMedium: 0.7,
  },
  Shopping: {
    hasShopping: 0.85,
    amount: 0.4,
    isMedium: 0.6,
  },
  Tech: {
    hasTech: 0.9,
    amount: 0.5, // Tech items are often expensive
    isLarge: 0.7,
    hasShopping: 0.3, // Amazon can be tech
  },
  Transport: {
    hasTransport: 0.92,
    amount: 0.1,
  },
  Health: {
    hasHealth: 0.88,
    amount: 0.3,
  },
  Income: {
    hasIncome: 0.95,
    amount: 0.8, // Income is usually large
    isLarge: 0.9,
  },
  Housing: {
    hasHousing: 0.9,
    amount: 0.6,
    isLarge: 0.8,
  },
  Travel: {
    hasTravel: 0.9,
    amount: 0.5,
    isLarge: 0.6,
  },
};

const MIN_HISTORY = 5;
const MAX_HISTORY_FOR_SIGNALS = 500; // Cap so categorization stays responsive with large lists
const MIN_CONFIDENCE = 0.45;
const MAX_CONFIDENCE = 0.9;
const HISTORY_PRIOR_WEIGHT = 0.2;
const MERCHANT_SIGNAL_WEIGHT = 0.5;
const TOKEN_SIGNAL_WEIGHT = 0.15;
const KEYWORD_SIGNAL_WEIGHT = 0.25;
const TRAINED_KEYWORD_WEIGHT = 0.12;
const TOKEN_WEIGHT_SIGNAL = 0.35;
const STRONG_KEYWORD_MATCHES = 2;
const STRONG_MATCH_CONFIDENCE = 0.2;
const SOFT_MATCH_CONFIDENCE = 0.05;
const SPENDING_VERB_BOOST = 0.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function computeDataQuality(userHistory: TrainingTransaction[]) {
  if (userHistory.length === 0) {
    return { score: 0.35, timeSpanDays: 0 };
  }
  const dates = userHistory.map((tx) => new Date(tx.date).getTime()).sort();
  const timeSpanDays =
    dates.length > 1 ? (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24) : 0;
  const countScore = clamp(userHistory.length / 30, 0, 1);
  const spanScore = clamp(timeSpanDays / 90, 0, 1);
  return {
    score: clamp(0.35 + countScore * 0.4 + spanScore * 0.25, 0.35, 1),
    timeSpanDays,
  };
}

function computeImbalancePenalty(categoryCounts: Record<string, number>, totalCount: number) {
  const counts = Object.values(categoryCounts);
  if (counts.length === 0 || totalCount === 0) return 0;
  const maxCount = Math.max(...counts);
  const meanCount = totalCount / counts.length;
  const imbalanceRatio = meanCount > 0 ? maxCount / meanCount : 1;
  return clamp((imbalanceRatio - 1) / 3, 0, 0.45);
}

function computeEvidenceScore(
  features: ReturnType<typeof extractTransactionFeatures>,
  keywordMatches: number,
  merchant?: string
) {
  const booleanEvidence = Object.values(features).filter((value) => value === true).length;
  const featureScore = clamp(booleanEvidence / 6, 0, 0.7);
  const keywordScore = clamp(keywordMatches / 6, 0, 0.5);
  const merchantScore = merchant ? 0.1 : 0;
  return clamp(0.4 + featureScore * 0.35 + keywordScore * 0.2 + merchantScore, 0.4, 1);
}

const merchantPatterns: Record<string, string> = {
  starbucks: "Coffee",
  "cafe nero": "Coffee",
  amazon: "Shopping", // Default, can be Tech based on amount
  netflix: "Entertainment",
  uber: "Transport",
  gym: "Health",
  pharmacy: "Health",
  mcdonald: "Dining",
};

/** Longer / more specific keys first — lookup uses first match. Uganda + regional mobility & utilities. */
const brandOverrides: Record<string, string> = {
  "uber eats": "Eating Out",
  "special hire": "Transport",
  "little taxi": "Transport",
  "little cab": "Transport",
  "in driver": "Transport",
  "in-driver": "Transport",
  "yaka token": "Utilities",
  "electricity token": "Utilities",
  "power token": "Utilities",
  "prepaid electricity": "Utilities",
  "national water": "Utilities",
  "data bundle": "Communication",
  "voice bundle": "Communication",
  "mtn data": "Communication",
  "airtel data": "Communication",
  "freedom bundle": "Communication",
  "smile telecom": "Communication",
  "roke telkom": "Communication",
  netflix: "Entertainment",
  showmax: "Entertainment",
  spotify: "Entertainment",
  disney: "Entertainment",
  "prime video": "Entertainment",
  "youtube premium": "Entertainment",
  safeboda: "Transport",
  taxify: "Transport",
  bolt: "Transport",
  farasi: "Transport",
  matatu: "Transport",
  taxi: "Transport",
  pioneer: "Transport",
  yaka: "Utilities",
  umeme: "Utilities",
  nwsc: "Utilities",
  kikuubo: "Food",
  nakasero: "Food",
  owino: "Food",
  rolex: "Eating Out",
  chapati: "Eating Out",
};

const categoryKeywords: Record<string, string[]> = {
  Rent: ["rent", "housing", "apartment", "accommodation", "landlord", "house payment", "room rent"],
  Utilities: [
    "electricity",
    "water",
    "gas",
    "utility",
    "power",
    "internet",
    "umeme",
    "yaka",
    "nwsc",
    "national water",
    "tokens",
    "sts",
    "prepaid",
    "cable",
    "tv",
  ],
  Food: [
    "food",
    "groceries",
    "market",
    "supermarket",
    "grocery",
    "beans",
    "rice",
    "maize",
    "oil",
    "sugar",
    "kitchen",
    "vegetables",
    "fruits",
    "lunch",
    "breakfast",
    "dinner",
    "meal",
    "kikuubo",
    "nakasero",
    "owino",
    "balikuddembe",
    "food city",
    "carrefour",
  ],
  "Eating Out": [
    "restaurant",
    "cafe",
    "kfc",
    "mcdonald",
    "takeaway",
    "takeout",
    "snack",
    "fast food",
    "food joint",
    "rolex",
    "chapati",
    "street food",
  ],
  Education: ["school", "fees", "tuition", "textbook", "exam", "course", "stationery", "registration"],
  Communication: [
    "airtime",
    "data",
    "bundle",
    "mobile",
    "sim",
    "telecom",
    "internet data",
    "top-up",
    "mtn",
    "airtel",
    "rokespot",
  ],
  Clothing: ["clothes", "clothing", "shoe", "shoes", "jacket", "uniform", "fashion", "outfit"],
  Entertainment: ["movie", "cinema", "concert", "games", "gaming", "entertainment", "leisure", "streaming", "netflix"],
  "Personal Care": ["salon", "barber", "haircut", "toiletries", "cosmetics", "skincare", "grooming"],
  Savings: ["savings", "saved", "emergency fund", "put aside", "deposit"],
  "Gifts / Donations": ["gift", "donation", "donated", "charity", "church", "family support", "sent money"],
  Insurance: ["insurance", "premium"],
  "Debt Payments": ["debt", "loan", "credit card", "repayment", "paid off", "emi", "installment"],
  Miscellaneous: ["misc", "miscellaneous", "random", "unexpected", "other charges", "other expenses"],
  Coffee: ["coffee", "cafe", "espresso", "latte", "cappuccino", "americano", "tea", "barista"],
  Dining: ["restaurant", "dining", "lunch", "dinner", "breakfast", "pizza", "burger", "kfc", "mcdonald", "takeout", "delivery"],
  Shopping: ["shopping", "store", "retail", "mall", "market", "purchase", "order", "buy", "clothing", "fashion"],
  Tech: ["software", "app", "laptop", "phone", "tablet", "subscription", "saas", "cloud", "electronics", "gadget"],
  Transport: [
    "uber",
    "bolt",
    "taxify",
    "taxi",
    "boda",
    "bodaboda",
    "safeboda",
    "matatu",
    "farasi",
    "ride",
    "fuel",
    "gas",
    "petrol",
    "transport",
    "bus",
    "train",
    "metro",
    "parking",
    "commute",
    "special hire",
    "in driver",
    "pioneer",
  ],
  Health: [
    "gym",
    "pharmacy",
    "doctor",
    "health",
    "medical",
    "fitness",
    "clinic",
    "hospital",
    "medicine",
    "checkup",
    "check up",
    "lab",
    "laboratory",
    "xray",
    "x-ray",
    "scan",
    "consultation",
  ],
  Housing: ["rent", "mortgage", "housing", "utility", "electric", "water", "internet", "cable", "maintenance"],
  Travel: ["flight", "airline", "hotel", "airbnb", "booking", "travel", "trip", "vacation", "tour"],
  Income: ["salary", "deposit", "payroll", "bonus", "interest", "dividend", "refund", "reversal", "income", "received", "earned"],
};

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeKeywordSets(
  base: Record<string, string[]>,
  trained: Record<string, readonly string[]>
) {
  const categories = new Set([...Object.keys(base), ...Object.keys(trained)]);
  const merged: Record<string, { base: string[]; trained: string[] }> = {};
  categories.forEach((category) => {
    const baseKeywords = base[category] || [];
    const trainedKeywords = (trained[category] || []).map((kw) => String(kw));
    const baseDeduped = Array.from(new Set(baseKeywords.map((kw) => normalizeText(kw)).filter(Boolean)));
    const trainedDeduped = Array.from(new Set(trainedKeywords.map((kw) => normalizeText(kw)).filter(Boolean)));
    merged[category] = {
      base: baseDeduped,
      trained: trainedDeduped,
    };
  });
  return merged;
}

const mergedKeywordSets = mergeKeywordSets(categoryKeywords, trainedCategoryKeywords);

const mergedCategoryWeights: Record<string, Record<string, number>> = {
  ...categoryWeights,
  ...trainedCategoryWeights,
};

const mergedCategoryTokenWeights: Record<string, Record<string, number>> = {
  ...trainedCategoryTokenWeights,
};

function extractTokens(text: string) {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length > 2);
}

function addNgrams(tokens: string[], n: number = 2) {
  if (tokens.length < n) return [];
  const grams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i += 1) {
    grams.push(tokens.slice(i, i + n).join("_"));
  }
  return grams;
}

function countKeywordMatches(text: string, keywords: readonly string[]) {
  const normalizedText = normalizeText(text);
  const tokens = new Set(normalizedText.split(" "));
  let matches = 0;
  keywords.forEach((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) return;
    if (normalizedKeyword.includes(" ")) {
      if (normalizedText.includes(normalizedKeyword)) matches += 2;
    } else if (tokens.has(normalizedKeyword)) {
      matches += 1;
    }
  });
  return matches;
}

function hasSpendingVerb(text: string) {
  return /\b(spent|spend|paid|pay|used|use|bought|buy|purchase|purchased|cost|charge)\b/i.test(text);
}

function inferTransactionType(description: string, amount: number, merchant?: string) {
  const text = normalizeText(`${description} ${merchant ?? ""}`);
  const isIncomeText = /salary|deposit|payroll|bonus|interest|dividend|refund|reversal|income|received|earned/i.test(text);
  const isExpenseText = /spent|purchase|bought|expense|bill|rent|fee|paid|cost|charge/i.test(text);
  if (isIncomeText && !isExpenseText) return "income";
  if (isExpenseText && !isIncomeText) return "expense";
  return "expense";
}

function buildUserSignals(userHistory: TrainingTransaction[]) {
  const merchantCategoryCounts: Record<string, Record<string, number>> = {};
  const keywordCategoryCounts: Record<string, Record<string, number>> = {};
  const categoryCounts: Record<string, number> = {};

  userHistory.forEach((tx) => {
    categoryCounts[tx.category] = (categoryCounts[tx.category] || 0) + 1;
    if (tx.merchant) {
      const merchantKey = normalizeText(tx.merchant);
      merchantCategoryCounts[merchantKey] = merchantCategoryCounts[merchantKey] || {};
      merchantCategoryCounts[merchantKey][tx.category] =
        (merchantCategoryCounts[merchantKey][tx.category] || 0) + 1;
    }

    const tokens = extractTokens(tx.description);
    tokens.forEach((token) => {
      keywordCategoryCounts[token] = keywordCategoryCounts[token] || {};
      keywordCategoryCounts[token][tx.category] =
        (keywordCategoryCounts[token][tx.category] || 0) + 1;
    });
  });

  return {
    merchantCategoryCounts,
    keywordCategoryCounts,
    categoryCounts,
    totalCount: userHistory.length,
  };
}

/**
 * Simulated trained model for transaction categorization
 * Uses feature extraction + weighted scoring (simulates neural network)
 */
export function categorizeTransaction(
  description: string,
  amount: number,
  merchant?: string,
  userHistory: TrainingTransaction[] = [],
  type?: "income" | "expense"
): CategorizationResult {
  // Create transaction object for feature extraction
  const inferredType = type ?? inferTransactionType(description, amount, merchant);
  const normalizedAmount = Math.abs(amount);
  const combinedText = normalizeText(`${description} ${merchant ?? ""}`);
  const override = Object.entries(brandOverrides).find(([brand]) => combinedText.includes(brand));
  if (override) {
    return {
      category: override[1],
      confidence: 0.8,
      alternatives: [],
    };
  }
  const tx: TrainingTransaction = {
    description,
    amount: normalizedAmount,
    merchant,
    category: "Other",
    type: inferredType,
    date: new Date().toISOString(),
  };

  const features = extractTransactionFeatures(tx);
  const historySlice =
    userHistory.length > MAX_HISTORY_FOR_SIGNALS
      ? userHistory.slice(-MAX_HISTORY_FOR_SIGNALS)
      : userHistory;
  const userSignals = buildUserSignals(historySlice);
  const tokens = extractTokens(description);
  const tokensWithNgrams = tokens.concat(addNgrams(tokens));
  const combinedTextRaw = `${description} ${merchant ?? ""}`;
  const spendingVerb = hasSpendingVerb(combinedTextRaw);
  const dataQuality = computeDataQuality(userHistory);
  const imbalancePenalty = computeImbalancePenalty(userSignals.categoryCounts, userSignals.totalCount);
  
  // Calculate scores for each category (simulates neural network forward pass)
  const categoryScores: Record<string, number> = {};
  const baseKeywordMatches: Record<string, number> = {};
  const categories = Array.from(
    new Set([
      ...Object.keys(mergedCategoryWeights),
      ...Object.keys(mergedKeywordSets),
    ])
  );
  
  categories.forEach((category) => {
    let score = 0;
    const weights = mergedCategoryWeights[category] || {};
    
    Object.entries(features).forEach(([feature, value]) => {
      if (weights[feature] !== undefined) {
        if (typeof value === "boolean") {
          score += value ? weights[feature] : 0;
        } else if (typeof value === "number") {
          // Normalize numeric features
          const normalized = feature === "amount" 
            ? Math.min(value / 100000, 1) 
            : Math.min(value / 100, 1);
          score += weights[feature] * normalized;
        }
      }
    });
    
    // Merchant pattern boost
    if (merchant) {
      const merchantLower = normalizeText(merchant);
      if (merchantPatterns[merchantLower] === category) {
        score += 0.15;
      }
      
      // Special case: Amazon with large amount = Tech
      if (merchantLower.includes("amazon") && normalizedAmount > 20000 && category === "Tech") {
        score += 0.35;
      }
    }
    
    // Amount-based heuristics
    if (category === "Income" && normalizedAmount > 50000) {
      score += 0.5;
    }
    if (category === "Tech" && normalizedAmount > 20000) {
      score += 0.3;
    }
    if (category === "Coffee" && normalizedAmount < 1000) {
      score += 0.2;
    }

    // User history priors (reduce bias vs fixed patterns)
    if (userSignals.totalCount > 0) {
      const prior = ((userSignals.categoryCounts[category] || 0) + 1) /
        (userSignals.totalCount + categories.length);
      const priorWeight = HISTORY_PRIOR_WEIGHT * dataQuality.score * (1 - imbalancePenalty);
      score += Math.log(prior) * priorWeight;
    }

    if (userSignals.totalCount < MIN_HISTORY && trainedCategoryPriors[category]) {
      const trainedPrior = Math.max(trainedCategoryPriors[category], 0.0001);
      score += Math.log(trainedPrior) * 0.12;
    }

    // User merchant affinity
    if (merchant) {
      const merchantKey = normalizeText(merchant);
      const merchantCounts = userSignals.merchantCategoryCounts[merchantKey];
      if (merchantCounts) {
        const total = Object.values(merchantCounts).reduce((sum, count) => sum + count, 0);
        const confidence = total > 0 ? (merchantCounts[category] || 0) / total : 0;
        score += confidence * MERCHANT_SIGNAL_WEIGHT * dataQuality.score;
      }
    }

    // Token-level user signals
    tokens.forEach((token) => {
      const tokenCounts = userSignals.keywordCategoryCounts[token];
      if (tokenCounts) {
        const total = Object.values(tokenCounts).reduce((sum, count) => sum + count, 0);
        const confidence = total > 0 ? (tokenCounts[category] || 0) / total : 0;
        score += confidence * TOKEN_SIGNAL_WEIGHT * dataQuality.score;
      }
    });

    // Keyword lexicon matching (broad coverage of related words)
    const keywordSet = mergedKeywordSets[category];
    const tokenWeightMap = mergedCategoryTokenWeights[category];
    if (keywordSet) {
      const baseMatches = countKeywordMatches(combinedTextRaw, keywordSet.base);
      const trainedMatches = countKeywordMatches(combinedTextRaw, keywordSet.trained);
      baseKeywordMatches[category] = baseMatches;
      score += Math.min(baseMatches, 5) * KEYWORD_SIGNAL_WEIGHT;
      score += Math.min(trainedMatches, 5) * TRAINED_KEYWORD_WEIGHT;
      if (spendingVerb && baseMatches > 0) {
        score += SPENDING_VERB_BOOST;
      }
    }
    if (tokenWeightMap) {
      const tokenScore = tokensWithNgrams.reduce((sum, token) => sum + (tokenWeightMap[token] ?? 0), 0);
      if (tokenScore > 0) {
        score += tokenScore * TOKEN_WEIGHT_SIGNAL;
      }
    }

    // Type alignment
    if (inferredType === "income" && category !== "Income") {
      score -= 1;
    }
    if (inferredType === "expense" && category === "Income") {
      score -= 1;
    }
    
    categoryScores[category] = score;
  });
  
  // Get top category
  const sortedCategories = Object.entries(categoryScores)
    .sort(([, a], [, b]) => b - a);

  let topCategory = sortedCategories[0][0];
  let topScore = sortedCategories[0][1];

  const keywordBest = Object.entries(baseKeywordMatches)
    .sort(([, a], [, b]) => b - a)[0];
  if (spendingVerb && keywordBest && keywordBest[1] > 0) {
    topCategory = keywordBest[0];
    topScore = categoryScores[topCategory];
  }
  
  // Normalize confidence (0-1)
  const totalScore = Object.values(categoryScores).reduce((sum, s) => sum + Math.exp(s), 0);
  const confidence = totalScore > 0 ? Math.exp(topScore) / totalScore : 1 / categories.length;

  // Conservative adjustment for limited history
  const historyPenalty = userHistory.length < MIN_HISTORY ? 0.8 : 1;
  const topKeywordMatches = baseKeywordMatches[topCategory] || 0;
  const evidenceScore = computeEvidenceScore(features, topKeywordMatches, merchant);
  const evidenceWeight = 0.7 + evidenceScore * 0.3;
  const qualityWeight = 0.7 + dataQuality.score * 0.3;
  const adjustedConfidence = confidence * historyPenalty * evidenceWeight * qualityWeight * (1 - imbalancePenalty * 0.4);
  
  // Get alternatives
  const alternatives = sortedCategories
    .filter(([cat]) => cat !== topCategory)
    .slice(0, 3)
    .map(([cat, score]) => ({
      category: cat,
      confidence: totalScore > 0 ? Math.exp(score) / totalScore : 1 / categories.length,
    }));
  
  const strongKeywordMatch = topKeywordMatches >= STRONG_KEYWORD_MATCHES;
  const topBaseMatch = baseKeywordMatches[topCategory] || 0;
  const baseMatchCounts = Object.values(baseKeywordMatches).filter((value) => value > 0);
  const sortedMatchCounts = baseMatchCounts.sort((a, b) => b - a);
  const topMatchCount = sortedMatchCounts[0] || 0;
  const runnerUpCount = sortedMatchCounts[1] || 0;
  const hasClearKeywordLead = topBaseMatch > 0 && topBaseMatch >= runnerUpCount + 1;
  const softKeywordMatch = spendingVerb && topBaseMatch > 0;

  const shouldReturnTop =
    adjustedConfidence >= MIN_CONFIDENCE ||
    (strongKeywordMatch && adjustedConfidence >= STRONG_MATCH_CONFIDENCE) ||
    (softKeywordMatch && adjustedConfidence >= SOFT_MATCH_CONFIDENCE) ||
    (spendingVerb && hasClearKeywordLead && adjustedConfidence >= SOFT_MATCH_CONFIDENCE);

  return {
    category: shouldReturnTop ? topCategory : "Other",
    confidence: Math.min(adjustedConfidence, MAX_CONFIDENCE), // Cap for safety
    alternatives,
  };
}

/**
 * Learn from user corrections (simulates model fine-tuning)
 */
export function learnFromCorrection(
  description: string,
  amount: number,
  merchant: string | undefined,
  correctCategory: string,
  predictedCategory: string
) {
  // In production, this would update model weights
  // For now, we'll store this for future model retraining
  console.log(`Learning: "${description}" was predicted as ${predictedCategory} but should be ${correctCategory}`);
  
  // This would trigger model fine-tuning in production
  return {
    learned: true,
    message: "Model will learn from this correction",
  };
}

