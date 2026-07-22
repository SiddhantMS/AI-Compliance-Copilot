import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont

def create_digital_pdf(filename: str, title: str, domain: str, sections: list):
    """Generate a clean digital PDF with selectable text."""
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter

    y = height - 50
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, title)
    y -= 25
    c.setFont("Helvetica-Oblique", 11)
    c.drawString(50, y, f"Bank of India Master Policy | Domain: {domain}")
    y -= 30

    for section_title, paragraphs in sections:
        if y < 100:
            c.showPage()
            y = height - 50

        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, section_title)
        y -= 20
        c.setFont("Helvetica", 10)

        for p in paragraphs:
            # Word wrapping for PDF rendering
            words = p.split()
            line = ""
            for word in words:
                if c.stringWidth(line + " " + word, "Helvetica", 10) < 500:
                    line += (" " if line else "") + word
                else:
                    if y < 60:
                        c.showPage()
                        y = height - 50
                        c.setFont("Helvetica", 10)
                    c.drawString(50, y, line)
                    y -= 15
                    line = word
            if line:
                if y < 60:
                    c.showPage()
                    y = height - 50
                    c.setFont("Helvetica", 10)
                c.drawString(50, y, line)
                y -= 15
            y -= 5

    c.save()

def create_scanned_pdf(filename: str, title: str, domain: str, text_content: str):
    """Generate a scanned PDF (image rendered into PDF) so PyMuPDF yields <50 words and OCR is triggered."""
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    img_width, img_height = 1200, 1600
    img = Image.new("RGB", (img_width, img_height), color=(250, 250, 250))
    draw = ImageDraw.Draw(img)

    try:
        font_title = ImageFont.truetype("arial.ttf", 32)
        font_body = ImageFont.truetype("arial.ttf", 20)
    except IOError:
        font_title = ImageFont.load_default()
        font_body = ImageFont.load_default()

    draw.text((60, 60), title, fill=(0, 0, 0), font=font_title)
    draw.text((60, 110), f"Bank of India Internal Policy (Scanned Archival) | Domain: {domain}", fill=(80, 80, 80), font=font_body)

    lines = []
    words = text_content.split()
    cur_line = ""
    for w in words:
        if len(cur_line + " " + w) < 70:
            cur_line += (" " if cur_line else "") + w
        else:
            lines.append(cur_line)
            cur_line = w
    if cur_line:
        lines.append(cur_line)

    y = 170
    for line in lines:
        draw.text((60, y), line, fill=(20, 20, 20), font=font_body)
        y += 30

    img_path = filename.replace(".pdf", "_page.png")
    img.save(img_path, "PNG")

    c = canvas.Canvas(filename, pagesize=letter)
    c.drawImage(img_path, 0, 0, width=letter[0], height=letter[1])
    c.save()
    if os.path.exists(img_path):
        os.remove(img_path)

