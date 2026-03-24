#!/usr/bin/env python3
"""
Generate training data for the Financial Pulse insight LLM.

Creates labeled (financial snapshot → insights) pairs by:
1. Rule-based seed: mirrors the current getReportInsights logic
2. Synthetic variations: different income levels, categories, trends
3. Output: JSONL suitable for LLM fine-tuning (Vertex AI, OpenAI, etc.)

Usage:
  python generate_training_data.py                    # Generate to training_data.jsonl
  python generate_training_data.py --output custom.jsonl
  python generate_training_data.py --count 500         # Target ~500 examples
"""

import json
import random
import argparse
from pathlib import Path
from datetime import datetime, timedelta

# Categories aligned with UniGuard
CATEGORIES = [
    "Rent", "Transport", "Food", "Utilities", "Entertainment", "Savings",
    "Debt Payments", "Insurance", "Eating Out", "Health", "Education",
    "Miscellaneous", "Communication", "Clothing", "Personal Care", "Travel"
]


def format_ugx(amount: float) -> str:
    return f"{int(amount):,} UGX"


def build_snapshot_text(
    latest_month: str,
    prev_month: str,
    latest_income: float,
    latest_expenses: float,
    latest_categories: dict,
    prev_income: float,
    prev_expenses: float,
    category_averages: dict,
) -> str:
    """Build a text representation of the financial snapshot for the prompt."""
    lines = [
        f"Latest month: {latest_month}",
        f"  Income: {format_ugx(latest_income)}",
        f"  Expenses: {format_ugx(latest_expenses)}",
        f"  Savings rate: {(latest_income - latest_expenses) / latest_income * 100:.1f}%" if latest_income > 0 else "  Savings rate: 0%",
        f"  Top categories: {', '.join(f'{k} ({format_ugx(v)})' for k, v in sorted(latest_categories.items(), key=lambda x: -x[1])[:5])}",
        "",
        f"Previous month: {prev_month}",
        f"  Income: {format_ugx(prev_income)}",
        f"  Expenses: {format_ugx(prev_expenses)}",
        "",
        "Historical category averages (per month):",
        "  " + ", ".join(f"{k}: {format_ugx(v)}" for k, v in list(category_averages.items())[:8]),
    ]
    return "\n".join(lines)


def generate_insights_rule_based(
    latest_month: str,
    prev_month: str,
    latest_income: float,
    latest_expenses: float,
    latest_categories: dict,
    prev_income: float,
    prev_expenses: float,
    category_averages: dict,
) -> list[dict]:
    """
    Generate insights using the same logic as getReportInsights (rule-based).
    This produces the ground-truth labels for training.
    """
    insights = []

    latest_savings_rate = (latest_income - latest_expenses) / latest_income if latest_income > 0 else 0
    prev_savings_rate = (prev_income - prev_expenses) / prev_income if prev_income > 0 else 0
    rate_diff = latest_savings_rate - prev_savings_rate

    # 1. Savings rate insight
    if rate_diff > 0.02:
        insights.append({
            "type": "positive",
            "message": f"Your savings rate increased by {int(rate_diff * 100)}% this month compared to {prev_month}.",
            "action": "Keep it up!",
        })
    elif rate_diff < -0.05:
        insights.append({
            "type": "warning",
            "message": f"Your savings rate dropped by {int(abs(rate_diff) * 100)}% this month.",
            "action": "Review spending",
        })

    # 2. Category variance
    for category, amount in latest_categories.items():
        avg = category_averages.get(category, 0)
        if avg > 0 and amount > avg * 1.25:
            pct = int((amount / avg - 1) * 100)
            insights.append({
                "type": "warning",
                "message": f"{category} expenses are {pct}% higher than your average.",
                "action": f"Review '{category}' pod",
            })

    # 3. Budget streak
    if latest_expenses < latest_income and prev_expenses < prev_income:
        insights.append({
            "type": "positive",
            "message": "You've stayed under budget for 2 consecutive months. Excellent discipline!",
            "action": "View rewards",
        })

    # 4. Default
    if len(insights) < 3:
        insights.append({
            "type": "info",
            "message": "Your financial momentum is strong. Have you considered increasing your goal targets?",
            "action": "Update goals",
        })

    return insights[:3]


