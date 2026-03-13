"""Clinical terminology normalization module.

Provides a unified interface for normalizing clinical terms to standard
medical coding systems (CPT, ICD-10) and standardized body part / modality
terminology.
"""

from __future__ import annotations

import logging
from typing import Optional

from fuzzywuzzy import fuzz

from src.config import settings
from src.normalizers.cpt_matcher import CPTMatcher
from src.normalizers.icd10_matcher import ICD10Matcher

logger = logging.getLogger(__name__)

# Standardized body part names (maps variations to canonical names)
BODY_PART_CANONICAL: dict[str, str] = {
    "head": "Head",
    "brain": "Brain",
    "skull": "Head",
    "cranium": "Head",
    "face": "Face",
    "facial": "Face",
    "sinus": "Sinuses",
    "sinuses": "Sinuses",
    "orbit": "Orbits",
    "orbits": "Orbits",
    "mandible": "Mandible",
    "maxilla": "Maxillofacial",
    "tmj": "TMJ",
    "temporomandibular": "TMJ",
    "neck": "Neck",
    "cervical spine": "Cervical Spine",
    "c-spine": "Cervical Spine",
    "c spine": "Cervical Spine",
    "thoracic spine": "Thoracic Spine",
    "t-spine": "Thoracic Spine",
    "t spine": "Thoracic Spine",
    "dorsal spine": "Thoracic Spine",
    "lumbar spine": "Lumbar Spine",
    "l-spine": "Lumbar Spine",
    "l spine": "Lumbar Spine",
    "lumbosacral": "Lumbosacral Spine",
    "ls spine": "Lumbosacral Spine",
    "sacrum": "Sacrum",
    "sacral": "Sacrum",
    "coccyx": "Coccyx",
    "chest": "Chest",
    "thorax": "Chest",
    "lung": "Chest",
    "lungs": "Chest",
    "breast": "Breast",
    "breasts": "Breast",
    "abdomen": "Abdomen",
    "abdominal": "Abdomen",
    "liver": "Abdomen",
    "gallbladder": "Abdomen",
    "pancreas": "Abdomen",
    "spleen": "Abdomen",
    "kidney": "Kidneys",
    "kidneys": "Kidneys",
    "renal": "Kidneys",
    "pelvis": "Pelvis",
    "pelvic": "Pelvis",
    "hip": "Hip",
    "hips": "Hip",
    "shoulder": "Shoulder",
    "shoulders": "Shoulder",
    "rotator cuff": "Shoulder",
    "elbow": "Elbow",
    "elbows": "Elbow",
    "wrist": "Wrist",
    "wrists": "Wrist",
    "hand": "Hand",
    "hands": "Hand",
    "finger": "Hand",
    "fingers": "Hand",
    "forearm": "Forearm",
    "forearms": "Forearm",
    "upper arm": "Upper Arm",
    "humerus": "Upper Arm",
    "knee": "Knee",
    "knees": "Knee",
    "ankle": "Ankle",
    "ankles": "Ankle",
    "foot": "Foot",
    "feet": "Foot",
    "toe": "Foot",
    "toes": "Foot",
    "calcaneus": "Foot",
    "heel": "Foot",
    "lower leg": "Lower Leg",
    "tibia": "Lower Leg",
    "fibula": "Lower Leg",
    "thigh": "Thigh",
    "femur": "Thigh",
    "upper extremity": "Upper Extremity",
    "lower extremity": "Lower Extremity",
}

# Standardized modality names
MODALITY_CANONICAL: dict[str, str] = {
    "ct": "CT",
    "cat scan": "CT",
    "computed tomography": "CT",
    "cta": "CTA",
    "ct angiography": "CTA",
    "mri": "MRI",
    "mr": "MRI",
    "magnetic resonance": "MRI",
    "magnetic resonance imaging": "MRI",
    "mra": "MRA",
    "mr angiography": "MRA",
    "magnetic resonance angiography": "MRA",
    "fmri": "fMRI",
    "functional mri": "fMRI",
    "x-ray": "X-ray",
    "xray": "X-ray",
    "x ray": "X-ray",
    "radiograph": "X-ray",
    "radiography": "X-ray",
    "plain film": "X-ray",
    "cr": "X-ray",
    "dr": "X-ray",
    "ultrasound": "Ultrasound",
    "us": "Ultrasound",
    "ultrasonography": "Ultrasound",
    "sonography": "Ultrasound",
    "echo": "Ultrasound",
    "doppler": "Doppler Ultrasound",
    "duplex": "Duplex Ultrasound",
    "mammography": "Mammography",
    "mammogram": "Mammography",
    "tomosynthesis": "Tomosynthesis",
    "dbt": "Tomosynthesis",
    "3d mammogram": "Tomosynthesis",
    "nuclear medicine": "Nuclear Medicine",
    "nuc med": "Nuclear Medicine",
    "bone scan": "Nuclear Medicine",
    "pet": "PET",
    "pet/ct": "PET/CT",
    "pet-ct": "PET/CT",
    "spect": "SPECT",
    "scintigraphy": "Nuclear Medicine",
    "fluoroscopy": "Fluoroscopy",
    "fluoro": "Fluoroscopy",
    "dexa": "DEXA",
    "dxa": "DEXA",
    "bone density": "DEXA",
    "interventional": "Interventional Radiology",
    "angiography": "Angiography",
    "biopsy": "Interventional Radiology",
}


