"""Regex pattern library for clinical data extraction from radiology documents.

Contains compiled regex patterns for extracting structured clinical information
from unstructured OCR text, including patient demographics, provider information,
procedure details, and clinical indicators.
"""

import re
from typing import NamedTuple


class PatternDef(NamedTuple):
    """A named regex pattern with its compiled form and description."""

    name: str
    pattern: re.Pattern[str]
    description: str


# ---------------------------------------------------------------------------
# Patient demographics
# ---------------------------------------------------------------------------

# MRN patterns: various formats encountered in medical documents
MRN_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?:MRN|Medical\s*Record\s*(?:Number|No\.?|#))\s*[:#]?\s*(\d{5,12})", re.IGNORECASE),
    re.compile(r"(?:Patient\s*ID|Pt\s*ID|Acct\.?\s*(?:No\.?|#|Number))\s*[:#]?\s*(\d{5,12})", re.IGNORECASE),
    re.compile(r"(?:Chart\s*(?:No\.?|#|Number))\s*[:#]?\s*(\d{5,12})", re.IGNORECASE),
    re.compile(r"\bMRN\s*(\d{5,12})\b", re.IGNORECASE),
]

# Date of birth patterns
DOB_PATTERNS: list[re.Pattern[str]] = [
    # Label: value patterns
    re.compile(
        r"(?:DOB|Date\s*of\s*Birth|Birth\s*Date|D\.O\.B\.?)\s*[:#]?\s*"
        r"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:DOB|Date\s*of\s*Birth|Birth\s*Date|D\.O\.B\.?)\s*[:#]?\s*"
        r"(\w+\s+\d{1,2},?\s+\d{4})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:DOB|Date\s*of\s*Birth|Birth\s*Date|D\.O\.B\.?)\s*[:#]?\s*"
        r"(\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2})",
        re.IGNORECASE,
    ),
]

# Patient name patterns
PATIENT_NAME_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"(?:Patient(?:\s*Name)?|Pt\.?(?:\s*Name)?)\s*[:#]?\s*"
        r"([A-Z][a-zA-Z'-]+(?:\s+[A-Z]\.?)?\s*,?\s+[A-Z][a-zA-Z'-]+)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:Patient(?:\s*Name)?|Pt\.?(?:\s*Name)?)\s*[:#]?\s*"
        r"([A-Z][a-zA-Z'-]+\s+[A-Z]\.?\s+[A-Z][a-zA-Z'-]+)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:Name)\s*[:#]\s*"
        r"([A-Z][a-zA-Z'-]+(?:\s+[A-Z]\.?)?\s*,?\s+[A-Z][a-zA-Z'-]+)",
        re.IGNORECASE,
    ),
]

# ---------------------------------------------------------------------------
# Provider information
# ---------------------------------------------------------------------------

# NPI number patterns (10-digit number)
NPI_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?:NPI|National\s*Provider\s*(?:Identifier|ID))\s*[:#]?\s*(\d{10})", re.IGNORECASE),
    re.compile(r"\bNPI\s*#?\s*(\d{10})\b", re.IGNORECASE),
]

# Ordering provider name patterns
ORDERING_PROVIDER_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"(?:Ordering\s*(?:Physician|Provider|Doctor|MD|Dr\.?)|"
        r"Referring\s*(?:Physician|Provider|Doctor|MD|Dr\.?)|"
        r"Requested\s*[Bb]y|Ordered\s*[Bb]y|Ref(?:erring)?\s*(?:Phys|Dr)\.?)\s*[:#]?\s*"
        r"(?:Dr\.?\s*)?"
        r"([A-Z][a-zA-Z'-]+(?:\s+[A-Z]\.?)?\s*,?\s+[A-Z][a-zA-Z'-]+(?:\s*,?\s*(?:MD|DO|NP|PA|ARNP|APRN|DPM|DPT|DC)\.?)?)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:Dr\.?\s+)([A-Z][a-zA-Z'-]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-zA-Z'-]+)\s*"
        r"(?:,\s*(?:MD|DO|NP|PA))?",
        re.IGNORECASE,
    ),
]

