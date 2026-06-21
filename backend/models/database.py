"""
Database connection and models for Kread Insights Backend
"""

import os
import bcrypt
from typing import Optional
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Integer, Numeric, Text, Enum, ARRAY, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import uuid

from config import settings

# Database engine
DATABASE_URL = settings.DATABASE_URL or os.getenv("DATABASE_URL", "")
engine = create_engine(DATABASE_URL) if DATABASE_URL else None
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None

Base = declarative_base()

# Enum definitions (matching PostgreSQL enums)
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    viewer = "viewer"


class RestaurantStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class PlatformType(str, enum.Enum):
    zomato = "zomato"
    swiggy = "swiggy"


class UploadStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    processed = "processed"
    failed = "failed"


class AlertSeverity(str, enum.Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


class ReportType(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    fortnightly = "fortnightly"
    monthly = "monthly"


class ReportFormat(str, enum.Enum):
    pdf = "pdf"
    xlsx = "xlsx"
    csv = "csv"


class PeriodType(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class AuditAction(str, enum.Enum):
    restaurant_created = "restaurant_created"
    restaurant_edited = "restaurant_edited"
    restaurant_archived = "restaurant_archived"
    restaurant_restored = "restaurant_restored"
    restaurant_deleted = "restaurant_deleted"
    file_uploaded = "file_uploaded"
    report_generated = "report_generated"
    alert_acknowledged = "alert_acknowledged"


class AuditTargetType(str, enum.Enum):
    restaurant = "restaurant"
    file = "file"
    report = "report"
    alert = "alert"


# SQLAlchemy Models
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(Text, default="viewer")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, unique=True, nullable=False)
    display_name = Column(Text, nullable=False)
    status = Column(Text, default="active")
    is_archived = Column(Boolean, default=False)
    archived_at = Column(DateTime, nullable=True)
    archived_by = Column(UUID(as_uuid=True), nullable=True)
    archive_reason = Column(Text, nullable=True)
    platform = Column(Text, default="zomato")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_name = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    row_count = Column(Integer, default=0)
    status = Column(Text, default="pending")
    error_details = Column(JSONB, nullable=True)


class RawImport(Base):
    __tablename__ = "raw_imports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploaded_file_id = Column(UUID(as_uuid=True), nullable=False)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    date = Column(Date, nullable=False)
    raw_row_data = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DailyMetrics(Base):
    __tablename__ = "daily_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    date = Column(Date, nullable=False)

    # Sales Overview
    sales = Column(Numeric(12, 2), default=0)
    delivered_orders = Column(Integer, default=0)
    average_order_value = Column(Numeric(10, 2), default=0)

    # Customer Funnel
    impressions = Column(Integer, default=0)
    menu_to_order = Column(Numeric(5, 2), default=0)
    menu_to_cart = Column(Numeric(5, 2), default=0)
    cart_to_order = Column(Numeric(5, 2), default=0)

    # Marketing
    sales_from_ads = Column(Numeric(12, 2), default=0)
    ad_click_through_rate = Column(Numeric(5, 2), default=0)
    ads_orders = Column(Integer, default=0)
    ads_impressions = Column(Integer, default=0)
    ads_spend = Column(Numeric(10, 2), default=0)
    ads_roi = Column(Numeric(5, 2), default=0)
    gross_sales_from_offers = Column(Numeric(12, 2), default=0)
    orders_with_offers = Column(Integer, default=0)
    discount_given = Column(Numeric(10, 2), default=0)
    effective_discount = Column(Numeric(5, 2), default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WeeklyAggregate(Base):
    __tablename__ = "weekly_aggregates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    week_number = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)

    # Sales Overview
    sales = Column(Numeric(12, 2), default=0)
    delivered_orders = Column(Integer, default=0)
    average_order_value = Column(Numeric(10, 2), default=0)

    # Customer Funnel
    impressions = Column(Integer, default=0)
    menu_to_order = Column(Numeric(5, 2), default=0)
    menu_to_cart = Column(Numeric(5, 2), default=0)
    cart_to_order = Column(Numeric(5, 2), default=0)

    # Marketing
    sales_from_ads = Column(Numeric(12, 2), default=0)
    ad_click_through_rate = Column(Numeric(5, 2), default=0)
    ads_orders = Column(Integer, default=0)
    ads_impressions = Column(Integer, default=0)
    ads_spend = Column(Numeric(10, 2), default=0)
    ads_roi = Column(Numeric(5, 2), default=0)
    gross_sales_from_offers = Column(Numeric(12, 2), default=0)
    orders_with_offers = Column(Integer, default=0)
    discount_given = Column(Numeric(10, 2), default=0)
    effective_discount = Column(Numeric(5, 2), default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MonthlyAggregate(Base):
    __tablename__ = "monthly_aggregates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)

    # Sales Overview
    sales = Column(Numeric(12, 2), default=0)
    delivered_orders = Column(Integer, default=0)
    average_order_value = Column(Numeric(10, 2), default=0)

    # Customer Funnel
    impressions = Column(Integer, default=0)
    menu_to_order = Column(Numeric(5, 2), default=0)
    menu_to_cart = Column(Numeric(5, 2), default=0)
    cart_to_order = Column(Numeric(5, 2), default=0)

    # Marketing
    sales_from_ads = Column(Numeric(12, 2), default=0)
    ad_click_through_rate = Column(Numeric(5, 2), default=0)
    ads_orders = Column(Integer, default=0)
    ads_impressions = Column(Integer, default=0)
    ads_spend = Column(Numeric(10, 2), default=0)
    ads_roi = Column(Numeric(5, 2), default=0)
    gross_sales_from_offers = Column(Numeric(12, 2), default=0)
    orders_with_offers = Column(Integer, default=0)
    discount_given = Column(Numeric(10, 2), default=0)
    effective_discount = Column(Numeric(5, 2), default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    metric_name = Column(Text, nullable=False)
    severity = Column(Text, nullable=False)
    current_value = Column(Numeric(12, 2), nullable=False)
    previous_value = Column(Numeric(12, 2), nullable=False)
    percentage_drop = Column(Numeric(5, 2), nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(UUID(as_uuid=True), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    generated_by = Column(UUID(as_uuid=True), nullable=False)
    report_type = Column(Text, nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    restaurant_ids = Column(ARRAY(UUID), nullable=False)
    format = Column(Text, nullable=False)
    file_path = Column(Text, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)


class Comparison(Base):
    __tablename__ = "comparisons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    restaurant_a_id = Column(UUID(as_uuid=True), nullable=False)
    restaurant_b_id = Column(UUID(as_uuid=True), nullable=False)
    period_type = Column(Text, nullable=False)
    period_value = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(Text, nullable=False)
    target_type = Column(Text, nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=False)
    metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# Helper functions
def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


async def create_seed_admin():
    """Create seed admin user if not exists"""
    from supabase import create_client, Client

    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Check if admin exists
    response = supabase.table("users").select("id").eq("email", settings.SEED_ADMIN_EMAIL).execute()

    if not response.data:
        # Create admin user
        hashed_password = hash_password(settings.SEED_ADMIN_PASSWORD)
        supabase.table("users").insert({
            "name": settings.SEED_ADMIN_NAME,
            "email": settings.SEED_ADMIN_EMAIL,
            "password_hash": hashed_password,
            "role": "admin"
        }).execute()
        print(f"Created seed admin user: {settings.SEED_ADMIN_EMAIL}")
