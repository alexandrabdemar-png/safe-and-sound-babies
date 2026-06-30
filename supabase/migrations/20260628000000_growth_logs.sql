CREATE TABLE growth_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  weight_lbs numeric,
  height_inches numeric,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE growth_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own growth logs"
  ON growth_logs FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );
