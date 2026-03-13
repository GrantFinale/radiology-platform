"""Pydantic models for NLP Service request/response schemas."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# --- Extraction Models ---


class ExtractionRequest(BaseModel):
    """Request to extract clinical entities from OCR text."""

    text: str = Field(..., description="Raw OCR text to extract clinical data from")
    document_type: str = Field(
        default="unknown",
        description="Type of document: fax_cover, referral_form, handwritten_note, report, unknown",
    )
    source: str = Field(
        default="unknown",
        description="Source system or identifier for the document",
    )


class ExtractionResult(BaseModel):
    """Extracted clinical entities from a document."""

    patient_name: Optional[str] = Field(None, description="Patient full name")
    patient_dob: Optional[str] = Field(None, description="Patient date of birth")
    patient_mrn: Optional[str] = Field(None, description="Medical record number")
    ordering_provider: Optional[str] = Field(None, description="Ordering provider name")
    provider_npi: Optional[str] = Field(None, description="Provider NPI number")
    procedure_description: Optional[str] = Field(
        None, description="Requested procedure description"
    )
    clinical_indication: Optional[str] = Field(
        None, description="Clinical indication for the study"
    )
    diagnosis: Optional[str] = Field(None, description="Primary diagnosis text")
    icd10_codes: list[str] = Field(
        default_factory=list, description="Extracted or matched ICD-10 codes"
    )
    cpt_codes: list[str] = Field(
        default_factory=list, description="Extracted or matched CPT codes"
    )
    urgency: Optional[str] = Field(
        None, description="Urgency level: STAT, urgent, routine"
    )
    laterality: Optional[str] = Field(
        None, description="Laterality: left, right, bilateral"
    )
    body_part: Optional[str] = Field(None, description="Body part for the study")
    modality: Optional[str] = Field(
        None, description="Imaging modality: CT, MRI, X-ray, US, etc."
    )
    special_instructions: Optional[str] = Field(
        None, description="Special instructions or notes"
    )
    confidence_scores: dict[str, float] = Field(
        default_factory=dict,
        description="Confidence score (0.0-1.0) per extracted field",
    )


# --- Normalization Models ---


class NormalizationRequest(BaseModel):
    """Request to normalize extracted entities to standard codes."""

    extraction: ExtractionResult = Field(
        ..., description="Extraction result to normalize"
    )
    normalize_procedures: bool = Field(
        True, description="Whether to normalize procedure descriptions to CPT codes"
    )
    normalize_diagnoses: bool = Field(
        True, description="Whether to normalize diagnoses to ICD-10 codes"
    )


class NormalizedCode(BaseModel):
    """A single normalized code with its metadata."""

    code: str = Field(..., description="Standard code (CPT or ICD-10)")
    description: str = Field(..., description="Official description of the code")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Match confidence score"
    )
    source_text: str = Field(..., description="Original text that was normalized")


class NormalizationResult(BaseModel):
    """Result of normalizing extracted entities."""

    cpt_codes: list[NormalizedCode] = Field(
        default_factory=list, description="Normalized CPT codes"
    )
    icd10_codes: list[NormalizedCode] = Field(
        default_factory=list, description="Normalized ICD-10 codes"
    )
    body_part: Optional[str] = Field(None, description="Standardized body part name")
    modality: Optional[str] = Field(None, description="Standardized modality name")
    laterality: Optional[str] = Field(None, description="Standardized laterality")


# --- Procedure Match Models ---


class ProcedureMatchRequest(BaseModel):
    """Request to match free text to CPT codes."""

    text: str = Field(..., description="Free-text procedure description to match")
    top_n: int = Field(5, ge=1, le=20, description="Number of top matches to return")
    modality_filter: Optional[str] = Field(
        None, description="Optional modality filter to narrow search"
    )


class CodeMatch(BaseModel):
    """A single code match result."""

    code: str = Field(..., description="Matched code")
    description: str = Field(..., description="Code description")
    score: float = Field(..., ge=0.0, le=1.0, description="Match score")


class ProcedureMatchResult(BaseModel):
    """Result of procedure code matching."""

    query: str = Field(..., description="Original query text")
    matches: list[CodeMatch] = Field(
        default_factory=list, description="Top matching CPT codes"
    )
    best_match: Optional[CodeMatch] = Field(
        None, description="Highest confidence match"
    )


# --- Diagnosis Match Models ---


class DiagnosisMatchRequest(BaseModel):
    """Request to match free text to ICD-10 codes."""

    text: str = Field(..., description="Free-text diagnosis description to match")
    top_n: int = Field(5, ge=1, le=20, description="Number of top matches to return")


class DiagnosisMatchResult(BaseModel):
    """Result of diagnosis code matching."""

    query: str = Field(..., description="Original query text")
    matches: list[CodeMatch] = Field(
        default_factory=list, description="Top matching ICD-10 codes"
    )
    best_match: Optional[CodeMatch] = Field(
        None, description="Highest confidence match"
    )


# --- Health Check ---


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., description="Service status")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="Service version")
    spacy_model_loaded: bool = Field(
        ..., description="Whether spaCy model is loaded"
    )
    cpt_codes_loaded: int = Field(
        ..., description="Number of CPT codes in dictionary"
    )
    icd10_codes_loaded: int = Field(
        ..., description="Number of ICD-10 codes in dictionary"
    )
