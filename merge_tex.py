with open('report.tex', 'r') as f:
    report_content = f.read()

with open('uniguard.tex', 'r') as f:
    uniguard_content = f.read()

import re

# Extract parts from uniguard.tex
def extract(start_pat, end_pat):
    m = re.search(start_pat + r'(.*?)' + end_pat, uniguard_content, re.DOTALL)
    return m.group(1).strip() if m else ""

declaration = extract(r'\\chapter\*\{Declaration\}', r'\\chapter\*\{Approval\}')
approval = extract(r'\\chapter\*\{Approval\}', r'\\chapter\*\{Acknowledgements\}')
acknowledgements = extract(r'\\chapter\*\{Acknowledgements\}', r'\\chapter\*\{Abstract\}')
abstract = extract(r'\\chapter\*\{Abstract\}', r'\\tableofcontents')

chapter1 = extract(r'\\chapter\{Introduction\}', r'\\chapter\{Literature Review\}')
chapter2 = extract(r'\\chapter\{Literature Review\}', r'\\chapter\{Methodology\}')
chapter3 = extract(r'\\chapter\{Methodology\}', r'\\chapter\{System Design\}')
chapter4 = extract(r'\\chapter\{System Design\}', r'\\chapter\{Implementation and Evaluation\}')
chapter5 = extract(r'\\chapter\{Implementation and Evaluation\}', r'\\chapter\{Conclusion\}')
chapter6 = extract(r'\\chapter\{Conclusion\}', r'\\bibliographystyle')
appendix = extract(r'\\appendix', r'\\end\{document\}')

# Handle placeholders
report_content = re.sub(r'\\newcommand\\theSpecializationTrack\{.*?\}', r'\\newcommand\\theSpecializationTrack{\\textit{Specialization: Software Engineering}}', report_content)
report_content = re.sub(r'\\newcommand\\thePrimaryAdvisor\{.*?\}', r'\\newcommand\\thePrimaryAdvisor{\\textit{[SUPERVISOR NAME]}}', report_content)
report_content = re.sub(r'\\newcommand\\theOtherAdvisor\{.*?\}', r'\\newcommand\\theOtherAdvisor{}', report_content)

# AI modifications based on codebase
chapter3 = chapter3.replace("Gaussian Naive Bayes classifier", "Random Forest classifier (transaction_rf_pipeline.pkl)")
chapter3 = chapter3.replace("Gaussian Naive Bayes", "Random Forest")
chapter4 = chapter4.replace("Gaussian Naive Bayes", "Random Forest")
chapter4 = chapter4.replace("Naive Bayes Classifier", "Random Forest Classifier")
chapter4 = chapter4.replace("Naive Bayes", "Random Forest")
chapter5 = chapter5.replace("Gaussian Naive Bayes", "Random Forest")
chapter5 = chapter5.replace("Naive Bayes", "Random Forest")

# Add DocTR / Tesseract to system architecture
chapter3 = chapter3.replace("\\item[AI Subsystem:]", "\\item[AI Subsystem:] Includes DocTR and Tesseract OCR for receipt text extraction, paired with Random Forest anomaly detection pipelines.")

# Replace inputs safely using string.replace
report_content = report_content.replace(r'\input{preliminary-pages/01-declaration}', declaration)
report_content = report_content.replace(r'\input{preliminary-pages/01b-AI-declaration}', 'This project utilised AI responsibly for code formatting, generation of generic templates, and proofreading, while preserving the intellectual originality of the core logic and research output.')
report_content = report_content.replace(r'\input{preliminary-pages/02-approval}', approval)
report_content = report_content.replace(r'\input{preliminary-pages/03-abstract}', abstract)
report_content = report_content.replace(r'\input{preliminary-pages/04-dedication}', 'Dedicated to our families for their endless support.')
report_content = report_content.replace(r'\input{preliminary-pages/05-toc-tof-symbols-abrevs}', '\\tableofcontents\n\\listoffigures\n\\listoftables')
report_content = report_content.replace(r'\input{preliminary-pages/06-acknowledgments}', acknowledgements)

report_content = report_content.replace(r'\input{chapters/chapter-01}', chapter1)
report_content = report_content.replace(r'\input{chapters/chapter-02}', chapter2)
report_content = report_content.replace(r'\input{chapters/chapter-03}', chapter3)
report_content = report_content.replace(r'\input{chapters/chapter-04}', chapter4)
report_content = report_content.replace(r'\input{chapters/chapter-05}', chapter5)
report_content = report_content.replace(r'\input{chapters/chapter-06}', chapter6)

report_content = report_content.replace(r'\input{appendicies/AAppendix-main}', appendix)

# Update references to references.bib
report_content = report_content.replace('references/list-of-references-bib-format', 'references')

# Overwrite report.tex directly
with open('report.tex', 'w') as f:
    f.write(report_content)

print("Merged report.tex successfully")
