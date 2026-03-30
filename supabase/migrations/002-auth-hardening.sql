ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_failed_login_at timestamptz;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_locked_until ON public.users (locked_until);
