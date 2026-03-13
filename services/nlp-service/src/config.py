"""Configuration module for NLP Service."""

import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    """Application settings loaded from environment variables."""

    # Service configuration
    service_name: str = "nlp-service"
    service_version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = 8003
    debug: bool = False
    log_level: str = "INFO"

    # Database configuration
    database_url: str = ""
    db_pool_min: int = 2
    db_pool_max: int = 10

    # Redis configuration
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl: int = 3600  # 1 hour default TTL

    # spaCy model configuration
    spacy_model: str = "en_core_web_sm"

    # Matching thresholds
    cpt_match_threshold: float = 0.3
    icd10_match_threshold: float = 0.3
    fuzzy_match_threshold: int = 70  # fuzzywuzzy score threshold (0-100)

    # Extraction confidence thresholds
    high_confidence: float = 0.9
    medium_confidence: float = 0.7
    low_confidence: float = 0.5

    # Service URLs (for inter-service communication)
    ocr_service_url: str = "http://localhost:8002"
    fhir_service_url: str = "http://localhost:8004"

    def __post_init__(self) -> None:
        """Load values from environment variables after initialization."""
        self.host = os.getenv("NLP_SERVICE_HOST", self.host)
        self.port = int(os.getenv("NLP_SERVICE_PORT", str(self.port)))
        self.debug = os.getenv("NLP_SERVICE_DEBUG", "false").lower() == "true"
        self.log_level = os.getenv("LOG_LEVEL", self.log_level)

        self.database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/radiology_platform",
        )
        self.db_pool_min = int(os.getenv("DB_POOL_MIN", str(self.db_pool_min)))
        self.db_pool_max = int(os.getenv("DB_POOL_MAX", str(self.db_pool_max)))

        self.redis_url = os.getenv("REDIS_URL", self.redis_url)
        self.cache_ttl = int(os.getenv("CACHE_TTL", str(self.cache_ttl)))

        self.spacy_model = os.getenv("SPACY_MODEL", self.spacy_model)

        self.cpt_match_threshold = float(
            os.getenv("CPT_MATCH_THRESHOLD", str(self.cpt_match_threshold))
        )
        self.icd10_match_threshold = float(
            os.getenv("ICD10_MATCH_THRESHOLD", str(self.icd10_match_threshold))
        )
        self.fuzzy_match_threshold = int(
            os.getenv("FUZZY_MATCH_THRESHOLD", str(self.fuzzy_match_threshold))
        )

        self.ocr_service_url = os.getenv("OCR_SERVICE_URL", self.ocr_service_url)
        self.fhir_service_url = os.getenv("FHIR_SERVICE_URL", self.fhir_service_url)


settings = Settings()
