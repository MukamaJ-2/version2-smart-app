import random
import pandas as pd

categories = {
    "Food": ["lunch", "groceries", "kfc", "dinner", "coffee", "snacks", "supermarket", "pizza", "breakfast", "burger", "meal", "restaurant", "cafe"],
    "Transport": ["fuel", "uber", "bus ticket", "gas", "train", "subway", "tolls", "taxi", "parking", "flight", "transit", "boda"],
    "Housing": ["rent", "mortgage", "plumber", "home depot", "ikea", "apartment", "property tax", "cleaning", "maintenance", "furniture"],
    "Utilities": ["water bill", "electricity", "internet", "phone bill", "gas bill", "trash", "cell plan", "broadband", "power", "wifi"],
    "Entertainment": ["movie", "netflix", "spotify", "concert", "steam", "club", "bowling", "theater", "games", "party", "cinema", "music"],
    "Shopping": ["shoes", "amazon", "target", "clothes", "mall", "jacket", "electronics", "best buy", "shirts", "gifts", "sneakers", "laptop"],
    "Healthcare": ["pharmacy", "doctor", "dentist", "hospital", "vitamins", "first aid", "eye exam", "clinic", "medicine", "therapy", "checkup"]
}

templates = [
    "{keyword}",
    "spent {price} on {keyword}",
    "paid {price} for {keyword}",
    "{keyword} cost me {price}",
    "bought {keyword} for {price}",
    "{keyword} today, {price}",
    "got {keyword} - {price}",
    "expensive {keyword} {price}",
    "{keyword} {price}",
    "just paid {price} for {keyword}",
    "went to {keyword} and spent {price}",
    "cost of {keyword} was {price}",
    "paid {price} towards {keyword}",
    "{price} for {keyword}"
]

data = []
for category, keywords in categories.items():
    for kw in keywords:
        for _ in range(100): # 100 samples per keyword
            price = random.choice([f"{random.randint(1, 100)}k", f"{random.randint(5, 5000)}00", str(random.randint(1, 500))])
            # Sometimes user doesn't put a price
            if random.random() > 0.8:
                text = random.choice(["{keyword}", "spent on {keyword}", "paid for {keyword}", "{keyword} cost"]).format(keyword=kw)
            else:
                text = random.choice(templates).format(keyword=kw, price=price)
            data.append({"text": text.lower(), "label": category})

df = pd.DataFrame(data)
df = df.sample(frac=1, random_state=42).reset_index(drop=True)
csv_path = "/home/mukama/Pictures/smart-personal-finance/ml_pipeline/synthetic_transactions.csv"
df.to_csv(csv_path, index=False)
print(f"Generated {len(df)} records and saved to {csv_path}")
