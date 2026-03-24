"""
core/config.py — Application settings loaded from .env
"""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # AI
    anthropic_api_key: str = ""

    # Social APIs
    instagram_access_token: str = ""
    instagram_business_id: str = ""
    linkedin_access_token: str = ""
    twitter_bearer_token: str = ""
    facebook_access_token: str = ""
    facebook_page_id: str = ""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    allowed_origins: str = "http://localhost:3000,http://localhost:8080,http://127.0.0.1:5500"

    # Cache
    cache_ttl_seconds: int = 300
    max_cache_items: int = 1000

    # Security
    secret_key: str = "insightsphere-dev-secret-key"
    access_token_expire_minutes: int = 60

    # Data
    data_refresh_interval_seconds: int = 30
    live_stream_interval_ms: int = 3000
    max_historical_days: int = 365

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def has_anthropic(self) -> bool:
        return bool(self.anthropic_api_key and self.anthropic_api_key.startswith("sk-"))

    @property
    def has_instagram(self) -> bool:
        return bool(self.instagram_access_token)

    @property
    def has_twitter(self) -> bool:
        return bool(self.twitter_bearer_token)

    @property
    def has_linkedin(self) -> bool:
        return bool(self.linkedin_access_token)

    @property
    def has_facebook(self) -> bool:
        return bool(self.facebook_access_token)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
