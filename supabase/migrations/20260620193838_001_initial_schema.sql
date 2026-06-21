-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'viewer');
CREATE TYPE restaurant_status AS ENUM ('active', 'inactive');
CREATE TYPE platform_type AS ENUM ('zomato', 'swiggy');
CREATE TYPE upload_status AS ENUM ('pending', 'processing', 'processed', 'failed');
CREATE TYPE alert_severity AS ENUM ('critical', 'warning', 'info');
CREATE TYPE report_type AS ENUM ('daily', 'weekly', 'fortnightly', 'monthly');
CREATE TYPE report_format AS ENUM ('pdf', 'xlsx', 'csv');
CREATE TYPE period_type AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE audit_action AS ENUM ('restaurant_created', 'restaurant_edited', 'restaurant_archived', 'restaurant_restored', 'restaurant_deleted', 'file_uploaded', 'report_generated', 'alert_acknowledged');
CREATE TYPE audit_target_type AS ENUM ('restaurant', 'file', 'report', 'alert');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restaurants table
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  status restaurant_status NOT NULL DEFAULT 'active',
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES users(id),
  archive_reason TEXT,
  platform platform_type NOT NULL DEFAULT 'zomato',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uploaded files table
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID REFERENCES users(id) NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  row_count INTEGER DEFAULT 0,
  status upload_status NOT NULL DEFAULT 'pending',
  error_details JSONB
);

-- Raw imports table
CREATE TABLE raw_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_file_id UUID REFERENCES uploaded_files(id) NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id) NOT NULL,
  date DATE NOT NULL,
  raw_row_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily metrics table
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) NOT NULL,
  date DATE NOT NULL,
  -- Sales Overview
  sales DECIMAL(12,2) DEFAULT 0,
  delivered_orders INTEGER DEFAULT 0,
  average_order_value DECIMAL(10,2) DEFAULT 0,
  -- Customer Funnel
  impressions INTEGER DEFAULT 0,
  menu_to_order DECIMAL(5,2) DEFAULT 0,
  menu_to_cart DECIMAL(5,2) DEFAULT 0,
  cart_to_order DECIMAL(5,2) DEFAULT 0,
  -- Marketing
  sales_from_ads DECIMAL(12,2) DEFAULT 0,
  ad_click_through_rate DECIMAL(5,2) DEFAULT 0,
  ads_orders INTEGER DEFAULT 0,
  ads_impressions INTEGER DEFAULT 0,
  ads_spend DECIMAL(10,2) DEFAULT 0,
  ads_roi DECIMAL(5,2) DEFAULT 0,
  gross_sales_from_offers DECIMAL(12,2) DEFAULT 0,
  orders_with_offers INTEGER DEFAULT 0,
  discount_given DECIMAL(10,2) DEFAULT 0,
  effective_discount DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, date)
);

-- Weekly aggregates table
CREATE TABLE weekly_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  -- Sales Overview
  sales DECIMAL(12,2) DEFAULT 0,
  delivered_orders INTEGER DEFAULT 0,
  average_order_value DECIMAL(10,2) DEFAULT 0,
  -- Customer Funnel
  impressions INTEGER DEFAULT 0,
  menu_to_order DECIMAL(5,2) DEFAULT 0,
  menu_to_cart DECIMAL(5,2) DEFAULT 0,
  cart_to_order DECIMAL(5,2) DEFAULT 0,
  -- Marketing
  sales_from_ads DECIMAL(12,2) DEFAULT 0,
  ad_click_through_rate DECIMAL(5,2) DEFAULT 0,
  ads_orders INTEGER DEFAULT 0,
  ads_impressions INTEGER DEFAULT 0,
  ads_spend DECIMAL(10,2) DEFAULT 0,
  ads_roi DECIMAL(5,2) DEFAULT 0,
  gross_sales_from_offers DECIMAL(12,2) DEFAULT 0,
  orders_with_offers INTEGER DEFAULT 0,
  discount_given DECIMAL(10,2) DEFAULT 0,
  effective_discount DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, week_number, year)
);

-- Monthly aggregates table
CREATE TABLE monthly_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  -- Sales Overview
  sales DECIMAL(12,2) DEFAULT 0,
  delivered_orders INTEGER DEFAULT 0,
  average_order_value DECIMAL(10,2) DEFAULT 0,
  -- Customer Funnel
  impressions INTEGER DEFAULT 0,
  menu_to_order DECIMAL(5,2) DEFAULT 0,
  menu_to_cart DECIMAL(5,2) DEFAULT 0,
  cart_to_order DECIMAL(5,2) DEFAULT 0,
  -- Marketing
  sales_from_ads DECIMAL(12,2) DEFAULT 0,
  ad_click_through_rate DECIMAL(5,2) DEFAULT 0,
  ads_orders INTEGER DEFAULT 0,
  ads_impressions INTEGER DEFAULT 0,
  ads_spend DECIMAL(10,2) DEFAULT 0,
  ads_roi DECIMAL(5,2) DEFAULT 0,
  gross_sales_from_offers DECIMAL(12,2) DEFAULT 0,
  orders_with_offers INTEGER DEFAULT 0,
  discount_given DECIMAL(10,2) DEFAULT 0,
  effective_discount DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, month, year)
);

-- Alerts table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) NOT NULL,
  metric_name TEXT NOT NULL,
  severity alert_severity NOT NULL,
  current_value DECIMAL(12,2) NOT NULL,
  previous_value DECIMAL(12,2) NOT NULL,
  percentage_drop DECIMAL(5,2) NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ
);

-- Reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_by UUID REFERENCES users(id) NOT NULL,
  report_type report_type NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  restaurant_ids UUID[] NOT NULL,
  format report_format NOT NULL,
  file_path TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comparisons table
CREATE TABLE comparisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES users(id) NOT NULL,
  restaurant_a_id UUID REFERENCES restaurants(id) NOT NULL,
  restaurant_b_id UUID REFERENCES restaurants(id) NOT NULL,
  period_type period_type NOT NULL,
  period_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  action audit_action NOT NULL,
  target_type audit_target_type NOT NULL,
  target_id UUID NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_restaurants_is_archived ON restaurants(is_archived);
CREATE INDEX idx_restaurants_platform ON restaurants(platform);
CREATE INDEX idx_daily_metrics_restaurant_id ON daily_metrics(restaurant_id);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_weekly_aggregates_restaurant_id ON weekly_aggregates(restaurant_id);
CREATE INDEX idx_monthly_aggregates_restaurant_id ON monthly_aggregates(restaurant_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX idx_alerts_restaurant_id ON alerts(restaurant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_uploaded_files_status ON uploaded_files(status);