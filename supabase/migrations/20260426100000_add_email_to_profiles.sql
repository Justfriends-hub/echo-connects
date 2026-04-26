-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN email TEXT;

-- Populate email from auth.users
UPDATE public.profiles
SET email = auth.users.email
FROM auth.users
WHERE public.profiles.id = auth.users.id;

-- Make email unique and not null (assuming all users have emails)
ALTER TABLE public.profiles ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- Update RLS policies to allow reading email
-- Assuming profiles are viewable by authenticated users, email should be included