# Phone and fax patterns
PHONE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?:Phone|Ph|Tel|Telephone)\s*[:#]?\s*(\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4})", re.IGNORECASE),
    re.compile(r"(?:Phone|Ph|Tel|Telephone)\s*[:#]?\s*(\d{10})", re.IGNORECASE),
]

FAX_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?:Fax|Fx)\s*[:#]?\s*(\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4})", re.IGNORECASE),
    re.compile(r"(?:Fax|Fx)\s*[:#]?\s*(\d{10})", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Clinical content
# ---------------------------------------------------------------------------

# Procedure/exam request patterns
PROCEDURE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"(?:Procedure\s*(?:Requested|Ordered)?|Exam\s*(?:Requested|Ordered)?|"
        r"Study\s*(?:Requested|Ordered)?|Please\s*(?:schedule|perform|order)|"
        r"Requesting|Order\s*for|Examination)\s*[:#]?\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:CT|MRI|MRA|X-?ray|Ultrasound|US|Mammogram|PET|DEXA|Fluoroscopy|Nuclear)\s+"
        r"(?:of\s+(?:the\s+)?)?(.+?)(?:\n|$|\.(?:\s|$))",
        re.IGNORECASE,
    ),
]

# Clinical indication patterns
CLINICAL_INDICATION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"(?:Clinical\s*(?:Indication|Info(?:rmation)?|History)|"
        r"Indication(?:\s*for\s*(?:Study|Exam|Procedure))?|"
        r"Reason\s*(?:for\s*(?:Study|Exam|Procedure|Request))?|"
        r"History|Hx|Clinical\s*Hx)\s*[:#]?\s*(.+?)(?:\n\n|\n(?=[A-Z][a-z]+:)|$)",
        re.IGNORECASE | re.DOTALL,
    ),
]

# Diagnosis patterns
DIAGNOSIS_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"(?:Diagnosis|Dx|Assessment|Impression)\s*[:#]?\s*(.+?)(?:\n\n|\n(?=[A-Z][a-z]+:)|$)",
        re.IGNORECASE | re.DOTALL,
    ),
]

# ICD-10 code patterns (embedded in text)
ICD10_CODE_PATTERN: re.Pattern[str] = re.compile(
    r"\b([A-TV-Z]\d{2}(?:\.\d{1,4})?[A-Z]?)\b"
)

# CPT code patterns (embedded in text)
CPT_CODE_PATTERN: re.Pattern[str] = re.compile(
    r"\b(\d{5})\b"
)

# Specific CPT range for radiology (70000-79999)
CPT_RADIOLOGY_PATTERN: re.Pattern[str] = re.compile(
    r"\b(7\d{4})\b"
)

# ---------------------------------------------------------------------------
# Urgency indicators
# ---------------------------------------------------------------------------

URGENCY_PATTERNS: dict[str, re.Pattern[str]] = {
    "STAT": re.compile(
        r"\b(?:STAT|EMERGENT|EMERGENCY|IMMEDIATE(?:LY)?|CODE)\b",
        re.IGNORECASE,
    ),
    "urgent": re.compile(
        r"\b(?:URGENT(?:LY)?|RUSH|ASAP|AS\s*SOON\s*AS\s*POSSIBLE|EXPEDITE|PRIORITY|CRITICAL)\b",
        re.IGNORECASE,
    ),
    "routine": re.compile(
        r"\b(?:ROUTINE|ELECTIVE|SCHEDULED|NON[\-\s]?URGENT|STANDARD)\b",
        re.IGNORECASE,
    ),
}

# ---------------------------------------------------------------------------
# Laterality
# ---------------------------------------------------------------------------