def generate_all_sample_bank_policies(output_dir="data/bank_policies"):
    """Generate 5 Bank of India policies (3 scanned, 2 digital as per reference spec)."""
    os.makedirs(output_dir, exist_ok=True)

    # 1. KYC and AML Policy (Digital)
    kyc_sections = [
        ("1. Introduction and Objectives", [
            "Bank of India is committed to preventing money laundering, terrorist financing, and financial crime.",
            "This policy outlines the Customer Due Diligence (CDD), Enhanced Due Diligence (EDD), and Beneficial Ownership identification procedures."
        ]),
        ("2. Customer Identification & Periodic Re-KYC", [
            "Customer identification must be conducted prior to account opening via Official Valid Documents (OVD) or Video-CIP.",
            "High risk accounts require mandatory re-KYC every 2 years. Medium risk accounts require re-KYC every 8 years.",
            "Low risk accounts require re-KYC every 10 years. CKYCR registration must occur within 3 working days of onboarding.",
            "Beneficial Ownership threshold for non-individual accounts is fixed at 10% voting rights or economic interest."
        ]),
        ("3. Suspicious Transaction Reporting (STR)", [
            "All branches must report suspicious transactions to the Principal Officer within 7 business days.",
            "Threshold Monitoring for cash transactions exceeding INR 10 Lakhs is mandatory."
        ])
    ]
    create_digital_pdf(
        os.path.join(output_dir, "BOI_Policy_1_KYC_AML.pdf"),
        "Bank of India Master Policy on KYC and Anti-Money Laundering",
        "KYC/AML",
        kyc_sections
    )

    # 2. Cyber Security & Resilience Policy (Digital)
    cyber_sections = [
        ("1. Governance and Infrastructure Security", [
            "Bank of India maintains a 24x7 Security Operations Centre (SOC) monitoring network traffic and access logs.",
            "All remote management interfaces must enforce Multi-Factor Authentication (MFA) and Zero Trust Access control.",
            "Vulnerability Assessment and Penetration Testing (VAPT) must be executed quarterly by CERT-In empaneled vendors."
        ]),
        ("2. Incident Management & Data Backups", [
            "Cyber incidents must be escalated to the CISO immediately and reported to CERT-In / CSIRT-Fin within 6 hours.",
            "Offline immutable backups of critical core banking and database snapshots must be tested every month."
        ])
    ]
    create_digital_pdf(
        os.path.join(output_dir, "BOI_Policy_2_CyberSecurity.pdf"),
        "Bank of India Cyber Security and Resilience Architecture",
        "Cyber Security",
        cyber_sections
    )

    # 3. Customer Grievance Redressal Policy (Scanned PDF 1 - OCR test)
    scanned_text_1 = (
        "BANK OF INDIA CUSTOMER GRIEVANCE REDRESSAL POLICY 2025-2026. "
        "Domain: Grievance Redressal. "
        "Every customer grievance must be registered in the Internal Complaint Management System with a unique ticket number. "
        "Resolution timeline: Standard complaints within 21 calendar days. Escalation to Internal Ombudsman within 30 days. "
        "Integration with SEBI SCORES 2.0 and RBI Integrated Ombudsman Portal is mandatory for escalated disputes."
    )
    create_scanned_pdf(
        os.path.join(output_dir, "BOI_Policy_3_GrievanceRedressal_Scanned.pdf"),
        "BOI Policy - Customer Grievance Redressal (Archived Scanned)",
        "Grievance Redressal",
        scanned_text_1
    )

    # 4. Fair Lending & Credit Governance Policy (Scanned PDF 2 - OCR test)
    scanned_text_2 = (
        "BANK OF INDIA FAIR LENDING AND CREDIT GOVERNANCE POLICY. "
        "Domain: Lending. "
        "Penal charges for late loan payment must be reasonable and non-capitalized. "
        "Loan agreements must explicitly detail interest rate resetting frequency, benchmark linked interest rates, and loan processing fees. "
        "Margin trading and credit exposure limits must be audited quarterly."
    )
    create_scanned_pdf(
        os.path.join(output_dir, "BOI_Policy_4_FairLending_Scanned.pdf"),
        "BOI Policy - Fair Lending Practice (Archived Scanned)",
        "Lending",
        scanned_text_2
    )

    # 5. Deposit and Treasury Operations Policy (Scanned PDF 3 - OCR test)
    scanned_text_3 = (
        "BANK OF INDIA DEPOSIT & TREASURY RISK POLICY. "
        "Domain: Deposits. "
        "Interest rates on savings and term deposits shall be published transparently across all branches and digital channels. "
        "Unclaimed deposits dormant for over 10 years must be transferred to the Depositor Education and Awareness (DEA) Fund. "
        "Algorithmic trading and treasury execution APIs must maintain strict rate limits and kill switches."
    )
    create_scanned_pdf(
        os.path.join(output_dir, "BOI_Policy_5_DepositTreasury_Scanned.pdf"),
        "BOI Policy - Deposit and Treasury Risk (Archived Scanned)",
        "Deposits",
        scanned_text_3
    )

    print("Successfully generated 5 sample Bank of India policy PDFs in:", output_dir)

if __name__ == "__main__":
    generate_all_sample_bank_policies()
