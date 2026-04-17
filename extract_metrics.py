import json
import os

files = ['ml_pipeline/train_transaction_categorizer.ipynb', 'ml_pipeline/model.ipynb']
for fpath in files:
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            nb = json.load(f)
            print(f"=== {fpath} ===")
            for cell in nb.get('cells', []):
                if cell.get('cell_type') == 'code':
                    for out in cell.get('outputs', []):
                        if out.get('output_type') == 'stream':
                            text = ''.join(out.get('text', []))
                            if 'accuracy' in text.lower() or 'f1' in text.lower() or 'score' in text.lower() or 'precision' in text.lower():
                                print("Found metrics text:", text[:500])
