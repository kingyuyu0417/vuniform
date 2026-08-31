WITH new_user AS (
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'vu-test-staff-05@gmail.com',
    crypt('TestStaff123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    false,
    false
  )
  ON CONFLICT (email) DO UPDATE
    SET updated_at = now()
  RETURNING id
)
INSERT INTO public.staff_profiles (id, display_name, role, created_at, updated_at)
SELECT id, '測試店員5', 'staff', now(), now()
FROM new_user
ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      role = EXCLUDED.role,
      updated_at = now();
