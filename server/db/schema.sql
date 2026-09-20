-- Reference schema matching the defaults in src/mapping.js.
--
-- The real database already exists, so this file is here for two reasons:
--   1. it documents exactly what the API expects, and
--   2. it lets you spin up a throwaway database to develop against.
-- When the real schema lands, edit src/mapping.js instead of changing the
-- production database to match this file.

CREATE TABLE IF NOT EXISTS sites (
    id                      SERIAL PRIMARY KEY,
    slug                    TEXT UNIQUE,
    name                    TEXT NOT NULL,
    short_description       TEXT,
    description             TEXT,
    category                TEXT,
    thumbnail_url           TEXT,

    -- Map position. Constrained so a bad import cannot put a pin off-planet.
    latitude                NUMERIC(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude               NUMERIC(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),

    -- The 3D scan, as TannitXR identifies it.
    model_id                TEXT,
    model_url               TEXT,
    model_format            TEXT,

    -- Tourism guide fields.
    address                 TEXT,
    admission_cost          NUMERIC(8, 2) CHECK (admission_cost >= 0),
    currency                TEXT DEFAULT 'USD',
    opening_hours           TEXT,
    visit_duration_minutes  INTEGER CHECK (visit_duration_minutes > 0),
    accessibility           TEXT,
    year_built              INTEGER,
    website                 TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The map list query filters on coordinates and sorts by name or category.
CREATE INDEX IF NOT EXISTS sites_location_idx ON sites (latitude, longitude);
CREATE INDEX IF NOT EXISTS sites_category_idx ON sites (category);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sites_set_updated_at ON sites;
CREATE TRIGGER sites_set_updated_at
    BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
