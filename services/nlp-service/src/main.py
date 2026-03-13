"""FastAPI application for the Radiology NLP Service.

Provides endpoints for extracting clinical entities from OCR text,
normalizing to standard medical codes, and matching free text to
CPT and ICD-10 codes.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config import settings
from src.extractors.clinical_extractor import (
    extract_clinical_data,
    is_spacy_loaded,
    _get_nlp,
)
from src.models import (
    CodeMatch,
    DiagnosisMatchRequest,
    DiagnosisMatchResult,
    ExtractionRequest,
    ExtractionResult,
    HealthResponse,
    NormalizedCode,
    NormalizationRequest,
    NormalizationResult,
    ProcedureMatchRequest,
    ProcedureMatchResult,
)
from src.normalizers.terminology_normalizer import TerminologyNormalizer

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Global normalizer instance (initialized at startup)
_normalizer: TerminologyNormalizer | None = None


def _get_normalizer() -> TerminologyNormalizer:
    """Get the global TerminologyNormalizer instance.

    Returns:
        The initialized TerminologyNormalizer.

    Raises:
        RuntimeError: If the normalizer has not been initialized.
    """
    if _normalizer is None:
        raise RuntimeError("TerminologyNormalizer not initialized")
    return _normalizer


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler for startup/shutdown tasks."""
    global _normalizer

    logger.info("Starting NLP Service v%s", settings.service_version)

    # Pre-load spaCy model
    logger.info("Loading spaCy model: %s", settings.spacy_model)
    _get_nlp()

    # Initialize terminology normalizer (loads CPT and ICD-10 dictionaries)
    logger.info("Initializing terminology normalizer...")
    _normalizer = TerminologyNormalizer()

    logger.info("NLP Service ready")
    yield

    logger.info("Shutting down NLP Service")


app = FastAPI(
    title="Radiology NLP Service",
    description=(
        "Extracts clinical information from OCR text and normalizes it "
        "to standard medical terminology (CPT, ICD-10)."
    ),
    version=settings.service_version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Add X-Process-Time header to all responses."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    response.headers["X-Process-Time"] = f"{elapsed:.4f}"
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unhandled exceptions with a structured error response."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "detail": "An unexpected error occurred. Please try again.",
        },
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/extract", response_model=ExtractionResult)
async def extract_entities(request: ExtractionRequest) -> ExtractionResult:
    """Extract clinical entities from OCR text.

    Takes raw OCR text and returns structured clinical data including patient
    demographics, provider information, procedure details, diagnoses, and
    confidence scores for each extracted field.

    Args:
        request: Extraction request with text, document_type, and source.

    Returns:
        ExtractionResult with all extracted fields and confidence scores.
    """
    if not request.text.strip():
        raise HTTPException(status_code=422, detail="Text field cannot be empty")

    logger.info(
        "Extraction request: doc_type=%s, source=%s, text_length=%d",
        request.document_type,
        request.source,
        len(request.text),
    )

    try:
        result = extract_clinical_data(
            text=request.text,
            doc_type=request.document_type,
        )
        logger.info(
            "Extraction complete: overall_confidence=%.2f, fields_extracted=%d",
            result.confidence_scores.get("overall", 0.0),
            len([v for v in result.confidence_scores.values() if v > 0]),
        )
        return result

    except Exception as e:
        logger.exception("Extraction failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}",
        )


