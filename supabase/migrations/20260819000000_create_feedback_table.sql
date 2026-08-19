-- profile.tsx's "Share feedback" form (FeedbackSection) has been calling
-- supabase.from("feedback").insert(...) since it was built, but this table
-- never actually existed — the client code cast the query to `any` to get
-- past the type checker, and .insert()'s resulting {error} was never
-- checked, so every submission silently failed while still showing the
-- user a "Thank you — we read every message" success state. Nothing was
-- ever saved anywhere.
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Insert-only: feedback is a one-way mailbox to the team (delivered by
-- email via the submit-feedback edge function), not something users browse
-- their own history of, so there's no SELECT policy for `authenticated`.
CREATE POLICY "Users can submit feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
