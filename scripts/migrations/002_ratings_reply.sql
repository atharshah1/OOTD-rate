-- Migration: Add reply column to ratings so post owners can respond to ratings
-- Run this in the Supabase SQL Editor

ALTER TABLE ratings ADD COLUMN IF NOT EXISTS reply TEXT;

-- Post owner can update the reply field for ratings on their posts
-- (the existing INSERT policy already allows all inserts)
-- Allow post owners to UPDATE ratings on their own posts (for replies only)
CREATE POLICY "Post owners can reply to ratings" ON ratings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = ratings.post_id
        AND posts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = ratings.post_id
        AND posts.user_id = auth.uid()
    )
  );