LATERALITY_PATTERNS: dict[str, re.Pattern[str]] = {
    "bilateral": re.compile(
        r"\b(?:BILATERAL|B/?L|BILAT|BOTH\s+(?:SIDES?|EXTREMIT(?:Y|IES)|LEGS?|ARMS?|KNEES?|HIPS?|SHOULDERS?|ANKLES?|WRISTS?))\b",
        re.IGNORECASE,
    ),
    "left": re.compile(
        r"\b(?:LEFT|LT|L\s+(?:SIDE|EXTREMITY|LEG|ARM|KNEE|HIP|SHOULDER|ANKLE|WRIST))\b",
        re.IGNORECASE,
    ),
    "right": re.compile(
        r"\b(?:RIGHT|RT|R\s+(?:SIDE|EXTREMITY|LEG|ARM|KNEE|HIP|SHOULDER|ANKLE|WRIST))\b",
        re.IGNORECASE,
    ),
}

# ---------------------------------------------------------------------------
# Body parts
# ---------------------------------------------------------------------------

BODY_PART_PATTERNS: dict[str, re.Pattern[str]] = {
    "head": re.compile(r"\b(?:HEAD|BRAIN|CRANIUM|SKULL|CRANIAL|INTRACRANIAL)\b", re.IGNORECASE),
    "neck": re.compile(r"\b(?:NECK|CERVICAL\s+(?:SPINE|SOFT\s+TISSUE)|C[\-\s]?SPINE)\b", re.IGNORECASE),
    "face": re.compile(r"\b(?:FACE|FACIAL|SINUS(?:ES)?|ORBIT(?:S)?|MANDIBLE|MAXILLA|TMJ|TEMPOROMANDIBULAR)\b", re.IGNORECASE),
    "chest": re.compile(r"\b(?:CHEST|THORAX|THORACIC|LUNG(?:S)?|PULMONARY|MEDIASTIN(?:UM|AL))\b", re.IGNORECASE),
    "breast": re.compile(r"\b(?:BREAST(?:S)?|MAMMARY|MAMMOGRAM)\b", re.IGNORECASE),
    "abdomen": re.compile(r"\b(?:ABDOMEN|ABDOMINAL|BELLY|STOMACH|LIVER|GALLBLADDER|PANCREA(?:S|TIC)|SPLEEN|KIDNEY(?:S)?|RENAL)\b", re.IGNORECASE),
    "pelvis": re.compile(r"\b(?:PELVIS|PELVIC|HIP(?:S)?|SACR(?:UM|AL)|COCCYX|SACROILIAC|SI\s+JOINT)\b", re.IGNORECASE),
    "thoracic_spine": re.compile(r"\b(?:THORACIC\s+SPINE|T[\-\s]?SPINE|DORSAL\s+SPINE)\b", re.IGNORECASE),
    "lumbar_spine": re.compile(r"\b(?:LUMBAR\s+SPINE|L[\-\s]?SPINE|LUMBOSACRAL|LS\s+SPINE)\b", re.IGNORECASE),
    "shoulder": re.compile(r"\b(?:SHOULDER(?:S)?|ROTATOR\s+CUFF|GLENOHUMERAL)\b", re.IGNORECASE),
    "elbow": re.compile(r"\b(?:ELBOW(?:S)?)\b", re.IGNORECASE),
    "wrist": re.compile(r"\b(?:WRIST(?:S)?|CARPAL)\b", re.IGNORECASE),
    "hand": re.compile(r"\b(?:HAND(?:S)?|FINGER(?:S)?|METACARPAL|PHALANX|PHALANGES)\b", re.IGNORECASE),
    "forearm": re.compile(r"\b(?:FOREARM(?:S)?|RADIUS|ULNA)\b", re.IGNORECASE),
    "upper_arm": re.compile(r"\b(?:UPPER\s+ARM|HUMERUS|HUMERAL)\b", re.IGNORECASE),
    "knee": re.compile(r"\b(?:KNEE(?:S)?|PATELLA|MENISCUS|MENISCAL|ACL|PCL|MCL|LCL)\b", re.IGNORECASE),
    "ankle": re.compile(r"\b(?:ANKLE(?:S)?|MALLEOLUS|MALLEOLAR)\b", re.IGNORECASE),
    "foot": re.compile(r"\b(?:FOOT|FEET|TOE(?:S)?|METATARSAL|CALCANEUS|PLANTAR|HEEL)\b", re.IGNORECASE),
    "lower_leg": re.compile(r"\b(?:LOWER\s+LEG|TIBIA|FIBULA|TIBIAL|SHIN)\b", re.IGNORECASE),
    "thigh": re.compile(r"\b(?:THIGH|FEMUR|FEMORAL)\b", re.IGNORECASE),
    "upper_extremity": re.compile(r"\b(?:UPPER\s+EXTREMIT(?:Y|IES)|UE|ARM(?:S)?)\b", re.IGNORECASE),
    "lower_extremity": re.compile(r"\b(?:LOWER\s+EXTREMIT(?:Y|IES)|LE|LEG(?:S)?)\b", re.IGNORECASE),
}

