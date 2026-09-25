import os
import subprocess
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANUALS_DIR = os.path.join(BASE_DIR, "manuales")
os.makedirs(MANUALS_DIR, exist_ok=True)

EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(EDGE_EXE):
    EDGE_EXE = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

COMMON_CSS = """
@page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0F172A;
    background-color: #FFFFFF;
    line-height: 1.55;
    font-size: 12.5px;
}

/* Portada */
.cover {
    height: 98vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 45px 35px;
    background: linear-gradient(135deg, #0A2540 0%, #0F3258 50%, #1E40AF 100%);
    color: #FFFFFF;
    page-break-after: always;
    border-radius: 8px;
}

.cover-top {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.cover-badge {
    background: rgba(255, 255, 255, 0.15);
    color: #93C5FD;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-bottom: 25px;
    border: 1px solid rgba(255, 255, 255, 0.25);
}

.cover-brand {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: -1px;
    color: #FFFFFF;
    margin-bottom: 30px;
}

.cover-brand span {
    color: #60A5FA;
}

.cover h1 {
    font-size: 34px;
    line-height: 1.18;
    font-weight: 800;
    color: #FFFFFF;
    margin-bottom: 15px;
    max-width: 620px;
}

.cover .cover-subtitle {
    font-size: 16px;
    color: #E2E8F0;
    line-height: 1.45;
    max-width: 580px;
    font-weight: 400;
}

.cover-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 18px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #CBD5E1;
}

/* Encabezados y títulos */
.header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #E2E8F0;
    padding-bottom: 8px;
    margin-bottom: 22px;
}

.header-brand {
    font-size: 15px;
    font-weight: 800;
    color: #0A2540;
}

.header-brand span {
    color: #2563EB;
}

.header-doc-title {
    font-size: 11px;
    font-weight: 600;
    color: #64748B;
    letter-spacing: 0.5px;
}

h2 {
    color: #0A2540;
    font-size: 19px;
    font-weight: 800;
    margin-top: 24px;
    margin-bottom: 10px;
    border-bottom: 1.5px solid #E2E8F0;
    padding-bottom: 5px;
    page-break-after: avoid;
}

h3 {
    color: #1E40AF;
    font-size: 14.5px;
    font-weight: 700;
    margin-top: 16px;
    margin-bottom: 6px;
    page-break-after: avoid;
}

h4 {
    color: #334155;
    font-size: 12.5px;
    font-weight: 700;
    margin-top: 12px;
    margin-bottom: 4px;
    page-break-after: avoid;
}

p {
    margin-bottom: 9px;
    color: #334155;
    text-align: justify;
}

ul, ol {
    margin-left: 20px;
    margin-bottom: 10px;
    color: #334155;
}

li {
    margin-bottom: 4px;
}

strong {
    color: #0F172A;
}

code {
    background-color: #F1F5F9;
    color: #0F172A;
    font-family: Consolas, "Courier New", monospace;
    font-size: 11px;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid #CBD5E1;
}

pre {
    background-color: #0F172A;
    color: #F8FAFC;
    font-family: Consolas, "Courier New", monospace;
    font-size: 11px;
    padding: 10px 12px;
    border-radius: 6px;
    margin: 8px 0 12px 0;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    page-break-inside: avoid;
    border-left: 4px solid #3B82F6;
}

pre code {
    background: none;
    color: inherit;
    padding: 0;
    border: none;
}

/* Tablas */
.table-responsive {
    margin: 12px 0;
    page-break-inside: avoid;
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
    background: #FFFFFF;
}

th, td {
    padding: 7px 9px;
    border: 1px solid #CBD5E1;
    text-align: left;
    vertical-align: top;
}

th {
    background-color: #F1F5F9;
    color: #0A2540;
    font-weight: 700;
}

tr:nth-child(even) td {
    background-color: #F8FAFC;
}

/* Cajas de alerta */
.alert-box {
    padding: 10px 12px;
    border-radius: 6px;
    margin: 10px 0;
    page-break-inside: avoid;
    font-size: 11.5px;
    line-height: 1.45;
}

.alert-info {
    background-color: #EFF6FF;
    border-left: 4px solid #3B82F6;
    color: #1E40AF;
}

.alert-success {
    background-color: #ECFDF5;
    border-left: 4px solid #10B981;
    color: #065F46;
}

.alert-warning {
    background-color: #FFFBEB;
    border-left: 4px solid #F59E0B;
    color: #92400E;
}

.alert-danger {
    background-color: #FEF2F2;
    border-left: 4px solid #EF4444;
    color: #991B1B;
}

/* Badges de Riesgo */
.tier-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 12px;
    font-size: 10.5px;
    font-weight: 700;
}

.tier-a {
    background-color: #D1FAE5;
    color: #065F46;
    border: 1px solid #A7F3D0;
}

.tier-b {
    background-color: #FEF3C7;
    color: #92400E;
    border: 1px solid #FDE68A;
}

.tier-c {
    background-color: #FFEDD5;
    color: #9A3412;
    border: 1px solid #FED7AA;
}

/* Grillas y tarjetas */
.card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 12px 0;
    page-break-inside: avoid;
}

.card {
    border: 1px solid #E2E8F0;
    border-radius: 6px;
    padding: 10px;
    background: #FFFFFF;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

.card h4 {
    margin-top: 0;
    color: #0A2540;
    font-size: 12px;
    border-bottom: 1px solid #F1F5F9;
    padding-bottom: 3px;
}

/* Pasos */
.step-item {
    display: flex;
    margin-bottom: 8px;
    align-items: flex-start;
    page-break-inside: avoid;
}

.step-num {
    background: #0A2540;
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10.5px;
    font-weight: bold;
    margin-right: 9px;
    flex-shrink: 0;
}

.page-break {
    page-break-before: always;
}
"""

def generate_pdf(html_content, output_pdf_path):
    temp_html = output_pdf_path.replace(".pdf", ".html")
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    cmd = [
        EDGE_EXE,
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--run-all-compositor-stages-before-draw",
        f"--print-to-pdf={output_pdf_path}",
        temp_html
    ]
    
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(output_pdf_path):
        size_kb = os.path.getsize(output_pdf_path) / 1024
        print(f"[OK] PDF Generado con exito: {os.path.basename(output_pdf_path)} ({size_kb:.1f} KB)")
        # Copy to root as well
        root_copy = os.path.join(BASE_DIR, os.path.basename(output_pdf_path))
        shutil.copyfile(output_pdf_path, root_copy)
        print(f"  -> Copia lista en raiz: {os.path.basename(root_copy)}")
    else:
        print(f"[ERROR] Error al generar {output_pdf_path}: {res.stderr}")

print("Generador configurado exitosamente.")
