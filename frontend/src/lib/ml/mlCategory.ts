/**
 * Maps labels from the Python sklearn / Uganda CSV pipeline to `categoryIcons` keys in the app.
 * Without this, API predictions are dropped because `APP_CATEGORIES.includes(raw)` fails.
 */

/** Uganda `uganda_personal_finance_data.csv` + typical RF export names */
const ML_LABEL_TO_APP: Record<string, string> = {
  "Food & Groceries": "Food",
  "Airtime & Data": "Communication",
  "Dining & Drinks": "Eating Out",
  "Income/Transfers": "Income",
  // Backend low-confidence / empty text
  "Other/Unknown": "Miscellaneous",
  // Synthetic notebook (train_transaction_categorizer) class names
  Food: "Food",
  Transport: "Transport",
  Housing: "Housing",
  Utilities: "Utilities",
  Entertainment: "Entertainment",
  Shopping: "Shopping",
  Healthcare: "Health",
  Education: "Education",
  Insurance: "Insurance",
  "Personal Care": "Personal Care",
  "Gifts & Donations": "Gifts / Donations",
  "Banking & Finance": "Debt Payments",
  Travel: "Travel",
  Pets: "Miscellaneous",
  Business: "Miscellaneous",
  Subscriptions: "Tech",
  Taxes: "Miscellaneous",
  "Legal & Fees": "Miscellaneous",
  "Kids & Family": "Miscellaneous",
  Other: "Miscellaneous",
  Income: "Income",
};

/**
 * Turn ML API `category` into a key that exists in `categoryIcons` / budget code.
 */
export function normalizeMlCategoryForApp(
  raw: string | undefined,
  appCategoryKeys: readonly string[]
): string {
  if (raw == null || !String(raw).trim()) return "Miscellaneous";
  const r = String(raw).trim();
  if (appCategoryKeys.includes(r)) return r;
  const mapped = ML_LABEL_TO_APP[r];
  if (mapped && appCategoryKeys.includes(mapped)) return mapped;
  return "Miscellaneous";
}
