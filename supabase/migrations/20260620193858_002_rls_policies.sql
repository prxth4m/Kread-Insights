-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users: Only admins can manage users, all authenticated can read their own
CREATE POLICY "users_select_own" ON users FOR SELECT
  TO authenticated USING (auth.uid()::text = id::text OR 
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

CREATE POLICY "users_insert_admin" ON users FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "users_update_admin" ON users FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Restaurants: All authenticated can read non-archived, admins can manage
CREATE POLICY "restaurants_select" ON restaurants FOR SELECT
  TO authenticated;

CREATE POLICY "restaurants_insert_admin" ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "restaurants_update_admin" ON restaurants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "restaurants_delete_admin" ON restaurants FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Uploaded files: Admins can manage, viewers can read
CREATE POLICY "uploaded_files_select" ON uploaded_files FOR SELECT
  TO authenticated;

CREATE POLICY "uploaded_files_insert_admin" ON uploaded_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "uploaded_files_update_admin" ON uploaded_files FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Raw imports: All authenticated can read, admins can insert
CREATE POLICY "raw_imports_select" ON raw_imports FOR SELECT
  TO authenticated;

CREATE POLICY "raw_imports_insert_admin" ON raw_imports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Daily metrics: All authenticated can read, admins can insert/update
CREATE POLICY "daily_metrics_select" ON daily_metrics FOR SELECT
  TO authenticated;

CREATE POLICY "daily_metrics_insert_admin" ON daily_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "daily_metrics_update_admin" ON daily_metrics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Weekly aggregates: All authenticated can read, admins can insert/update
CREATE POLICY "weekly_aggregates_select" ON weekly_aggregates FOR SELECT
  TO authenticated;

CREATE POLICY "weekly_aggregates_insert_admin" ON weekly_aggregates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "weekly_aggregates_update_admin" ON weekly_aggregates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Monthly aggregates: All authenticated can read, admins can insert/update
CREATE POLICY "monthly_aggregates_select" ON monthly_aggregates FOR SELECT
  TO authenticated;

CREATE POLICY "monthly_aggregates_insert_admin" ON monthly_aggregates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "monthly_aggregates_update_admin" ON monthly_aggregates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Alerts: All authenticated can read, admins can update
CREATE POLICY "alerts_select" ON alerts FOR SELECT
  TO authenticated;

CREATE POLICY "alerts_insert_admin" ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "alerts_update_admin" ON alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );

-- Reports: All authenticated can read and insert
CREATE POLICY "reports_select" ON reports FOR SELECT
  TO authenticated;

CREATE POLICY "reports_insert" ON reports FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Comparisons: All authenticated can read and insert
CREATE POLICY "comparisons_select" ON comparisons FOR SELECT
  TO authenticated;

CREATE POLICY "comparisons_insert" ON comparisons FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Audit logs: All authenticated can read, admins can insert
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  TO authenticated;

CREATE POLICY "audit_logs_insert_admin" ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  );