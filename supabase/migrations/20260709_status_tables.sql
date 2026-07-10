-- New enum for status media type
CREATE TYPE public.status_media_type AS ENUM ('text', 'image', 'video');

-- New enum for status privacy mode
CREATE TYPE public.status_privacy_type AS ENUM ('contacts', 'contacts_except', 'only_share_with');

-- Main statuses table
CREATE TABLE public.statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text,
  media_type public.status_media_type NOT NULL DEFAULT 'text',
  text_content text,
  background_color text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  privacy_mode public.status_privacy_type NOT NULL DEFAULT 'contacts'
);

CREATE INDEX idx_statuses_user_expires ON public.statuses (user_id, expires_at DESC);
CREATE INDEX idx_statuses_expires ON public.statuses (expires_at);

-- Status views tracking
CREATE TABLE public.status_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, viewer_id)
);

CREATE INDEX idx_status_views_status ON public.status_views (status_id);
CREATE INDEX idx_status_views_viewer ON public.status_views (viewer_id);

-- Privacy exclusions (for "contacts_except" and "only_share_with" modes)
CREATE TABLE public.status_privacy_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_type public.status_privacy_type NOT NULL,
  UNIQUE (user_id, target_user_id, list_type)
);

-- RLS
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_privacy_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see active statuses" ON public.statuses
  FOR SELECT TO authenticated
  USING (expires_at > now());

CREATE POLICY "Users insert own statuses" ON public.statuses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own statuses" ON public.statuses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users record own views" ON public.status_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users see views on own statuses" ON public.status_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid())
    OR auth.uid() = viewer_id
  );

CREATE POLICY "Users manage own privacy list" ON public.status_privacy_list
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.statuses REPLICA IDENTITY FULL;
ALTER TABLE public.status_views REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.status_views; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
