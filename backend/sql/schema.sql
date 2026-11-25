CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS countries (
  code     CHAR(2) PRIMARY KEY,
  name     TEXT NOT NULL,
  currency TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  country_code  CHAR(2) NOT NULL REFERENCES countries(code),
  city          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_slug  TEXT NOT NULL REFERENCES categories(slug),
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  country_code   CHAR(2) NOT NULL REFERENCES countries(code),
  city           TEXT NOT NULL,
  budget         NUMERIC(14,2) NOT NULL CHECK (budget > 0),
  currency       TEXT NOT NULL,
  estimated_date DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','assigned','completed','cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_feed  ON jobs (status, country_code, category_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS job_images (
  id     BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  url    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_job_images_job ON job_images (job_id);

CREATE TABLE IF NOT EXISTS bids (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  estimated_date DATE NOT NULL,
  message        TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, worker_id)
);
CREATE INDEX IF NOT EXISTS idx_bids_worker ON bids (worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, worker_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, id);

CREATE TABLE IF NOT EXISTS outbox (
  id           BIGSERIAL PRIMARY KEY,
  type         TEXT NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (id) WHERE published_at IS NULL;

INSERT INTO countries (code, name, currency) VALUES
  ('CO','Colombia','COP'),('US','United States','USD'),('BR','Brasil','BRL'),
  ('FR','France','EUR'),('DE','Deutschland','EUR')
ON CONFLICT DO NOTHING;

INSERT INTO categories (slug) VALUES
  ('plumbing'),('construction'),('electricity'),('painting'),('cleaning'),('gardening')
ON CONFLICT DO NOTHING;
