import re

with open('report.tex', 'r') as f:
    text = f.read()

# Architecture & DB Replacements
text = re.sub(r'Firebase Cloud Functions', 'Flask Backend Services', text)
text = re.sub(r'Firebase Authentication', 'Supabase Authentication', text)
text = re.sub(r'Firebase Analytics', 'System Analytics', text)
text = re.sub(r'Cloud Firestore', 'Supabase PostgreSQL', text)
text = re.sub(r'Firebase Blaze plan', 'Supabase Pro plan', text)
text = re.sub(r'Firebase', 'Supabase', text)
text = re.sub(r'Flutter frontend', 'React frontend', text)
text = re.sub(r'Flutter framework with Dart', 'React framework with TypeScript', text)
text = re.sub(r'\\item\[Flutter\].*?\n', '\\\\item[React] A JavaScript library for building user interfaces.\\n\\\\item[TypeScript] A strongly typed programming language that builds on JavaScript.\\n', text)
text = re.sub(r'Flutter following the high-fidelity', 'React following the high-fidelity', text)
text = re.sub(r'Flutter manages', 'React frontend manages', text)
text = re.sub(r'SQLite database \(via the \\texttt\{sqflite\} Flutter package\)', 'Supabase PostgreSQL database', text)

# SMS & Ingestion Replacements
text = re.sub(r'Android SMS Retriever API combined with regex patterns', 'DocTR and Tesseract OCR models for receipt parsing', text)
text = re.sub(r'The Android SMS Retriever API intercepts incoming SMS messages matching registered hash patterns for MTN MoMo and Airtel Money senders\.', 'The Receipt OCR Subsystem extracts transaction data from uploaded receipt images.', text)
text = re.sub(r'SMS parser', 'Receipt OCR scanner', text)

# LSTM/PSO to Random Forest Replacements
text = re.sub(r'Long Short-Term Memory -- Dense Neural Network \(LSTM-DNN\) architecture optimised', 'Random Forest anomaly detection architecture optimised', text)
text = re.sub(r'Long Short-Term Memory \(LSTM\) and Gated Recurrent Unit \(GRU\) architectures, optimised through Particle Swarm Optimization \(PSO\)', 'Random Forest classification models, optimised via Grid Search', text)
text = re.sub(r'\\item\[LSTM\].*?\n', '', text)
text = re.sub(r'\\item\[GRU\].*?\n', '', text)
text = re.sub(r'Long Short-Term Memory \(LSTM\) networks and Gated Recurrent Units \(GRU\)', 'Random Forest and Isolation Forest models', text)
text = re.sub(r'Hybrid architectures combining LSTM layers with dense', 'Ensemble architectures combining tree-based', text)
text = re.sub(r'LSTM model training', 'Random Forest model training', text)
text = re.sub(r'LSTM forecasting model', 'Random Forest anomaly detector', text)
text = re.sub(r'LSTM Forecast Update', 'Anomaly Detection Update', text)
text = re.sub(r'LSTM-DNN', 'Random Forest', text)
text = re.sub(r'LSTM inference', 'Random Forest inference', text)
text = re.sub(r'LSTM layers', 'Random Forest estimators', text)
text = re.sub(r'LSTM units per layer', 'Maximum depth', text)
text = re.sub(r'LSTM-generated', 'Random Forest-generated', text)
text = re.sub(r'hybrid LSTM-DNN architecture', 'Random Forest and Isolation Forest architecture', text)
text = re.sub(r'TensorFlow Lite', 'Joblib serialized models', text)
text = re.sub(r'TFLite', 'Pickle/Joblib', text)
text = re.sub(r'TensorFlow', 'Scikit-Learn', text)

text = re.sub(r'\\begin\{lstlisting\}\[language=Python, caption=\{LSTM-DNN Forecasting Model Architecture\}\].*?\\end\{lstlisting\}', 
r'''\\begin{lstlisting}[language=Python, caption={Random Forest Anomaly Detection Model Loading}]
def load_anomaly_model():
    """Load anomaly detector (RF, DT, or IForest)."""
    global anomaly_model
    if anomaly_model is None:
        model_paths = [
            "anomaly_rf_pipeline.pkl",
            "anomaly_dt_pipeline.pkl",
            "anomaly_iforest_pipeline.pkl"
        ]
        for model_path in model_paths:
            if os.path.exists(model_path):
                anomaly_model = joblib.load(model_path)
                break
    return True
\\end{lstlisting}''', text, flags=re.DOTALL)

with open('report.tex', 'w') as f:
    f.write(text)

print("Replaced all unimplemented features.")
