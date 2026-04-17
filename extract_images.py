import json
import os
import base64

files = ['ml_pipeline/train_transaction_categorizer.ipynb', 'ml_pipeline/model.ipynb']
for fpath in files:
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            nb = json.load(f)
            img_count = 0
            for cell in nb.get('cells', []):
                for out in cell.get('outputs', []):
                    data = out.get('data', {})
                    if 'image/png' in data:
                        img_count += 1
                        b64_data = data['image/png']
                        out_name = f"{os.path.basename(fpath).split('.')[0]}_img{img_count}.png"
                        with open(out_name, 'wb') as img_f:
                            img_f.write(base64.b64decode(b64_data))
                        print(f"Saved {out_name}")
