
-- Heartbeat table for active user tracking
CREATE TABLE public.user_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_heartbeats ENABLE ROW LEVEL SECURITY;

-- Users can upsert their own heartbeat
CREATE POLICY "Users can upsert own heartbeat"
ON public.user_heartbeats FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own heartbeat"
ON public.user_heartbeats FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Owners can view all heartbeats for dashboard
CREATE POLICY "Owners can view all heartbeats"
ON public.user_heartbeats FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Enable realtime on messages and content_reports
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reports;

-- Owner policy to count all messages
CREATE POLICY "Owners can count all messages"
ON public.messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));
