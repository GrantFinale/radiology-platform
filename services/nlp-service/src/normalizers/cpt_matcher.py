"""CPT code matching engine for radiology procedures.

Uses TF-IDF vectorization and cosine similarity to match free-text procedure
descriptions against a dictionary of radiology CPT codes. Supports modality
filtering and common abbreviation expansion.
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

# Common radiology abbreviations and their expansions
ABBREVIATIONS: dict[str, str] = {
    "ct": "computed tomography",
    "mri": "magnetic resonance imaging",
    "mra": "magnetic resonance angiography",
    "cta": "computed tomography angiography",
    "us": "ultrasound",
    "xr": "x-ray",
    "xray": "x-ray",
    "mammo": "mammography",
    "dexa": "dual energy x-ray absorptiometry bone density",
    "dxa": "dual energy x-ray absorptiometry bone density",
    "pet": "positron emission tomography",
    "nuc med": "nuclear medicine",
    "fluoro": "fluoroscopy",
    "ap": "anteroposterior",
    "pa": "posteroanterior",
    "lat": "lateral",
    "abd": "abdomen abdominal",
    "c-spine": "cervical spine",
    "t-spine": "thoracic spine",
    "l-spine": "lumbar spine",
    "ls spine": "lumbosacral spine",
    "wo": "without",
    "w/o": "without",
    "w": "with",
    "w/": "with",
    "w/wo": "without contrast followed by with contrast",
    "wo/w": "without contrast followed by with contrast",
    "bx": "biopsy",
    "fx": "fracture",
    "dx": "diagnostic",
    "bil": "bilateral",
    "bilat": "bilateral",
    "uni": "unilateral",
    "rt": "right",
    "lt": "left",
    "r": "right",
    "l": "left",
    "le": "lower extremity",
    "ue": "upper extremity",
    "ext": "extremity",
    "jt": "joint",
    "cxr": "chest x-ray radiologic examination",
    "kub": "kidneys ureters bladder abdomen",
}

# Synonym mappings for common procedure terms
SYNONYMS: dict[str, str] = {
    "cat scan": "ct computed tomography",
    "brain scan": "head brain",
    "chest film": "chest x-ray radiologic examination",
    "plain film": "x-ray radiologic examination",
    "bone scan": "bone joint imaging nuclear medicine",
    "echo": "ultrasound echocardiography",
    "sono": "ultrasound sonography",
    "doppler": "duplex scan ultrasound",
    "angio": "angiography",
    "vascular study": "duplex scan",
    "stress test": "myocardial perfusion imaging",
    "heart scan": "cardiac imaging",
    "lung scan": "pulmonary perfusion ventilation imaging",
    "screening mammogram": "screening mammography bilateral",
    "diagnostic mammogram": "diagnostic mammography",
    "tomo": "digital breast tomosynthesis",
    "3d mammogram": "digital breast tomosynthesis",
    "breast mri": "mri breast magnetic resonance imaging",
    "kidney stone": "ct abdomen pelvis renal calculus",
}


class CPTMatcher:
    """Engine for matching free-text procedure descriptions to CPT codes.

    Loads a dictionary of radiology CPT codes and builds a TF-IDF index for
    efficient similarity-based matching.
    """

    def __init__(self, data_path: Optional[str] = None) -> None:
        """Initialize the CPT matcher.

        Args:
            data_path: Path to the CPT code JSON file.
                       Defaults to the bundled cpt_radiology.json.
        """
        self._codes: list[dict[str, str]] = []
        self._descriptions: list[str] = []
        self._vectorizer: Optional[TfidfVectorizer] = None
        self._tfidf_matrix = None
        self._loaded = False

        if data_path is None:
            data_path = str(
                Path(__file__).resolve().parent.parent / "data" / "cpt_radiology.json"
            )

        self._load_codes(data_path)

    def _load_codes(self, data_path: str) -> None:
        """Load CPT codes from JSON and build TF-IDF index.

        Args:
            data_path: Path to the CPT code JSON file.
        """
        try:
            with open(data_path, "r") as f:
                data = json.load(f)

            # Flatten all modality groups into a single list
            for modality, codes in data.items():
                for entry in codes:
                    self._codes.append(
                        {
                            "code": entry["code"],
                            "description": entry["description"],
                            "modality_group": modality,
                        }
                    )
                    # Build searchable description with modality context
                    desc = f"{entry['description']} {modality.replace('_', ' ')}"
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
                logger.info("Loaded %d CPT codes for matching", len(self._codes))
            else:
                logger.warning("No CPT codes loaded from %s", data_path)

        except FileNotFoundError:
            logger.error("CPT code file not found: %s", data_path)
        except json.JSONDecodeError as e:
            logger.error("Invalid JSON in CPT code file: %s", e)
        except Exception as e:
            logger.error("Failed to load CPT codes: %s", e)

    @property
    def is_loaded(self) -> bool:
        """Whether the CPT code dictionary has been successfully loaded."""
        return self._loaded

    @property
    def code_count(self) -> int:
        """Number of CPT codes in the dictionary."""
        return len(self._codes)

    def expand_abbreviations(self, text: str) -> str:
        """Expand common radiology abbreviations in the input text.

        Args:
            text: Free-text procedure description.

        Returns:
            Text with abbreviations expanded.
        """
        expanded = text.lower()

        # Apply synonym replacements first
        for term, replacement in SYNONYMS.items():
            if term in expanded:
                expanded = expanded.replace(term, replacement)

        # Apply abbreviation expansions
        words = expanded.split()
        result_words: list[str] = []
        for word in words:
            clean_word = word.strip(".,;:()")
            if clean_word in ABBREVIATIONS:
                result_words.append(ABBREVIATIONS[clean_word])
            else:
                result_words.append(word)

        return " ".join(result_words)

    def match(
        self,
        text: str,
        top_n: int = 5,
        modality_filter: Optional[str] = None,
        threshold: Optional[float] = None,
    ) -> list[dict[str, str | float]]:
        """Match free text to CPT codes using TF-IDF cosine similarity.

        Args:
            text: Free-text procedure description to match.
            top_n: Number of top matches to return.
            modality_filter: Optional modality group to filter results.
            threshold: Minimum similarity score threshold.
                       Defaults to settings.cpt_match_threshold.

        Returns:
            List of match dictionaries with keys: code, description, score,
            modality_group. Sorted by score descending.
        """
        if not self._loaded or not text.strip():
            return []

        if threshold is None:
            threshold = settings.cpt_match_threshold

        # Expand abbreviations and normalize
        expanded_text = self.expand_abbreviations(text)

        # Transform query
        query_vector = self._vectorizer.transform([expanded_text])  # type: ignore[union-attr]
        similarities = cosine_similarity(query_vector, self._tfidf_matrix).flatten()

        # Build results with filtering
        results: list[dict[str, str | float]] = []
        # Get indices sorted by similarity descending
        sorted_indices = similarities.argsort()[::-1]

        for idx in sorted_indices:
            score = float(similarities[idx])
            if score < threshold:
                break

            entry = self._codes[idx]

            # Apply modality filter if specified
            if modality_filter:
                filter_lower = modality_filter.lower().replace(" ", "_")
                if filter_lower not in entry["modality_group"].lower():
                    continue

            results.append(
                {
                    "code": entry["code"],
                    "description": entry["description"],
                    "score": round(score, 4),
                    "modality_group": entry["modality_group"],
                }
            )

            if len(results) >= top_n:
                break

        return results

    def get_code(self, cpt_code: str) -> Optional[dict[str, str]]:
        """Look up a specific CPT code.

        Args:
            cpt_code: The CPT code to look up.

        Returns:
            Dictionary with code, description, and modality_group,
            or None if not found.
        """
        for entry in self._codes:
            if entry["code"] == cpt_code:
                return entry
        return None
