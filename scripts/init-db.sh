#!/bin/bash
set -e

# Create application user and grant privileges
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create user if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'swifteats_user') THEN
            CREATE USER swifteats_user WITH PASSWORD 'secure_password';
        END IF;
    END
    \$\$;

    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE swifteats TO swifteats_user;
    GRANT ALL ON SCHEMA public TO swifteats_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO swifteats_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO swifteats_user;

    -- Enable extensions
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS cube;
    CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;
EOSQL

echo "Database user 'swifteats_user' created successfully!"
echo "PostGIS and UUID extensions enabled successfully!"
