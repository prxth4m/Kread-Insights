-- Fix: sync public.users profile with auth.users for admin@kread.com
-- This resolves UUID mismatch between the seeded profile and actual auth user

DELETE FROM public.users WHERE email = 'admin@kread.com';

INSERT INTO public.users (id, name, email, role, password_hash)
SELECT
  au.id,
  'KREAD Admin',
  'admin@kread.com',
  'admin',
  NULL
FROM auth.users au
WHERE au.email = 'admin@kread.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', name = 'KREAD Admin';