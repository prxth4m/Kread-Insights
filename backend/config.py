"""
Configuration settings for Kread Insights Backend
"""

import os
from typing import Optional


class Settings:
    """Application settings loaded from environment variables"""

    # Supabase/PostgreSQL
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    DATABASE_URL: str = os.getenv("SUPABASE_DB_URL", "")

    # Authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-super-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Application
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")

    # Seed admin credentials (change in production)
    SEED_ADMIN_EMAIL: str = os.getenv("SEED_ADMIN_EMAIL", "admin@kread.com")
    SEED_ADMIN_PASSWORD: str = os.getenv("SEED_ADMIN_PASSWORD", "admin123")
    SEED_ADMIN_NAME: str = os.getenv("SEED_ADMIN_NAME", "KREAD Admin")

    # File upload
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: set = {"csv"}

    # Anomaly thresholds
    SALES_DROP_WARNING: float = 0.20  # 20%
    SALES_DROP_CRITICAL: float = 0.30  # 30%
    ORDERS_DROP_WARNING: float = 0.20
    ORDERS_DROP_CRITICAL: float = 0.30
    IMPRESSIONS_DROP_WARNING: float = 0.30
    IMPRESSIONS_DROP_CRITICAL: float = 0.50
    ROI_DROP_WARNING: float = 0.25
    ROI_DROP_CRITICAL: float = 0.40
    FUNNEL_DROP_WARNING: float = 0.15
    FUNNEL_DROP_CRITICAL: float = 0.25


settings = Settings()
