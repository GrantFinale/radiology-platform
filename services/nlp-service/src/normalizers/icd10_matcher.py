"""ICD-10 code matching engine for radiology indications.

Uses TF-IDF vectorization and cosine similarity to match free-text diagnosis
descriptions against a dictionary of common ICD-10 codes used in radiology.
Supports clinical abbreviation expansion.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from src.config import settings

logger = logging.getLogger(__name__)

# Common clinical abbreviations for diagnoses
CLINICAL_ABBREVIATIONS: dict[str, str] = {
    "htn": "hypertension",
    "dm": "diabetes mellitus",
    "dm2": "type 2 diabetes mellitus",
    "dm1": "type 1 diabetes mellitus",
    "cad": "coronary artery disease atherosclerotic heart disease",
    "chf": "congestive heart failure",
    "copd": "chronic obstructive pulmonary disease",
    "ckd": "chronic kidney disease",
    "dvt": "deep vein thrombosis embolism",
    "pe": "pulmonary embolism",
    "cva": "cerebrovascular accident stroke cerebral infarction",
    "tia": "transient ischemic attack",
    "oa": "osteoarthritis",
    "ra": "rheumatoid arthritis",
    "sob": "shortness of breath dyspnea",
    "cp": "chest pain",
    "ha": "headache",
    "lbp": "low back pain",
    "r/o": "rule out",
    "hx": "history",
    "fx": "fracture",
    "ca": "cancer carcinoma malignant neoplasm",
    "mets": "metastasis metastatic secondary malignant neoplasm",
    "bph": "benign prostatic hyperplasia",
    "uti": "urinary tract infection",
    "gerd": "gastroesophageal reflux disease",
    "afib": "atrial fibrillation",
    "a-fib": "atrial fibrillation",
    "pvd": "peripheral vascular disease",
    "pad": "peripheral arterial disease",
    "aaa": "abdominal aortic aneurysm",
    "lof": "loss of function",
    "rom": "range of motion",
    "sob": "shortness of breath",
    "npo": "nothing by mouth",
    "s/p": "status post",
    "c/o": "complaining of",
    "w/u": "workup evaluation",
    "f/u": "follow up",
    "wnl": "within normal limits",
    "nkda": "no known drug allergies",
    "acl": "anterior cruciate ligament",
    "mcl": "medial collateral ligament",
    "rotator cuff": "rotator cuff tear shoulder",
    "meniscus": "meniscal tear knee",
    "sciatica": "radiculopathy lumbar disc disorder",
    "bone mets": "secondary malignant neoplasm bone metastasis",
    "brain mets": "secondary malignant neoplasm brain metastasis",
    "lung nodule": "solitary pulmonary nodule",
    "kidney stone": "calculus kidney renal",
    "gallstone": "calculus gallbladder cholelithiasis",
}


class ICD10Matcher:
    """Engine for matching free-text diagnoses to ICD-10 codes.

    Loads a dictionary of common radiology indication ICD-10 codes and builds
    a TF-IDF index for efficient similarity-based matching.
    """

    def __init__(self, data_path: Optional[str] = None) -> None:
        """Initialize the ICD-10 matcher.

        Args:
            data_path: Path to the ICD-10 code JSON file.
                       Defaults to the bundled icd10_common.json.
        """
        self._codes: list[dict[str, str]] = []
        self._descriptions: list[str] = []
        self._vectorizer: Optional[TfidfVectorizer] = None
        self._tfidf_matrix = None
        self._loaded = False

        if data_path is None:
            data_path = str(
                Path(__file__).resolve().parent.parent / "data" / "icd10_common.json"
            )

        self._load_codes(data_path)

    def _load_codes(self, data_path: str) -> None:
        """Load ICD-10 codes from JSON and build TF-IDF index.

        Args:
            data_path: Path to the ICD-10 code JSON file.
        """
        try:
            with open(data_path, "r") as f:
                data = json.load(f)

            # Flatten all category groups into a single list
            for category, codes in data.items():
                for entry in codes:
                    self._codes.append(
                        {
                            "code": entry["code"],
                            "description": entry["description"],
                            "category": category,
                        }
                    )
                    # Build searchable text including category
                    desc = f"{entry['description']} {category.replace('_', ' ')}"
                    self._descriptions.append(desc.lower())

            if self._codes:
                self._vectorizer = TfidfVectorizer(
                    ngram_range=(1, 3),
                    max_features=10000,
                    stop_words="english",
                    sublinear_tf=True,
                )
                self._tfidf_matrix = self._vectorizer.fit_transform(self._descriptions)
                self._loaded = True
                logger.info("Loaded %d ICD-10 codes for matching", len(self._codes))
            else:
                logger.warning("No ICD-10 codes loaded from %s", data_path)

        except FileNotFoundError:
            logger.error("ICD-10 code file not found: %s", data_path)
        except json.JSONDecodeError as e:
            logger.error("Invalid JSON in ICD-10 code file: %s", e)
        except Exception as e:
            logger.error("Failed to load ICD-10 codes: %s", e)

    @property
    def is_loaded(self) -> bool:
        """Whether the ICD-10 code dictionary has been successfully loaded."""
        return self._loaded

    @property
    def code_count(self) -> int:
        """Number of ICD-10 codes in the dictionary."""
        return len(self._codes)

    def expand_abbreviations(self, text: str) -> str:
        """Expand common clinical abbreviations in the input text.

        Args:
            text: Free-text diagnosis description.

        Returns:
            Text with abbreviations expanded.
        """
        expanded = text.lower()

        # Apply abbreviation expansions
        words = expanded.split()
        result_words: list[str] = []
        i = 0
        while i < len(words):
            word = words[i].strip(".,;:()")

            # Check two-word combinations first
            if i + 1 < len(words):
                two_word = f"{word} {words[i + 1].strip('.,;:()')}"
                if two_word in CLINICAL_ABBREVIATIONS:
                    result_words.append(CLINICAL_ABBREVIATIONS[two_word])
                    i += 2
                    continue

            if word in CLINICAL_ABBREVIATIONS:
                result_words.append(CLINICAL_ABBREVIATIONS[word])
            else:
                result_words.append(words[i])
            i += 1

        return " ".join(result_words)

    def match(
        self,
        text: str,
        top_n: int = 5,
        category_filter: Optional[str] = None,
        threshold: Optional[float] = None,
    ) -> list[dict[str, str | float]]:
        """Match free text to ICD-10 codes using TF-IDF cosine similarity.

        Args:
            text: Free-text diagnosis description to match.
            top_n: Number of top matches to return.
            category_filter: Optional category to filter results
                            (e.g., "pain", "neoplasms").
            threshold: Minimum similarity score threshold.
                       Defaults to settings.icd10_match_threshold.

        Returns:
            List of match dictionaries with keys: code, description, score,
            category. Sorted by score descending.
        """
        if not self._loaded or not text.strip():
            return []

        if threshold is None:
            threshold = settings.icd10_match_threshold

        # Expand abbreviations and normalize
        expanded_text = self.expand_abbreviations(text)

        # Transform query
        query_vector = self._vectorizer.transform([expanded_text])  # type: ignore[union-attr]
        similarities = cosine_similarity(query_vector, self._tfidf_matrix).flatten()

        # Build results with filtering
        results: list[dict[str, str | float]] = []
        sorted_indices = similarities.argsort()[::-1]

        for idx in sorted_indices:
            score = float(similarities[idx])
            if score < threshold:
                break

            entry = self._codes[idx]

            # Apply category filter if specified
            if category_filter:
                filter_lower = category_filter.lower().replace(" ", "_")
                if filter_lower not in entry["category"].lower():
                    continue

            results.append(
                {
                    "code": entry["code"],
                    "description": entry["description"],
                    "score": round(score, 4),
                    "category": entry["category"],
                }
            )

            if len(results) >= top_n:
                break

        return results

    def get_code(self, icd10_code: str) -> Optional[dict[str, str]]:
        """Look up a specific ICD-10 code.

        Args:
            icd10_code: The ICD-10 code to look up.

        Returns:
            Dictionary with code, description, and category,
            or None if not found.
        """
        for entry in self._codes:
            if entry["code"] == icd10_code:
                return entry
        return None