class TerminologyNormalizer:
    """Unified clinical terminology normalizer.

    Wraps CPT and ICD-10 matchers and provides body part and modality
    normalization using fuzzy matching.
    """

    def __init__(self) -> None:
        """Initialize the normalizer with CPT and ICD-10 matchers."""
        self.cpt_matcher = CPTMatcher()
        self.icd10_matcher = ICD10Matcher()
        logger.info(
            "TerminologyNormalizer initialized: %d CPT codes, %d ICD-10 codes",
            self.cpt_matcher.code_count,
            self.icd10_matcher.code_count,
        )

    def normalize_procedure(
        self,
        text: str,
        modality_filter: Optional[str] = None,
    ) -> tuple[Optional[str], Optional[str], float]:
        """Normalize a procedure description to a CPT code.

        Args:
            text: Free-text procedure description.
            modality_filter: Optional modality to narrow the search.

        Returns:
            Tuple of (cpt_code, description, confidence).
            Returns (None, None, 0.0) if no suitable match is found.
        """
        if not text.strip():
            return (None, None, 0.0)

        matches = self.cpt_matcher.match(
            text, top_n=1, modality_filter=modality_filter
        )

        if matches:
            best = matches[0]
            return (str(best["code"]), str(best["description"]), float(best["score"]))

        return (None, None, 0.0)

    def normalize_diagnosis(
        self,
        text: str,
        category_filter: Optional[str] = None,
    ) -> tuple[Optional[str], Optional[str], float]:
        """Normalize a diagnosis description to an ICD-10 code.

        Args:
            text: Free-text diagnosis description.
            category_filter: Optional category to narrow the search.

        Returns:
            Tuple of (icd10_code, description, confidence).
            Returns (None, None, 0.0) if no suitable match is found.
        """
        if not text.strip():
            return (None, None, 0.0)

        matches = self.icd10_matcher.match(
            text, top_n=1, category_filter=category_filter
        )

        if matches:
            best = matches[0]
            return (str(best["code"]), str(best["description"]), float(best["score"]))

        return (None, None, 0.0)

    def normalize_body_part(self, text: str) -> Optional[str]:
        """Normalize a body part description to a standardized name.

        Uses exact match first, then falls back to fuzzy matching against
        the canonical body part dictionary.

        Args:
            text: Free-text body part description.

        Returns:
            Standardized body part name, or None if no match found.
        """
        if not text.strip():
            return None

        lower_text = text.strip().lower()

        # Try exact match first
        if lower_text in BODY_PART_CANONICAL:
            return BODY_PART_CANONICAL[lower_text]

        # Try fuzzy matching
        best_match: Optional[str] = None
        best_score = 0

        for key, canonical in BODY_PART_CANONICAL.items():
            # Use token_set_ratio for better handling of word order differences
            score = fuzz.token_set_ratio(lower_text, key)
            if score > best_score and score >= settings.fuzzy_match_threshold:
                best_score = score
                best_match = canonical

        return best_match

    def normalize_modality(self, text: str) -> Optional[str]:
        """Normalize a modality description to a standardized name.

        Uses exact match first, then falls back to fuzzy matching against
        the canonical modality dictionary.

        Args:
            text: Free-text modality description.

        Returns:
            Standardized modality name, or None if no match found.
        """
        if not text.strip():
            return None

        lower_text = text.strip().lower()

        # Try exact match first
        if lower_text in MODALITY_CANONICAL:
            return MODALITY_CANONICAL[lower_text]

        # Try fuzzy matching
        best_match: Optional[str] = None
        best_score = 0

        for key, canonical in MODALITY_CANONICAL.items():
            score = fuzz.token_set_ratio(lower_text, key)
            if score > best_score and score >= settings.fuzzy_match_threshold:
                best_score = score
                best_match = canonical

        return best_match
