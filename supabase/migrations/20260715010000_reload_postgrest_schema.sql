-- Force PostgREST to reload its schema cache. Migrations 3-5 were applied
-- via a direct --db-url connection (bypassing `supabase link`/`login`,
-- which weren't available in this environment), so the DDL event trigger
-- Supabase normally wires up to auto-notify PostgREST on schema changes may
-- not have fired. This NOTIFY is idempotent and safe to run any time.
NOTIFY pgrst, 'reload schema';
