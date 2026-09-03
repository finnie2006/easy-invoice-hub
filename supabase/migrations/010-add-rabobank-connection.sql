CREATE TABLE IF NOT EXISTS public.rabobank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  environment text NOT NULL DEFAULT 'premium',
  scope text,
  token_type text,
  access_token_encrypted text,
  access_token_expires_at timestamptz,
  refresh_token_encrypted text,
  refresh_token_expires_at timestamptz,
  consented_on timestamptz,
  metadata text,
  status text NOT NULL DEFAULT 'connected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rabobank_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rabobank_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notification_id text,
  subscription_id text,
  notification_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rabobank_connections_user_id
  ON public.rabobank_connections (user_id);

CREATE INDEX IF NOT EXISTS idx_rabobank_oauth_states_hash
  ON public.rabobank_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS idx_rabobank_notifications_user_created
  ON public.rabobank_notifications (user_id, created_at DESC);
