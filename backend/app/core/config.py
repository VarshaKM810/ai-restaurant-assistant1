"""
Core configuration settings using pydantic-settings.
Reads from environment variables and .env file.
"""

from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from typing import List
import os


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "RestaurantAI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str

    # Google Gemini AI
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3-flash-preview"
    EMBEDDING_MODEL: str = "text-embedding-004"

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # Environment
    ENVIRONMENT: str = "development"
    
    # Microservice URL for heavy ML/RAG processing
    ML_SERVICE_URL: str = ""

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


# Singleton settings instance
settings = Settings()
