from transformers import DonutProcessor, VisionEncoderDecoderModel
import torch

print("Loading processor...")
processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
print("Loading model...")
model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
print("Done!")
