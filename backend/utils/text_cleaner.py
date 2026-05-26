import re


def remove_repeated_headers(text):
    """
    Removes lines that repeat many times (headers / footers).
    """
    lines = text.split("\n")
    line_frequency = {}

    for line in lines:
        clean_line = line.strip()
        if clean_line:
            line_frequency[clean_line] = line_frequency.get(clean_line, 0) + 1

    cleaned_lines = []
    for line in lines:
        clean_line = line.strip()
        # If a line appears many times, consider it a header/footer
        if clean_line and line_frequency.get(clean_line, 0) > 3:
            continue
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def remove_page_numbers(text):
    """
    Removes common page number patterns.
    """
    cleaned_lines = []

    for line in text.split("\n"):
        line_clean = line.strip().lower()

        # Matches: "1", "Page 1", "1/10"
        if re.fullmatch(r"(page\s*)?\d+(\s*/\s*\d+)?", line_clean):
            continue

        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def normalize_whitespace(text):
    """
    Normalizes spaces and newlines.
    """
    # Replace multiple spaces with single space
    text = re.sub(r"[ \t]+", " ", text)

    # Replace many newlines with max two
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def basic_deduplication(text):
    """
    Removes duplicate lines while preserving order.
    """
    seen = set()
    cleaned_lines = []

    for line in text.split("\n"):
        clean_line = line.strip()
        if clean_line and clean_line not in seen:
            seen.add(clean_line)
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def clean_text(text: str) -> str:
    """
    Full text cleaning pipeline.
    Order matters.
    """
    text = remove_repeated_headers(text)
    text = remove_page_numbers(text)
    text = basic_deduplication(text)
    text = normalize_whitespace(text)
    return text
