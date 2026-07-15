-- Create table for per-post boosts (views/likes/posts)
CREATE TABLE IF NOT EXISTS public.post_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  boost_kind public.boost_kind NOT NULL,
  boost_target INTEGER NOT NULL,
  boost_mode public.boost_mode NOT NULL DEFAULT 'instant',
  boost_start_time TIMESTAMPTZ,
  boost_end_time TIMESTAMPTZ,
  reaction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant execute/select to authenticated to allow app queries
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_boosts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_boosts TO anon;
