#!/usr/bin/env python3
"""
Merge generated + manual examples and export for fine-tuning.

Usage:
  python merge_and_export.py
  python merge_and_export.py --vertex  # Output Vertex AI format
"""

import json
import argparse
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vertex", action="store_true", help="Output Vertex AI contents format")
    parser.add_argument("--output", "-o", default="training_merged.jsonl")
    args = parser.parse_args()

    merged = []

    # Load generated
    gen_path = SCRIPT_DIR / "training_data.jsonl"
    if gen_path.exists():
        with open(gen_path, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    merged.append(json.loads(line))

    # Load manual (prepend so they have priority / are included first)
    manual_path = SCRIPT_DIR / "manual_examples.json"
    if manual_path.exists():
        with open(manual_path, encoding="utf-8") as f:
            manual = json.load(f)
        for ex in manual:
            if args.vertex:
                merged.insert(0, {
                    "contents": [
                        {"role": "user", "parts": [{"text": ex["prompt"]}]},
                        {"role": "model", "parts": [{"text": ex["response"]}]},
                    ]
                })
            else:
                merged.insert(0, {"prompt": ex["prompt"], "response": ex["response"]})

    out_path = SCRIPT_DIR / args.output
    with open(out_path, "w", encoding="utf-8") as f:
        for ex in merged:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    print(f"Merged {len(merged)} examples -> {out_path}")


if __name__ == "__main__":
    main()
