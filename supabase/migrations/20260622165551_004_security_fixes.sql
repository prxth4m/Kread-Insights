-- Fix audit_logs to enforce non-null user_id
ALTER TABLE public.audit_logs ALTER COLUMN user_id SET NOT NULL;

-- Tighten audit_logs insert policy - users can only insert their own logs
DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_own" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Tighten reports insert policy to admins only
DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert_admin" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Update alerts insert policy to allow system/service inserts
-- First drop the existing policy
DROP POLICY IF EXISTS "alerts_insert_admin" ON public.alerts;

-- Allow auth.uid() to be null for system-generated alerts, or user must be admin
CREATE POLICY "alerts_insert_admin_or_system" ON public.alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NULL OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow service role to insert alerts (for automated anomaly detection)
-- This is handled by using the service role key in edge functions