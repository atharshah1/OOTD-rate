-- Migration: Auto-create a public.users profile row whenever a new auth.users row is created.
-- This prevents the foreign-key violation on posts.user_id when a user signs up via OAuth
-- (Google, Instagram) because Supabase only creates the row in auth.users, not public.users.

-- Allow users to insert their own profile row (needed for the upsert in the app layer too)
CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger function: copies the minimum required fields into public.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    -- Derive a default username from the email local-part or raw_user_meta_data
    COALESCE(
      NEW.raw_user_meta_data->>'preferred_username',
      NEW.raw_user_meta_data->>'user_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      'user_' || left(NEW.id::text, 8)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
