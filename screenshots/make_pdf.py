import mistune
from weasyprint import HTML, CSS
import os

md_path = "../AGENT_ONBOARDING.md"
pdf_path = "../Agent_Onboarding.pdf"

with open(md_path, "r", encoding="utf-8") as f:
    md_content = f.read()

# Insert placeholders for screenshots
# 1. After "- **Dashboard**: A quick overview of your metrics and urgent tasks."
md_content = md_content.replace(
    "- **Dashboard**: A quick overview of your metrics and urgent tasks.",
    "- **Dashboard**: A quick overview of your metrics and urgent tasks.\n\n![Agent Dashboard](https://placehold.co/1000x500/e2e8f0/475569.png?text=Agent+Dashboard)\n"
)

# 2. After "- **Search**: Find specific tickets quickly."
md_content = md_content.replace(
    "- **Search**: Find specific tickets quickly.",
    "- **Search**: Find specific tickets quickly.\n\n![Inbox View](https://placehold.co/1000x500/e2e8f0/475569.png?text=Inbox+View)\n"
)

# 3. After "4. Save to generate the ticket. It will instantly appear in the Inbox."
md_content = md_content.replace(
    "4. Save to generate the ticket. It will instantly appear in the Inbox.",
    "4. Save to generate the ticket. It will instantly appear in the Inbox.\n\n![Create Ticket](https://placehold.co/1000x500/e2e8f0/475569.png?text=Create+Ticket+Modal)\n"
)

# 4. After "4. The system updates the ticket assignment immediately. You can view all your assigned tickets by clicking the **\"My Tickets\"** filter in the Inbox."
md_content = md_content.replace(
    "clicking the **\"My Tickets\"** filter in the Inbox.",
    "clicking the **\"My Tickets\"** filter in the Inbox.\n\n![Ticket Detail](https://placehold.co/1000x600/e2e8f0/475569.png?text=Ticket+Detail+View)\n"
)

# 5. After "4. Click **\"Create Sub-Ticket\"**."
md_content = md_content.replace(
    "4. Click **\"Create Sub-Ticket\"**.",
    "4. Click **\"Create Sub-Ticket\"**.\n\n![Create Sub-Ticket](https://placehold.co/1000x500/e2e8f0/475569.png?text=Delegate+/+Create+Sub-Ticket)\n"
)

# Convert Markdown to HTML
html_content = mistune.html(md_content)

# HTML Wrapper with CSS for a beautiful PDF
full_html = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page {{
        size: A4;
        margin: 2cm;
    }}
    body {{
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        font-size: 14px;
    }}
    h1 {{
        color: #2563eb;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 10px;
        margin-top: 0;
    }}
    h2 {{
        color: #1e40af;
        margin-top: 30px;
    }}
    h3 {{
        color: #1d4ed8;
    }}
    img {{
        max-width: 100%;
        height: auto;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        margin: 15px 0;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }}
    ul, ol {{
        margin-bottom: 20px;
    }}
    li {{
        margin-bottom: 5px;
    }}
    code {{
        background-color: #f1f5f9;
        padding: 2px 5px;
        border-radius: 4px;
        font-family: monospace;
        color: #ef4444;
    }}
    hr {{
        border: 0;
        border-top: 1px solid #e5e7eb;
        margin: 30px 0;
    }}
</style>
</head>
<body>
    {html_content}
</body>
</html>
"""

print("Generating PDF...")
HTML(string=full_html).write_pdf(pdf_path)
print(f"PDF successfully generated at {{pdf_path}}")
