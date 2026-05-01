-- Durable daily Kite access token store for Railway redeploy recovery.
CREATE TABLE IF NOT EXISTS kite_token_store (
    id           INTEGER PRIMARY KEY DEFAULT 1,
    access_token TEXT NOT NULL,
    expires_at   TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT kite_token_store_singleton CHECK (id = 1)
);

ALTER TABLE public.kite_token_store ENABLE ROW LEVEL SECURITY;
