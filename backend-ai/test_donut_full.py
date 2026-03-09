import torch
import json
import re
from PIL import Image
from transformers import DonutProcessor, VisionEncoderDecoderModel

print("Loading processor & model...")

processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")

device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)
print(f"Loaded on {device}")
