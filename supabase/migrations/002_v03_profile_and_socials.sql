-- ====================================================================
-- KinoVibe v0.3 Database Migration: Profile System with Socials
-- ====================================================================

-- 1. ADD PROFILE & SOCIAL COLUMNS
DO $$
BEGIN
  -- Bio / Tagline (up to 280 characters)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bio') THEN
    ALTER TABLE public.profiles ADD COLUMN bio text DEFAULT '';
  END IF;

  -- Letterboxd handle or URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='letterboxd') THEN
    ALTER TABLE public.profiles ADD COLUMN letterboxd text DEFAULT '';
  END IF;

  -- X / Twitter handle or URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='twitter') THEN
    ALTER TABLE public.profiles ADD COLUMN twitter text DEFAULT '';
  END IF;

  -- Instagram handle or URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='instagram') THEN
    ALTER TABLE public.profiles ADD COLUMN instagram text DEFAULT '';
  END IF;

  -- YouTube handle or URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='youtube') THEN
    ALTER TABLE public.profiles ADD COLUMN youtube text DEFAULT '';
  END IF;

  -- Personal Website / Blog / Substack URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='website') THEN
    ALTER TABLE public.profiles ADD COLUMN website text DEFAULT '';
  END IF;

  -- All-time favorite film
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='favorite_movie') THEN
    ALTER TABLE public.profiles ADD COLUMN favorite_movie text DEFAULT '';
  END IF;

  -- Favorite genre
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='favorite_genre') THEN
    ALTER TABLE public.profiles ADD COLUMN favorite_genre text DEFAULT '';
  END IF;

  -- Flexible JSON for custom or future social links
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='socials') THEN
    ALTER TABLE public.profiles ADD COLUMN socials jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. INDEX FOR FAST USERNAME LOOKUPS
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 3. UPDATE USER SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    username,
    avatar_url,
    bio,
    letterboxd,
    twitter,
    instagram,
    youtube,
    website,
    favorite_movie,
    favorite_genre,
    socials
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. UPDATE EXISTING ROWS DEFAULTS IF NULL
UPDATE public.profiles SET
  bio = COALESCE(bio, ''),
  letterboxd = COALESCE(letterboxd, ''),
  twitter = COALESCE(twitter, ''),
  instagram = COALESCE(instagram, ''),
  youtube = COALESCE(youtube, ''),
  website = COALESCE(website, ''),
  favorite_movie = COALESCE(favorite_movie, ''),
  favorite_genre = COALESCE(favorite_genre, ''),
  socials = COALESCE(socials, '{}'::jsonb)
WHERE bio IS NULL 
   OR letterboxd IS NULL 
   OR twitter IS NULL 
   OR instagram IS NULL 
   OR youtube IS NULL 
   OR website IS NULL 
   OR favorite_movie IS NULL 
   OR favorite_genre IS NULL 
   OR socials IS NULL;

-- ====================================================================
-- End of Migration 002
-- ====================================================================
