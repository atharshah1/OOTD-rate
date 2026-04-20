-- Migration: Ensure share links are publicly readable
-- This fixes 403 errors when generating/opening share links under RLS.

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view shares" ON shares;
CREATE POLICY "Anyone can view shares" ON shares
  FOR SELECT
  USING (true);