# ---------------------------------------------------------------------------
# Modalities
# ---------------------------------------------------------------------------

MODALITY_PATTERNS: dict[str, re.Pattern[str]] = {
    "CT": re.compile(
        r"\b(?:CT|CAT\s+SCAN|COMPUTED\s+TOMOGRAPHY|CTA|CT\s+ANGIOGRAPH(?:Y|IC))\b",
        re.IGNORECASE,
    ),
    "MRI": re.compile(
        r"\b(?:MRI|MR\b|MAGNETIC\s+RESONANCE(?:\s+IMAGING)?|MRA|MR\s+ANGIOGRAPH(?:Y|IC)|FMRI)\b",
        re.IGNORECASE,
    ),
    "X-ray": re.compile(
        r"\b(?:X[\-\s]?RAY|RADIOGRAPH(?:Y|IC)?|PLAIN\s+FILM|XR|CR|DR)\b",
        re.IGNORECASE,
    ),
    "Ultrasound": re.compile(
        r"\b(?:ULTRASOUND|US\b|ULTRASONOGRAPH(?:Y|IC)|SONOGRAPH(?:Y|IC)|ECHO(?:GRAPH)?|DOPPLER|DUPLEX)\b",
        re.IGNORECASE,
    ),
    "Mammography": re.compile(
        r"\b(?:MAMMOGRAPH(?:Y|IC)|MAMMOGRAM|TOMO(?:SYNTHESIS)?|DBT)\b",
        re.IGNORECASE,
    ),
    "Nuclear Medicine": re.compile(
        r"\b(?:NUCLEAR\s+MEDICINE|NUC\s+MED|BONE\s+SCAN|PET|PET[\-/]CT|SPECT|SCINTIGRAPH(?:Y|IC)|THYROID\s+(?:SCAN|UPTAKE))\b",
        re.IGNORECASE,
    ),
    "Fluoroscopy": re.compile(
        r"\b(?:FLUOROSCOP(?:Y|IC)|FLUORO|BARIUM|SWALLOW\s+STUDY|UPPER\s+GI|ESOPHAGRAM)\b",
        re.IGNORECASE,
    ),
    "Interventional": re.compile(
        r"\b(?:INTERVENTIONAL|ANGIOGRAPH(?:Y|IC)|ARTERIOGRAPH(?:Y|IC)|VENOGRAPH(?:Y|IC)|CATHETER|EMBOLIZ(?:E|ATION)|BIOPSY)\b",
        re.IGNORECASE,
    ),
    "DEXA": re.compile(
        r"\b(?:DEXA|DXA|BONE\s+DENSITY|DENSITOMETR(?:Y|IC)|BMD)\b",
        re.IGNORECASE,
    ),
}

# ---------------------------------------------------------------------------
# Special instructions
# ---------------------------------------------------------------------------

SPECIAL_INSTRUCTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"(?:Special\s*Instructions?|Notes?|Comments?|Additional\s*Info(?:rmation)?|"
        r"Special\s*Considerations?|Allergies?|Contrast\s*Allergy|Claustrophobic|"
        r"Pacemaker|Implant|Pregnant|Pregnancy|Sedation|Anesthesia)\s*[:#]?\s*(.+?)(?:\n\n|\n(?=[A-Z][a-z]+:)|$)",
        re.IGNORECASE | re.DOTALL,
    ),
]

