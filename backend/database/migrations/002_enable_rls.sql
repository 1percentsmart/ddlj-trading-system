-- Enable row level security on Supabase-exposed public tables.
--
-- The application backend writes through the server-side database connection.
-- No browser Supabase client policies are defined, so anon/authenticated API
-- access is denied by default while backend persistence continues to work.

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kite_token_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;
