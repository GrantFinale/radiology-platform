"""Main clinical data extraction engine.

Combines regex pattern matching with spaCy NER to extract structured clinical
information from unstructured OCR text. Handles multiple document formats
including fax cover sheets, referral forms, and handwritten notes.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

import spacy
from spacy.language import Language

from src.config import settings
from src.extractors.pattern_library import (
    CLINICAL_INDICATION_PATTERNS,
    CONTRAST_ALLERGY_PATTERN,
    CPT_RADIOLOGY_PATTERN,
    DIAGNOSIS_PATTERNS,
    DOB_PATTERNS,
    ICD10_CODE_PATTERN,
    IMPLANT_PATTERN,
    MRN_PATTERNS,
    NPI_PATTERNS,
    ORDERING_PROVIDER_PATTERNS,
    PATIENT_NAME_PATTERNS,
    PREGNANCY_PATTERN,
    PROCEDURE_PATTERNS,
    SPECIAL_INSTRUCTION_PATTERNS,
    detect_body_parts,
    detect_laterality,
    detect_modality,
    detect_urgency,
    search_patterns,
)
from src.models import ExtractionResult
from src.utils.text_preprocessor import (
    clean_ocr_text,
    extract_key_value_pairs,
    segment_sections,
)

logger = logging.getLogger(__name__)

# Lazy-loaded spaCy model
_nlp: Optional[Language] = None


def _get_nlp() -> Language:
    """Get or load the spaCy NLP model.

    Returns:
        Loaded spaCy language model.
    """
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load(settings.spacy_model)
            logger.info("Loaded spaCy model: %s", settings.spacy_model)
        except OSError:
            logger.warning(
                "spaCy model '%s' not found. Falling back to blank 'en' model.",
                settings.spacy_model,
            )
            _nlp = spacy.blank("en")
    return _nlp


def is_spacy_loaded() -> bool:
    """Check if the spaCy model has been loaded.

    Returns:
        True if the model is loaded, False otherwise.
    """
    return _nlp is not None


def extract_clinical_data(
    text: str,
    doc_type: str = "unknown",
) -> ExtractionResult:
    """Extract clinical data from OCR text.

    Performs the following extraction pipeline:
    1. Clean and preprocess the OCR text
    2. Segment the document into logical sections
    3. Extract key-value pairs from structured portions
    4. Apply regex pattern matching for specific fields
    5. Run spaCy NER for person name detection
    6. Detect modality, body part, laterality, and urgency
    7. Extract embedded ICD-10 and CPT codes
    8. Collect special instructions and safety flags
    9. Compute confidence scores for each extracted field

    Args:
        text: Raw OCR text to extract from.
        doc_type: Type of document (fax_cover, referral_form,
                  handwritten_note, report, unknown).

    Returns:
        ExtractionResult with all extracted fields and confidence scores.
    """
    if not text or not text.strip():
        return ExtractionResult(
            confidence_scores={"overall": 0.0},
        )

    # Step 1: Clean text
    cleaned = clean_ocr_text(text)

    # Step 2: Segment into sections
    sections = segment_sections(cleaned)
    full_text = cleaned  # Keep full text for pattern matching

    # Step 3: Extract key-value pairs
    kv_pairs = extract_key_value_pairs(cleaned)

    # Step 4-9: Extract individual fields
    confidence_scores: dict[str, float] = {}

    # Extract patient name
    patient_name, name_conf = _extract_patient_name(full_text, kv_pairs)
    if patient_name:
        confidence_scores["patient_name"] = name_conf

    # Extract patient DOB
    patient_dob, dob_conf = _extract_dob(full_text, kv_pairs)
    if patient_dob:
        confidence_scores["patient_dob"] = dob_conf

    # Extract MRN
    patient_mrn, mrn_conf = _extract_mrn(full_text, kv_pairs)
    if patient_mrn:
        confidence_scores["patient_mrn"] = mrn_conf

    # Extract ordering provider
    ordering_provider, provider_conf = _extract_ordering_provider(full_text, kv_pairs)
    if ordering_provider:
        confidence_scores["ordering_provider"] = provider_conf

    # Extract NPI
    provider_npi, npi_conf = _extract_npi(full_text, kv_pairs)
    if provider_npi:
        confidence_scores["provider_npi"] = npi_conf

    # Extract procedure description
    procedure_desc, proc_conf = _extract_procedure(full_text, sections, kv_pairs)
    if procedure_desc:
        confidence_scores["procedure_description"] = proc_conf

    # Extract clinical indication
    clinical_indication, ind_conf = _extract_clinical_indication(
        full_text, sections, kv_pairs
    )
    if clinical_indication:
        confidence_scores["clinical_indication"] = ind_conf

    # Extract diagnosis
    diagnosis, diag_conf = _extract_diagnosis(full_text, sections, kv_pairs)
    if diagnosis:
        confidence_scores["diagnosis"] = diag_conf

    # Extract embedded ICD-10 codes
    icd10_codes = _extract_icd10_codes(full_text)

    # Extract embedded CPT codes
    cpt_codes = _extract_cpt_codes(full_text)

    # Detect urgency
    urgency, urgency_conf = detect_urgency(full_text)
    confidence_scores["urgency"] = urgency_conf

    # Detect laterality
    laterality, lat_conf = detect_laterality(full_text)
    if laterality:
        confidence_scores["laterality"] = lat_conf

    # Detect body part
    body_part, bp_conf = _extract_body_part(full_text, procedure_desc)
    if body_part:
        confidence_scores["body_part"] = bp_conf

    # Detect modality
    modality, mod_conf = detect_modality(full_text)
    if modality:
        confidence_scores["modality"] = mod_conf

    # Extract special instructions
    special_instructions = _extract_special_instructions(full_text, sections)

    # Adjust confidence based on document type
    confidence_scores = _adjust_confidence_for_doc_type(
        confidence_scores, doc_type
    )

    # Calculate overall confidence
    if confidence_scores:
        field_scores = [
            v for k, v in confidence_scores.items() if k != "overall"
        ]
        confidence_scores["overall"] = (
            sum(field_scores) / len(field_scores) if field_scores else 0.0
        )
    else:
        confidence_scores["overall"] = 0.0

    return ExtractionResult(
        patient_name=patient_name,
        patient_dob=patient_dob,
        patient_mrn=patient_mrn,
        ordering_provider=ordering_provider,
        provider_npi=provider_npi,
        procedure_description=procedure_desc,
        clinical_indication=clinical_indication,
        diagnosis=diagnosis,
        icd10_codes=icd10_codes,
        cpt_codes=cpt_codes,
        urgency=urgency,
        laterality=laterality,
        body_part=body_part,
        modality=modality,
        special_instructions=special_instructions,
        confidence_scores=confidence_scores,
    )


# ---------------------------------------------------------------------------
# Private extraction helpers
# ---------------------------------------------------------------------------


def _extract_patient_name(
    text: str,
    kv_pairs: dict[str, str],
) -> tuple[Optional[str], float]:
    """Extract patient name from text using patterns and spaCy NER.

    Args:
        text: Full document text.
        kv_pairs: Extracted key-value pairs.

    Returns:
        Tuple of (patient_name, confidence_score).
    """
    # Try key-value pairs first (highest confidence)
    for key in ["patient_name", "patient", "pt_name", "name"]:
        if key in kv_pairs:
            name = kv_pairs[key].strip()
            if len(name) > 2 and not name.isdigit():
                return (name, 0.95)

    # Try regex patterns
    results = search_patterns(text, PATIENT_NAME_PATTERNS)
    if results:
        return results[0]

    # Fall back to spaCy NER
    nlp = _get_nlp()
    doc = nlp(text[:5000])  # Limit to first 5000 chars for performance
    persons = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
    if persons:
        # The first PERSON entity near the top of the document is likely the patient
        return (persons[0], 0.60)

    return (None, 0.0)


def _extract_dob(
    text: str,
    kv_pairs: dict[str, str],
) -> tuple[Optional[str], float]:
    """Extract date of birth from text.

    Args:
        text: Full document text.
        kv_pairs: Extracted key-value pairs.

    Returns:
        Tuple of (dob_string, confidence_score).
    """
    # Try key-value pairs
    for key in ["dob", "date_of_birth", "birth_date", "birthdate"]:
        if key in kv_pairs:
            return (kv_pairs[key].strip(), 0.95)

    # Try regex patterns
    results = search_patterns(text, DOB_PATTERNS)
    if results:
        return results[0]

    return (None, 0.0)


def _extract_mrn(
    text: str,
    kv_pairs: dict[str, str],
) -> tuple[Optional[str], float]:
    """Extract medical record number from text.

    Args:
        text: Full document text.
        kv_pairs: Extracted key-value pairs.

    Returns:
        Tuple of (mrn_string, confidence_score).
    """
    # Try key-value pairs
    for key in ["mrn", "medical_record_number", "patient_id", "pt_id", "chart_no", "acct_no"]:
        if key in kv_pairs:
            value = kv_pairs[key].strip()
            if value and re.match(r"\d{5,12}", value):
                return (value, 0.95)

    # Try regex patterns
    results = search_patterns(text, MRN_PATTERNS)
    if results:
        return results[0]

    return (None, 0.0)


def _extract_ordering_provider(
    text: str,
    kv_pairs: dict[str, str],
) -> tuple[Optional[str], float]:
    """Extract ordering provider name from text.

    Args:
        text: Full document text.
        kv_pairs: Extracted key-value pairs.

    Returns:
        Tuple of (provider_name, confidence_score).
    """
    # Try key-value pairs
    for key in [
        "ordering_physician",
        "ordering_provider",
        "referring_physician",
        "referring_provider",
        "ordered_by",
        "requested_by",
        "ref_phys",
        "referring_dr",
    ]:
        if key in kv_pairs:
            name = kv_pairs[key].strip()
            if len(name) > 2:
                return (name, 0.90)

    # Try regex patterns
    results = search_patterns(text, ORDERING_PROVIDER_PATTERNS)
    if results:
        return results[0]

    return (None, 0.0)


def _extract_npi(
    text: str,
    kv_pairs: dict[str, str],
) -> tuple[Optional[str], float]:
    """Extract provider NPI number from text.

    Args:
        text: Full document text.
        kv_pairs: Extracted key-value pairs.

    Returns:
        Tuple of (npi_string, confidence_score).
    """
    for key in ["npi", "national_provider_identifier"]:
        if key in kv_pairs:
            value = kv_pairs[key].strip()
            if re.match(r"\d{10}$", value):
                return (value, 0.95)

    results = search_patterns(text, NPI_PATTERNS)
    if results:
        return results[0]

    return (None, 0.0)


def _extract_procedure(
    text: str,
    sections: dict[str, str],
    kv_pairs: dict[str, str],
) -> tuple[Optional[str], float]:
    """Extract procedure description from text.

    Args:
        text: Full document text.
        sections: Segmented document sections.
        kv_pairs: Extracted key-value pairs.

    Returns:
        Tuple of (procedure_description, confidence_score).
    """
    # Try key-value pairs
    for key in [
        "procedure_requested",
        "exam_requested",
        "study_requested",
        "procedure",
        "examination",
        "study",
        "order_for",
    ]:
        if key in kv_pairs:
            value = kv_pairs[key].strip()
            if len(value) > 3:
                return (value, 0.90)

    # Try section content
    for section_key in [
        "procedure_information",
        "procedure",
        "examination",
        "study",
    ]:
        if section_key in sections:
            content = sections[section_key].strip()
            if content:
                # Take first meaningful line
                first_line = content.split("\n")[0].strip()
                if len(first_line) > 3:
                    return (first_line, 0.80)

    # Try regex patterns
    results = search_patterns(text, PROCEDURE_PATTERNS)
    if results:
        # Clean up the matched text
        procedure_text = results[0][0].strip()
        # Remove trailing labels that might have been captured
        procedure_text = re.sub(
            r"\s*(?:Clinical|Indication|Diagnosis|History|Date|Phone|Fax)\s*:.*$",
            "",
            procedure_text,
            flags=re.IGNORECASE,
        )
        if len(procedure_text) > 3:
            return (procedure_text, results[0][1])

    return (None, 0.0)


def _extract_clinical_indication(
    text: str,
    sections: dict[str, str],
    kv_pairs: dict[str, str],
) -> tuple[Optional[str], float]:
    """Extract clinical indication from text.

    Args:
        text: Full document text.
        sections: Segmented document sections.
        kv_pairs: Extracted key-value pairs.

    Returns:
        Tuple of (clinical_indication, confidence_score).
    """
    for key in [
        "clinical_indication",
        "indication",
        "clinical_information",
        "clinical_history",
        "reason_for_study",
        "reason_for_exam",
    ]:
        if key in kv_pairs:
            value = kv_pairs[key].strip()
            if len(value) > 3:
                return (value, 0.90)

    for section_key in ["indication", "clinical_information", "clinical_history"]:
        if section_key in sections:
            content = sections[section_key].strip()
            if content:
                return (content[:500], 0.80)

    results = search_patterns(text, CLINICAL_INDICATION_PATTERNS)
    if results:
        indication = results[0][0].strip()[:500]
        if len(indication) > 3:
            return (indication, results[0][1])

    return (None, 0.0)


def _extract_diagnosis(
    text: str,
    sections: dict[str, str],
    kv_pairs: dict[str, str],
) -> tuple[Optional[str], float]:
    """Extract diagnosis from text.

    Args:
        text: Full document text.
        sections: Segmented document sections.
        kv_pairs: Extracted key-value pairs.

    Returns:
        Tuple of (diagnosis_text, confidence_score).
    """
    for key in ["diagnosis", "dx", "assessment", "impression"]:
        if key in kv_pairs:
            value = kv_pairs[key].strip()
            if len(value) > 2:
                return (value, 0.90)

    for section_key in ["diagnosis", "assessment", "impression"]:
        if section_key in sections:
            content = sections[section_key].strip()
            if content:
                return (content[:500], 0.80)

    results = search_patterns(text, DIAGNOSIS_PATTERNS)
    if results:
        diag_text = results[0][0].strip()[:500]
        if len(diag_text) > 2:
            return (diag_text, results[0][1])

    return (None, 0.0)


def _extract_icd10_codes(text: str) -> list[str]:
    """Extract ICD-10 codes embedded in the text.

    Args:
        text: Full document text.

    Returns:
        List of unique ICD-10 codes found in the text.
    """
    matches = ICD10_CODE_PATTERN.findall(text)
    # Filter to valid ICD-10 format and deduplicate
    codes: list[str] = []
    seen: set[str] = set()
    for code in matches:
        # Validate: starts with letter, has at least 3 chars
        if (
            len(code) >= 3
            and code[0].isalpha()
            and code[0] not in ("U", "X", "Y")  # Exclude uncommon prefixes
            and code not in seen
        ):
            # Additional validation: not a common word/abbreviation
            if not _is_common_word(code):
                codes.append(code)
                seen.add(code)

    return codes


def _extract_cpt_codes(text: str) -> list[str]:
    """Extract radiology CPT codes embedded in the text.

    Args:
        text: Full document text.

    Returns:
        List of unique radiology-range CPT codes found in the text.
    """
    matches = CPT_RADIOLOGY_PATTERN.findall(text)
    # Deduplicate while preserving order
    seen: set[str] = set()
    codes: list[str] = []
    for code in matches:
        if code not in seen:
            codes.append(code)
            seen.add(code)
    return codes


def _is_common_word(text: str) -> bool:
    """Check if a string is a common word that might be mistaken for an ICD-10 code.

    Args:
        text: String to check.

    Returns:
        True if the string is likely a common word, not a code.
    """
    common = {
        "THE", "AND", "FOR", "NOT", "BUT", "ARE", "WAS", "HAS",
        "HAD", "HER", "HIS", "HIM", "HOW", "ITS", "MAY", "NEW",
        "NOW", "OLD", "OUR", "OUT", "OWN", "SAY", "SHE", "TOO",
        "USE", "WAY", "WHO", "BOY", "DID", "GET", "LET", "PUT",
        "RUN", "TOP", "ALL",
    }
    return text.upper() in common


def _extract_body_part(
    text: str,
    procedure_desc: Optional[str],
) -> tuple[Optional[str], float]:
    """Extract body part from text, prioritizing procedure description.

    Args:
        text: Full document text.
        procedure_desc: Extracted procedure description, if available.

    Returns:
        Tuple of (body_part, confidence_score).
    """
    # Search procedure description first (more specific context)
    if procedure_desc:
        parts = detect_body_parts(procedure_desc)
        if parts:
            return parts[0]

    # Fall back to full text
    parts = detect_body_parts(text)
    if parts:
        # Lower confidence when found in full text vs procedure description
        return (parts[0][0], parts[0][1] * 0.9)

    return (None, 0.0)


def _extract_special_instructions(
    text: str,
    sections: dict[str, str],
) -> Optional[str]:
    """Extract special instructions and safety flags.

    Combines explicit special instruction sections with detected safety
    indicators like contrast allergies, pregnancy, and implants.

    Args:
        text: Full document text.
        sections: Segmented document sections.

    Returns:
        Combined special instructions string, or None if none found.
    """
    instructions: list[str] = []

    # Check sections
    for section_key in [
        "special_instructions",
        "notes",
        "comments",
        "allergies",
    ]:
        if section_key in sections:
            content = sections[section_key].strip()
            if content:
                instructions.append(content)

    # Check regex patterns
    results = search_patterns(text, SPECIAL_INSTRUCTION_PATTERNS)
    for result_text, _ in results:
        if result_text not in instructions:
            instructions.append(result_text)

    # Detect safety flags
    safety_flags: list[str] = []
    if CONTRAST_ALLERGY_PATTERN.search(text):
        safety_flags.append("CONTRAST ALLERGY")
    if PREGNANCY_PATTERN.search(text):
        safety_flags.append("POSSIBLE PREGNANCY")
    if IMPLANT_PATTERN.search(text):
        safety_flags.append("IMPLANT/DEVICE PRESENT")

    if safety_flags:
        instructions.append("Safety flags: " + ", ".join(safety_flags))

    if instructions:
        return "; ".join(instructions)[:1000]

    return None


def _adjust_confidence_for_doc_type(
    scores: dict[str, float],
    doc_type: str,
) -> dict[str, float]:
    """Adjust confidence scores based on document type.

    Handwritten notes and unknown document types receive reduced confidence
    scores since OCR quality is typically lower for these.

    Args:
        scores: Current confidence scores per field.
        doc_type: Document type identifier.

    Returns:
        Adjusted confidence scores.
    """
    multiplier = 1.0

    if doc_type == "handwritten_note":
        multiplier = 0.7  # Handwritten OCR is less reliable
    elif doc_type == "fax_cover":
        multiplier = 0.85  # Faxes may have degraded quality
    elif doc_type == "unknown":
        multiplier = 0.9  # Unknown format gets slight penalty

    if multiplier < 1.0:
        return {k: round(v * multiplier, 4) for k, v in scores.items()}

    return scores