@app.post("/normalize", response_model=NormalizationResult)
async def normalize_entities(request: NormalizationRequest) -> NormalizationResult:
    """Normalize extracted entities to standard medical codes.

    Takes an ExtractionResult and normalizes procedure descriptions to CPT
    codes and diagnoses to ICD-10 codes. Also standardizes body part and
    modality terminology.

    Args:
        request: Normalization request with extraction result and flags.

    Returns:
        NormalizationResult with normalized codes, body part, and modality.
    """
    normalizer = _get_normalizer()
    extraction = request.extraction

    cpt_codes: list[NormalizedCode] = []
    icd10_codes: list[NormalizedCode] = []
    body_part: str | None = None
    modality: str | None = None
    laterality: str | None = None

    try:
        # Normalize procedure to CPT
        if request.normalize_procedures and extraction.procedure_description:
            matches = normalizer.cpt_matcher.match(
                extraction.procedure_description,
                top_n=5,
            )
            for m in matches:
                cpt_codes.append(
                    NormalizedCode(
                        code=str(m["code"]),
                        description=str(m["description"]),
                        confidence=float(m["score"]),
                        source_text=extraction.procedure_description,
                    )
                )

        # Normalize diagnosis to ICD-10
        if request.normalize_diagnoses:
            diagnosis_text = extraction.diagnosis or extraction.clinical_indication
            if diagnosis_text:
                matches = normalizer.icd10_matcher.match(
                    diagnosis_text,
                    top_n=5,
                )
                for m in matches:
                    icd10_codes.append(
                        NormalizedCode(
                            code=str(m["code"]),
                            description=str(m["description"]),
                            confidence=float(m["score"]),
                            source_text=diagnosis_text,
                        )
                    )

        # Normalize body part
        if extraction.body_part:
            body_part = normalizer.normalize_body_part(extraction.body_part)

        # Normalize modality
        if extraction.modality:
            modality = normalizer.normalize_modality(extraction.modality)

        # Pass through laterality
        laterality = extraction.laterality

        return NormalizationResult(
            cpt_codes=cpt_codes,
            icd10_codes=icd10_codes,
            body_part=body_part,
            modality=modality,
            laterality=laterality,
        )

    except Exception as e:
        logger.exception("Normalization failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Normalization failed: {str(e)}",
        )


@app.post("/match-procedure", response_model=ProcedureMatchResult)
async def match_procedure(request: ProcedureMatchRequest) -> ProcedureMatchResult:
    """Match free text to CPT codes.

    Performs fuzzy matching of a procedure description against the radiology
    CPT code dictionary and returns the top N matches with confidence scores.

    Args:
        request: Match request with text, top_n, and optional modality_filter.

    Returns:
        ProcedureMatchResult with top matches and best match.
    """
    if not request.text.strip():
        raise HTTPException(status_code=422, detail="Text field cannot be empty")

    normalizer = _get_normalizer()

    try:
        raw_matches = normalizer.cpt_matcher.match(
            text=request.text,
            top_n=request.top_n,
            modality_filter=request.modality_filter,
        )

        matches = [
            CodeMatch(
                code=str(m["code"]),
                description=str(m["description"]),
                score=float(m["score"]),
            )
            for m in raw_matches
        ]

        best_match = matches[0] if matches else None

        return ProcedureMatchResult(
            query=request.text,
            matches=matches,
            best_match=best_match,
        )

    except Exception as e:
        logger.exception("Procedure matching failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Procedure matching failed: {str(e)}",
        )


@app.post("/match-diagnosis", response_model=DiagnosisMatchResult)
async def match_diagnosis(request: DiagnosisMatchRequest) -> DiagnosisMatchResult:
    """Match free text to ICD-10 codes.

    Performs fuzzy matching of a diagnosis description against the ICD-10
    code dictionary and returns the top N matches with confidence scores.

    Args:
        request: Match request with text and top_n.

    Returns:
        DiagnosisMatchResult with top matches and best match.
    """
    if not request.text.strip():
        raise HTTPException(status_code=422, detail="Text field cannot be empty")

    normalizer = _get_normalizer()

    try:
        raw_matches = normalizer.icd10_matcher.match(
            text=request.text,
            top_n=request.top_n,
        )

        matches = [
            CodeMatch(
                code=str(m["code"]),
                description=str(m["description"]),
                score=float(m["score"]),
            )
            for m in raw_matches
        ]

        best_match = matches[0] if matches else None

        return DiagnosisMatchResult(
            query=request.text,
            matches=matches,
            best_match=best_match,
        )

    except Exception as e:
        logger.exception("Diagnosis matching failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Diagnosis matching failed: {str(e)}",
        )


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint.

    Returns the service status, version, and readiness of NLP components
    including the spaCy model and code dictionaries.

    Returns:
        HealthResponse with service status and component readiness.
    """
    normalizer = _get_normalizer()

    return HealthResponse(
        status="healthy",
        service=settings.service_name,
        version=settings.service_version,
        spacy_model_loaded=is_spacy_loaded(),
        cpt_codes_loaded=normalizer.cpt_matcher.code_count,
        icd10_codes_loaded=normalizer.icd10_matcher.code_count,
    )
