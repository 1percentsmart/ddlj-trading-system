-- Add missing exit IV field for completed option trades.
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS option_iv_exit DOUBLE PRECISION;
