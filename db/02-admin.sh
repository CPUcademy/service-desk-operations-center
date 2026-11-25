#!/bin/sh
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v email="$ADMIN_EMAIL" -v pass="$ADMIN_PASSWORD" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO "User" ("fullName", "email", "passwordHash", "isAdmin")
VALUES ('Administrator', :'email', crypt(:'pass', gen_salt('bf', 10)), TRUE);
SQL
