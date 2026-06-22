-- Make password_hash nullable (Supabase Auth handles passwords now)
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN password_hash SET DEFAULT NULL;

-- Drop unique constraint on name (same chain can have multiple branches)
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_name_key;

-- Add Zomato-specific columns to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS zomato_id TEXT,
  ADD COLUMN IF NOT EXISTS subzone TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

-- Add a real UNIQUE constraint on zomato_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_zomato_id_key'
  ) THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_zomato_id_key UNIQUE (zomato_id);
  END IF;
END $$;

-- Add new metric columns to daily_metrics (only if not exist)
ALTER TABLE public.daily_metrics
  ADD COLUMN IF NOT EXISTS market_share NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rated_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bad_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpt_delayed_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS poor_rated_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_complaints NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lost_sales NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offline_hours NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpt_minutes NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS for_accuracy NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS menu_opens NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cart_builds NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placed_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_user_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_user_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapsed_user_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinner_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snacks_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakfast_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_night_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ads_menu_opens NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_refunded_complaints NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_poor_packaging NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_poor_quality NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_wrong_order NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_missing_items NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_logs_other_ors NUMERIC DEFAULT 0;

-- Add same columns to weekly_aggregates
ALTER TABLE public.weekly_aggregates
  ADD COLUMN IF NOT EXISTS impressions_to_menu NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_share NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rated_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bad_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpt_delayed_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS poor_rated_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_complaints NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lost_sales NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offline_hours NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpt_minutes NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS for_accuracy NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS menu_opens NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cart_builds NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placed_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_user_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_user_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapsed_user_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinner_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snacks_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakfast_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_night_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ads_menu_opens NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_refunded_complaints NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_poor_packaging NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_poor_quality NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_wrong_order NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_missing_items NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_logs_other_ors NUMERIC DEFAULT 0;

-- Add same columns to monthly_aggregates
ALTER TABLE public.monthly_aggregates
  ADD COLUMN IF NOT EXISTS impressions_to_menu NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_share NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rated_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bad_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpt_delayed_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS poor_rated_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_complaints NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lost_sales NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offline_hours NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpt_minutes NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS for_accuracy NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS menu_opens NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cart_builds NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placed_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_user_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_user_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapsed_user_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinner_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snacks_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakfast_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_night_orders NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ads_menu_opens NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_refunded_complaints NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_poor_packaging NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_poor_quality NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_wrong_order NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_missing_items NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_logs_other_ors NUMERIC DEFAULT 0;

-- Auto-create profile row in users when Supabase Auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, password_hash)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'viewer'),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Create index on zomato_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_zomato_id ON restaurants(zomato_id);