# Contrast allergy flags
CONTRAST_ALLERGY_PATTERN: re.Pattern[str] = re.compile(
    r"\b(?:CONTRAST\s+ALLERGY|ALLERGIC\s+TO\s+(?:CONTRAST|DYE|IODINE|GADOLINIUM)|"
    r"ALLERGY\s*:\s*(?:CONTRAST|DYE|IODINE|GADOLINIUM))\b",
    re.IGNORECASE,
)

# Pregnancy indicator
PREGNANCY_PATTERN: re.Pattern[str] = re.compile(
    r"\b(?:PREGNAN(?:T|CY)|GRAVID|LMP|LAST\s+MENSTRUAL\s+PERIOD)\b",
    re.IGNORECASE,
)

# Implant/device indicators (MRI safety)
IMPLANT_PATTERN: re.Pattern[str] = re.compile(
    r"\b(?:PACEMAKER|DEFIBRILL(?:ATOR)?|ICD|IMPLANT|METAL(?:LIC)?\s+(?:HARDWARE|IMPLANT|DEVICE)|"
    r"COCHLEAR|STENT|CLIP|SHUNT|STIMULATOR|PUMP|PORT[\-\s]?A[\-\s]?CATH|MEDIPORT)\b",
    re.IGNORECASE,
)


def search_patterns(
    text: str,
    patterns: list[re.Pattern[str]],
) -> list[tuple[str, float]]:
    """Search text against a list of patterns and return matches with confidence.

    Args:
        text: The text to search.
        patterns: List of compiled regex patterns to try.

    Returns:
        List of (matched_text, confidence_score) tuples.
        Earlier patterns in the list are assumed to be more specific,
        so they yield higher confidence scores.
    """
    results: list[tuple[str, float]] = []
    base_confidence = 0.95

    for i, pattern in enumerate(patterns):
        matches = pattern.findall(text)
        # Decrease confidence slightly for less-specific patterns
        confidence = max(base_confidence - (i * 0.05), 0.6)
        for match in matches:
            cleaned = match.strip() if isinstance(match, str) else match
            if cleaned:
                results.append((cleaned, confidence))

    return results


def detect_urgency(text: str) -> tuple[str, float]:
    """Detect urgency level from text.

    Args:
        text: The text to analyze.

    Returns:
        Tuple of (urgency_level, confidence_score).
        Returns ("routine", 0.5) if no urgency indicator is found.
    """
    # Check in priority order: STAT > urgent > routine
    for level in ["STAT", "urgent", "routine"]:
        pattern = URGENCY_PATTERNS[level]
        if pattern.search(text):
            confidence = 0.95 if level == "STAT" else 0.90
            return (level, confidence)

    return ("routine", 0.5)


def detect_laterality(text: str) -> tuple[str | None, float]:
    """Detect laterality from text.

    Args:
        text: The text to analyze.

    Returns:
        Tuple of (laterality, confidence_score).
        Returns (None, 0.0) if no laterality is detected.
    """
    # Check bilateral first since it takes priority
    for side in ["bilateral", "left", "right"]:
        pattern = LATERALITY_PATTERNS[side]
        if pattern.search(text):
            return (side, 0.90)

    return (None, 0.0)


def detect_body_parts(text: str) -> list[tuple[str, float]]:
    """Detect body parts mentioned in text.

    Args:
        text: The text to analyze.

    Returns:
        List of (body_part, confidence_score) tuples.
    """
    found: list[tuple[str, float]] = []
    for part_name, pattern in BODY_PART_PATTERNS.items():
        if pattern.search(text):
            found.append((part_name, 0.85))
    return found


def detect_modality(text: str) -> tuple[str | None, float]:
    """Detect imaging modality from text.

    Args:
        text: The text to analyze.

    Returns:
        Tuple of (modality, confidence_score).
        Returns (None, 0.0) if no modality is detected.
    """
    for modality_name, pattern in MODALITY_PATTERNS.items():
        if pattern.search(text):
            return (modality_name, 0.90)

    return (None, 0.0)
