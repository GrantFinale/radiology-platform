"""Text preprocessing utilities for cleaning and structuring OCR text.

Provides functions to clean OCR artifacts, segment documents into logical
sections, and extract key-value pairs from semi-structured text.
"""

from __future__ import annotations

import re
from typing import Optional


# Common OCR misreads and their corrections
OCR_CORRECTIONS: dict[str, str] = {
    r"\bl\b(?=[A-Z])": "I",        # lowercase L before uppercase (likely I)
    r"\bO(?=\d)": "0",             # O before digits (likely 0)
    r"(?<=\d)O\b": "0",           # O after digits (likely 0)
    r"(?<=\d)l(?=\d)": "1",       # lowercase L between digits (likely 1)
    r"\brn\b": "m",               # rn often misread as m
    r"\bcl\b": "d",               # cl often misread as d
    r"\bvv\b": "w",               # vv often misread as w
    r"(?<=\s)II(?=\s)": "ll",     # II often misread for ll
}

# Characters that are common OCR noise
NOISE_CHARS_PATTERN = re.compile(r"[~`\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# Multiple consecutive whitespace (but not newlines)
MULTI_SPACE_PATTERN = re.compile(r"[^\S\n]{2,}")

# Multiple consecutive blank lines
MULTI_NEWLINE_PATTERN = re.compile(r"\n{4,}")

# Page break / form feed indicators
PAGE_BREAK_PATTERN = re.compile(
    r"(?:\f|---+\s*Page\s*\d+\s*(?:of\s*\d+)?\s*---+|\*{3,}|={3,}\s*\n)",
    re.IGNORECASE,
)

# Header/footer noise common in faxed documents
FAX_HEADER_PATTERN = re.compile(
    r"^(?:\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\s+"
    r"(?:FROM|TO|FAX|PAGE)\s*.*)$",
    re.IGNORECASE | re.MULTILINE,
)

# Section header patterns for segmentation
SECTION_HEADER_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^([A-Z][A-Z\s/&]{2,})\s*:\s*$", re.MULTILINE),
    re.compile(r"^([A-Z][A-Z\s/&]{2,})$", re.MULTILINE),
    re.compile(
        r"^(?:Patient\s*Information|Clinical\s*Information|Procedure\s*Information|"
        r"Provider\s*Information|Insurance\s*Information|Diagnosis|History|"
        r"Indication|Special\s*Instructions|Notes|Comments|Allergies|"
        r"Medications|Ordering\s*Information|Demographics|Referral\s*Information)"
        r"\s*:?\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
]

# Key-value pair patterns
KEY_VALUE_PATTERNS: list[re.Pattern[str]] = [
    # "Key: Value" on same line
    re.compile(r"^([A-Za-z][A-Za-z\s.#/()]{1,40}?)\s*:\s*(.+?)$", re.MULTILINE),
    # "Key .... Value" (dot leader)
    re.compile(r"^([A-Za-z][A-Za-z\s.#/()]{1,40}?)\s*\.{3,}\s*(.+?)$", re.MULTILINE),
    # "Key ___ Value" (underline leader)
    re.compile(r"^([A-Za-z][A-Za-z\s.#/()]{1,40}?)\s*_{3,}\s*(.+?)$", re.MULTILINE),
    # "Key     Value" (wide tab/space separated)
    re.compile(r"^([A-Za-z][A-Za-z\s.#/()]{1,30}?)\s{4,}(\S.+?)$", re.MULTILINE),
]


def clean_ocr_text(text: str) -> str:
    """Clean OCR text by removing artifacts and fixing common misreads.

    Performs the following cleaning steps:
    1. Remove null bytes and control characters
    2. Normalize whitespace
    3. Remove fax header/footer noise
    4. Normalize page breaks
    5. Fix common OCR character misreads
    6. Collapse excessive blank lines

    Args:
        text: Raw OCR text to clean.

    Returns:
        Cleaned text suitable for entity extraction.
    """
    if not text:
        return ""

    # Step 1: Remove control characters and noise
    cleaned = NOISE_CHARS_PATTERN.sub("", text)

    # Step 2: Normalize whitespace (preserve newlines)
    cleaned = MULTI_SPACE_PATTERN.sub(" ", cleaned)

    # Step 3: Remove fax header/footer lines
    cleaned = FAX_HEADER_PATTERN.sub("", cleaned)

    # Step 4: Normalize page breaks to double newline
    cleaned = PAGE_BREAK_PATTERN.sub("\n\n", cleaned)

    # Step 5: Apply OCR character corrections
    for pattern_str, replacement in OCR_CORRECTIONS.items():
        cleaned = re.sub(pattern_str, replacement, cleaned)

    # Step 6: Collapse excessive blank lines
    cleaned = MULTI_NEWLINE_PATTERN.sub("\n\n\n", cleaned)

    # Final trim
    cleaned = cleaned.strip()

    return cleaned


def segment_sections(text: str) -> dict[str, str]:
    """Split a document into logical named sections.

    Identifies section headers in the text and splits the content into
    a dictionary keyed by section name. Content before any recognized
    section header is placed under the key "preamble".

    Args:
        text: Cleaned document text to segment.

    Returns:
        Dictionary mapping section names to their content.
        Always contains at least a "preamble" or "full_text" key.
    """
    if not text:
        return {"full_text": ""}

    # Find all section header positions
    headers: list[tuple[int, int, str]] = []  # (start, end, header_name)

    for pattern in SECTION_HEADER_PATTERNS:
        for match in pattern.finditer(text):
            header_text = match.group(1) if match.lastindex else match.group(0)
            header_name = _normalize_section_name(header_text)
            headers.append((match.start(), match.end(), header_name))

    if not headers:
        # No sections found — return entire text
        return {"full_text": text}

    # Sort by position
    headers.sort(key=lambda h: h[0])

    # Remove overlapping headers (keep first occurrence)
    filtered: list[tuple[int, int, str]] = []
    for header in headers:
        if not filtered or header[0] >= filtered[-1][1]:
            filtered.append(header)
    headers = filtered

    sections: dict[str, str] = {}

    # Content before first header
    preamble = text[: headers[0][0]].strip()
    if preamble:
        sections["preamble"] = preamble

    # Extract each section
    for i, (_, end, name) in enumerate(headers):
        if i + 1 < len(headers):
            content = text[end : headers[i + 1][0]].strip()
        else:
            content = text[end:].strip()

        if content:
            # If duplicate section name, append with counter
            final_name = name
            counter = 2
            while final_name in sections:
                final_name = f"{name}_{counter}"
                counter += 1
            sections[final_name] = content

    return sections


def extract_key_value_pairs(text: str) -> dict[str, str]:
    """Extract "Label: Value" patterns from semi-structured text.

    Scans the text for key-value patterns commonly found in medical forms,
    including colon-separated, dot-leader, underline-leader, and
    space-separated formats.

    Args:
        text: Text to extract key-value pairs from.

    Returns:
        Dictionary mapping normalized key names to their values.
        Duplicate keys are overwritten by later occurrences.
    """
    if not text:
        return {}

    pairs: dict[str, str] = {}

    for pattern in KEY_VALUE_PATTERNS:
        for match in pattern.finditer(text):
            key = match.group(1).strip()
            value = match.group(2).strip()

            # Skip if key or value is too short or too long
            if len(key) < 2 or len(value) < 1 or len(value) > 500:
                continue

            # Skip if key looks like a sentence rather than a label
            if " " in key and len(key.split()) > 5:
                continue

            # Normalize the key
            normalized_key = _normalize_key(key)
            if normalized_key:
                pairs[normalized_key] = value

    return pairs


def _normalize_section_name(header: str) -> str:
    """Normalize a section header to a consistent key format.

    Args:
        header: Raw section header text.

    Returns:
        Normalized lowercase section name with underscores.
    """
    cleaned = header.strip().lower()
    cleaned = re.sub(r"[^a-z0-9\s]", "", cleaned)
    cleaned = re.sub(r"\s+", "_", cleaned)
    return cleaned


def _normalize_key(key: str) -> Optional[str]:
    """Normalize a key-value pair key to a consistent format.

    Args:
        key: Raw key text from a key-value pair.

    Returns:
        Normalized lowercase key with underscores, or None if invalid.
    """
    cleaned = key.strip().lower()
    cleaned = re.sub(r"[^a-z0-9\s]", "", cleaned)
    cleaned = re.sub(r"\s+", "_", cleaned)

    if not cleaned or len(cleaned) < 2:
        return None

    return cleaned
