#!/usr/bin/env python3
"""
Trigger a Vertex AI supervised fine-tuning job for the Financial Pulse insight model.

Prerequisites:
  1. Google Cloud project with Vertex AI API enabled
  2. gcloud auth application-default login
  3. Training data uploaded to a GCS bucket (see upload_to_gcs below)
  4. pip install google-cloud-aiplatform

Usage:
  # First: generate and merge training data
  python generate_training_data.py --count 300
  python merge_and_export.py --vertex

  # Upload to GCS (replace BUCKET with your bucket)
  python tune_vertex.py --upload gs://YOUR_BUCKET/insight_training/training_merged.jsonl

  # Start tuning job
  python tune_vertex.py --project YOUR_PROJECT --region us-central1 \\
      --dataset gs://YOUR_BUCKET/insight_training/training_merged.jsonl
"""

import argparse
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def upload_to_gcs(local_path: Path, gcs_uri: str) -> bool:
    """Upload training_merged.jsonl to GCS using gsutil."""
    try:
        subprocess.run(
            ["gsutil", "cp", str(local_path), gcs_uri],
            check=True,
            capture_output=True,
        )
        print(f"Uploaded {local_path} -> {gcs_uri}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Upload failed: {e.stderr.decode() if e.stderr else e}")
        return False
    except FileNotFoundError:
        print("gsutil not found. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install")
        return False


def run_tuning(
    project: str,
    region: str,
    dataset_uri: str,
    display_name: str = "financial-pulse-insight-v1",
) -> None:
    """Create a Vertex AI supervised tuning job."""
    try:
        from google.cloud import aiplatform
    except ImportError:
        print("Install: pip install google-cloud-aiplatform")
        sys.exit(1)

    aiplatform.init(project=project, location=region)

    # Gemini 2.0 Flash is a common choice for tuning
    # Check https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-use-supervised-tuning for current models
    tuning_job = aiplatform.SupervisedTuningJob.create(
        display_name=display_name,
        tuning_dataset=dataset_uri,
        model_display_name=f"{display_name}-tuned",
        base_model="gemini-2.0-flash-001",  # Verify availability in your region
    )

    print(f"Tuning job created: {tuning_job.resource_name}")
    print("Monitor in Cloud Console: https://console.cloud.google.com/vertex-ai/training/tuning-jobs")


def main():
    parser = argparse.ArgumentParser(description="Vertex AI fine-tuning for Financial Pulse insights")
    parser.add_argument("--upload", metavar="GCS_URI", help="Upload training_merged.jsonl to gs://bucket/path")
    parser.add_argument("--project", help="GCP project ID")
    parser.add_argument("--region", default="us-central1", help="Vertex AI region")
    parser.add_argument("--dataset", metavar="GCS_URI", help="GCS URI of training JSONL (after upload)")
    parser.add_argument("--display-name", default="financial-pulse-insight-v1")
    args = parser.parse_args()

    if args.upload:
        local = SCRIPT_DIR / "training_merged.jsonl"
        if not local.exists():
            print("Run merge_and_export.py --vertex first")
            sys.exit(1)
        if not upload_to_gcs(local, args.upload):
            sys.exit(1)
        if not args.dataset:
            args.dataset = args.upload

    if args.dataset and args.project:
        run_tuning(args.project, args.region, args.dataset, args.display_name)
    elif args.upload:
        print("Upload complete. Start tuning with:")
        print(f"  python tune_vertex.py --project YOUR_PROJECT --dataset {args.upload}")
    else:
        parser.print_help()
        print("\nExample workflow:")
        print("  1. python generate_training_data.py --count 300")
        print("  2. python merge_and_export.py --vertex")
        print("  3. python tune_vertex.py --upload gs://YOUR_BUCKET/insight_training/training.jsonl")
        print("  4. python tune_vertex.py --project YOUR_PROJECT --dataset gs://YOUR_BUCKET/insight_training/training.jsonl")


if __name__ == "__main__":
    main()
