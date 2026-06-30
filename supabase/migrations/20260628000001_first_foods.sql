CREATE TABLE first_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  food_name text NOT NULL,
  date_introduced date NOT NULL DEFAULT CURRENT_DATE,
  is_allergen boolean NOT NULL DEFAULT false,
  reaction_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE first_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own first foods"
  ON first_foods FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );
