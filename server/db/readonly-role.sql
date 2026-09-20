-- The API only ever runs SELECT. Give it a role that cannot do anything else,
-- so an injection bug or a leaked DATABASE_URL cannot destroy or alter data.
--
--   psql "$ADMIN_DATABASE_URL" -f db/readonly-role.sql
--
-- Then point DATABASE_URL at cityhack_readonly.

CREATE ROLE cityhack_readonly WITH LOGIN PASSWORD 'CHANGE_ME_BEFORE_RUNNING';

GRANT CONNECT ON DATABASE cityhack TO cityhack_readonly;
GRANT USAGE ON SCHEMA public TO cityhack_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO cityhack_readonly;

-- Cover tables added later.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO cityhack_readonly;

-- Explicitly deny the rest.
REVOKE CREATE ON SCHEMA public FROM cityhack_readonly;
