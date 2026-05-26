import pdfplumber

def extract_text(pdf_path, pdf_type):
   full_text = []

   with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text.append(text)

   return "\n\n".join(full_text)


def extract_pages(pdf_path):
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append((page.page_number, text))
    return pages





