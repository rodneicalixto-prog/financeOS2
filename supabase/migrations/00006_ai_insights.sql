CREATE TABLE IF NOT EXISTS fo_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('monthly_summary','anomalies','forecast','budget_suggestions')),
  reference_month DATE NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_stale BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, insight_type, reference_month)
);

ALTER TABLE fo_ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own insights" ON fo_ai_insights;
CREATE POLICY "Users read own insights"
  ON fo_ai_insights FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own insights" ON fo_ai_insights;
CREATE POLICY "Users delete own insights"
  ON fo_ai_insights FOR DELETE
  USING (user_id = auth.uid());
