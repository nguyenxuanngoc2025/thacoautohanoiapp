SET ROLE supabase_admin;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS thaco_master_channel_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT,
    name TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Give API access
GRANT ALL ON thaco_master_channel_groups TO postgres, anon, authenticated, service_role;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='thaco_master_channels' AND column_name='group_id'
    ) THEN
        ALTER TABLE thaco_master_channels ADD COLUMN group_id UUID REFERENCES thaco_master_channel_groups(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Insert categories as groups if they don't exist
INSERT INTO thaco_master_channel_groups (code, name, sort_order)
SELECT 
    lower(category) as code, 
    category as name,
    row_number() over (order by category) as sort_order
FROM (SELECT DISTINCT category FROM thaco_master_channels WHERE category IS NOT NULL AND category != '') t
WHERE NOT EXISTS (SELECT 1 FROM thaco_master_channel_groups WHERE thaco_master_channel_groups.name = t.category);

-- Update group_id
UPDATE thaco_master_channels c
SET group_id = g.id
FROM thaco_master_channel_groups g
WHERE c.category = g.name AND c.group_id IS NULL;
