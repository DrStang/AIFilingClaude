-- Run this in Supabase SQL Editor to verify your setup

-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('documents', 'reminders', 'user_preferences')
ORDER BY table_name;

-- Check if triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
AND trigger_name = 'on_auth_user_created';

-- Check if the user_preferences function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'create_user_preferences';

-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('documents', 'reminders', 'user_preferences');
