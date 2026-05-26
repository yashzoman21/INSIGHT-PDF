import pdfplumber

def detect_pdf_type(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        pages_to_check = pdf.pages[:5]

        for page in pages_to_check:
            text = page.extract_text()
            if not text:
                continue
            if len(text.strip()) >= 50:
                return "TEXT_BASED"

    return "IMAGE_BASED"