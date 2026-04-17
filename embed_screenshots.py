import re

with open('report.tex', 'r') as f:
    content = f.read()

# Insert the UI screenshot into the Application Screen Architecture section
ui_figure = """
\\begin{figure}[H]
\\centering
\\includegraphics[width=0.85\\textwidth]{/home/mukama/.gemini/antigravity/brain/090a4a62-df78-4ba8-8882-18b00cbe6561/browser/login_page_1776453699653.png}
\\caption{UniGuard Wallet Web Application Login Interface (React/TypeScript)}
\\label{fig:login_ui}
\\end{figure}
"""

content = content.replace("The application comprises six primary navigation sections:", ui_figure + "\n\nThe application comprises six primary navigation sections:")

# Insert the model metric screenshots into the Forecasting Model Results section
metric_figures = """
\\begin{figure}[H]
\\centering
\\includegraphics[width=0.85\\textwidth]{/home/mukama/Pictures/smart-personal-finance/model_img1.png}
\\caption{Random Forest Anomaly Detection Performance Metrics}
\\label{fig:anomaly_metrics}
\\end{figure}

\\begin{figure}[H]
\\centering
\\includegraphics[width=0.85\\textwidth]{/home/mukama/Pictures/smart-personal-finance/train_transaction_categorizer_img1.png}
\\caption{Transaction Categorization Model Performance}
\\label{fig:category_metrics}
\\end{figure}
"""

content = content.replace("\\section{System Performance Metrics}", metric_figures + "\n\n\\section{System Performance Metrics}")

with open('report.tex', 'w') as f:
    f.write(content)

print("Embedded screenshots into report.tex")
