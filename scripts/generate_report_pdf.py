#!/usr/bin/env python3
"""Generate PROJECT_REPORT.pdf from PROJECT_REPORT.md content."""

from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Preformatted,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def main():
    root = Path(__file__).resolve().parent.parent
    md_path = root / "PROJECT_REPORT.md"
    out_path = root / "PROJECT_REPORT.pdf"

    if not md_path.exists():
        print(f"Error: {md_path} not found")
        return 1

    content = md_path.read_text(encoding="utf-8")
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="Section",
        parent=styles["Heading1"],
        fontSize=14,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        name="Subsection",
        parent=styles["Heading2"],
        fontSize=12,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="Subsubsection",
        parent=styles["Heading3"],
        fontSize=11,
        spaceAfter=4,
    ))

    story = []
    lines = content.split("\n")
    i = 0
    in_code_block = False
    code_lines = []

    def add_para(text, style="Normal"):
        if text.strip():
            story.append(Paragraph(text.strip().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), styles[style]))
            story.append(Spacer(1, 6))

    while i < len(lines):
        line = lines[i]
        i += 1

        if line.strip().startswith("```"):
            if in_code_block:
                code_text = "\n".join(code_lines)
                story.append(Preformatted(code_text[:2000], styles["Code"]))
                story.append(Spacer(1, 8))
                code_lines = []
            in_code_block = not in_code_block
            continue

        if in_code_block:
            code_lines.append(line)
            continue

        if line.strip() == "---":
            story.append(Spacer(1, 12))
            continue

        if line.startswith("# ") and not line.startswith("## "):
            story.append(Paragraph(line[2:].strip(), styles["Title"]))
            story.append(Spacer(1, 12))
            continue

        if line.startswith("## "):
            story.append(Paragraph(line[3:].strip(), styles["Section"]))
            story.append(Spacer(1, 6))
            continue

        if line.startswith("### "):
            story.append(Paragraph(line[4:].strip(), styles["Subsection"]))
            story.append(Spacer(1, 4))
            continue

        if line.strip().startswith("|") and "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if parts and not all(c in "-" for c in "".join(parts)):
                row_text = " | ".join(parts[:5])
                add_para(row_text, "Normal")
            continue

        if line.strip().startswith("- ") or line.strip().startswith("* "):
            add_para("• " + line.strip()[2:], "Normal")
            continue

        if len(line) > 2 and line[0].isdigit() and line[1] in ".)":
            add_para(line.strip(), "Normal")
            continue

        if line.strip():
            add_para(line.strip(), "Normal")

    doc.build(story)
    print(f"Generated: {out_path}")
    return 0


if __name__ == "__main__":
    exit(main())
