# Financial Pulse Insight LLM — Training Ground

This directory contains the **training ground** for fine-tuning an LLM to generate Intelligent Financial Pulse insights.

## Overview

- **Input**: Financial snapshot (income, expenses, category breakdown, month-over-month comparison)
- **Output**: 1–3 JSON insights with `type` (positive | warning | info), `message`, and `action`
- **Goal**: Replace rule-based `getReportInsights()` with a trained model for richer, more contextual advice

## Structure

| File | Purpose |
|------|---------|
| `schema.json` | Input/output schema and format notes |
| `generate_training_data.py` | Generate synthetic training examples from rule-based logic |
| `manual_examples.json` | Curate human-written examples (add your own) |
| `merge_and_export.py` | Merge generated + manual → final JSONL |
| `training_data.jsonl` | Generated examples (after running generator) |
| `training_merged.jsonl` | Final dataset for fine-tuning |

## Quick Start

### 1. Generate seed training data

```bash
cd ml_pipeline/insight_training
python generate_training_data.py --count 300
```

This creates `training_data.jsonl` with ~300 examples. Each example mirrors the current rule-based logic, so the model learns the same patterns first.

### 2. Add manual examples

Edit `manual_examples.json` and add your own (financial snapshot → insights) pairs. These improve quality and cover edge cases.

Example format:

```json
{
  "prompt": "Given the following financial snapshot...\n\nFinancial snapshot:\nLatest month: Jan 2025\n  Income: 2,500,000 UGX\n  ...",
  "response": "[{\"type\": \"warning\", \"message\": \"...\", \"action\": \"...\"}]"
}
```

### 3. Merge and export

```bash
python merge_and_export.py
# Or for Vertex AI format:
python merge_and_export.py --vertex
```

Output: `training_merged.jsonl` ready for fine-tuning.

### 4. Fine-tune (Vertex AI)

1. Upload `training_merged.jsonl` to a Google Cloud Storage bucket.
2. Create a tuning job in [Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-use-supervised-tuning).
3. Use the tuned model endpoint in the app (see integration step below).

## Data Format

**Simple format** (default):

```jsonl
{"prompt": "...", "response": "[{...}]"}
{"prompt": "...", "response": "[{...}]"}
```

**Vertex AI format** (`--vertex`):

```jsonl
{"contents": [{"role": "user", "parts": [{"text": "..."}]}, {"role": "model", "parts": [{"text": "..."}]}]}
```

## Validation

Before fine-tuning, validate a few samples:

```bash
python -c "
import json
with open('training_data.jsonl') as f:
    for i, line in enumerate(f):
        if i >= 3: break
        ex = json.loads(line)
        print('--- Example', i+1, '---')
        print('Prompt (first 200 chars):', ex['prompt'][:200], '...')
        print('Response:', ex['response'][:150], '...')
        print()
"
```

## Fine-tuning (Vertex AI)

```bash
# 1. Generate and merge (Vertex format)
python3 generate_training_data.py --count 300
python3 merge_and_export.py --vertex

# 2. Upload to GCS
python3 tune_vertex.py --upload gs://YOUR_BUCKET/insight_training/training.jsonl

# 3. Start tuning job (requires GCP project)
python3 tune_vertex.py --project YOUR_PROJECT --dataset gs://YOUR_BUCKET/insight_training/training.jsonl
```

See [Vertex AI supervised tuning](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-use-supervised-tuning) for model availability and quotas.

## Next Steps (after you have a trained model)

1. Deploy the tuned model (Vertex AI endpoint or similar).
2. Add an API route or client call in the backend/frontend.
3. Update `ai-service.ts` `getReportInsights()` to call the model when available, with rule-based fallback.
