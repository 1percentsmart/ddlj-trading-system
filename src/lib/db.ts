/**
 * DDLJ Trading System — Database Client Stub
 * ==============================================
 *
 * The frontend does NOT connect to the database directly.
 * All data comes from the FastAPI backend via the API layer (src/lib/api.ts).
 *
 * This file exists to prevent build errors from the Prisma import.
 * If you need direct Supabase access from the frontend in the future,
 * replace this with a proper Supabase client.
 */

// No-op stub — all database access goes through the backend API
export const db = {
  /** All DB access goes through backend API — use src/lib/api.ts instead */
  $disconnect: async () => {},
} as any;