def generate_synthetic_snapshot(rng: random.Random) -> tuple:
    """Generate a random but realistic financial snapshot."""
    # Income: 500k - 8M UGX/month
    monthly_income = rng.uniform(500_000, 8_000_000)
    # Savings rate: 5% - 40%
    savings_rate = rng.uniform(0.05, 0.40)
    monthly_expenses = monthly_income * (1 - savings_rate)

    # Pick 4-8 categories
    n_cats = rng.randint(4, 8)
    chosen = rng.sample(CATEGORIES, n_cats)
    # Allocate expense across categories
    shares = [rng.random() for _ in chosen]
    total_share = sum(shares)
    shares = [s / total_share for s in shares]

    latest_categories = {c: monthly_expenses * s for c, s in zip(chosen, shares)}

    # Previous month: slight variation
    income_var = rng.uniform(0.9, 1.1)
    expense_var = rng.uniform(0.85, 1.15)
    prev_income = monthly_income * income_var
    prev_expenses = monthly_expenses * expense_var

    prev_categories = {c: latest_categories[c] * rng.uniform(0.7, 1.3) for c in latest_categories}

    # Category averages (historical): average of prev + some noise
    category_averages = {}
    for c in set(latest_categories) | set(prev_categories):
        v1 = latest_categories.get(c, 0)
        v2 = prev_categories.get(c, 0)
        n = 2 + rng.randint(0, 4)  # 2-6 months of history
        category_averages[c] = (v1 + v2) / 2 * rng.uniform(0.8, 1.2)

    base = datetime(2024, 1, 1)
    offset_latest = rng.randint(1, 14)  # Need at least 1 so prev exists
    offset_prev = offset_latest - 1
    latest_dt = base + timedelta(days=30 * offset_latest)
    prev_dt = base + timedelta(days=30 * offset_prev)
    latest_month = latest_dt.strftime("%b %Y")
    prev_month = prev_dt.strftime("%b %Y")

    return (
        latest_month,
        prev_month,
        monthly_income,
        monthly_expenses,
        latest_categories,
        prev_income,
        prev_expenses,
        prev_categories,
        category_averages,
    )


def create_training_example(rng: random.Random) -> dict:
    """Create one (prompt, response) training example."""
    (
        latest_month,
        prev_month,
        latest_income,
        latest_expenses,
        latest_categories,
        prev_income,
        prev_expenses,
        _,
        category_averages,
    ) = generate_synthetic_snapshot(rng)

    snapshot_text = build_snapshot_text(
        latest_month,
        prev_month,
        latest_income,
        latest_expenses,
        latest_categories,
        prev_income,
        prev_expenses,
        category_averages,
    )

    insights = generate_insights_rule_based(
        latest_month,
        prev_month,
        latest_income,
        latest_expenses,
        latest_categories,
        prev_income,
        prev_expenses,
        category_averages,
    )

    prompt = (
        "Given the following financial snapshot, generate 1-3 actionable insights. "
        "Use UGX for amounts. Be concise. Respond with a JSON array of objects, each with "
        '"type" (positive|warning|info), "message", and "action".\n\n'
        f"Financial snapshot:\n{snapshot_text}"
    )

    response = json.dumps(insights, ensure_ascii=False)

    return {"prompt": prompt, "response": response, "insights": insights}


def to_vertex_ai_format(example: dict) -> dict:
    """Convert to Vertex AI tuning format (contents with user/model turns)."""
    return {
        "contents": [
            {"role": "user", "parts": [{"text": example["prompt"]}]},
            {"role": "model", "parts": [{"text": example["response"]}]},
        ]
    }


def main():
    parser = argparse.ArgumentParser(description="Generate Financial Pulse insight training data")
    parser.add_argument("--output", "-o", default="training_data.jsonl", help="Output JSONL path")
    parser.add_argument("--count", "-n", type=int, default=200, help="Number of examples to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--format", choices=["simple", "vertex"], default="simple",
                        help="simple: {prompt, response}; vertex: Vertex AI contents format")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    out_path = Path(__file__).parent / args.output

    examples = []
    for i in range(args.count):
        ex = create_training_example(rng)
        if args.format == "vertex":
            ex = to_vertex_ai_format(ex)
        else:
            ex = {"prompt": ex["prompt"], "response": ex["response"]}
        examples.append(ex)

    with open(out_path, "w", encoding="utf-8") as f:
        for ex in examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    print(f"Generated {len(examples)} examples -> {out_path}")
    print("Next: Review samples, add manual examples, then run fine-tuning (Vertex AI or similar).")


if __name__ == "__main__":
    main()
