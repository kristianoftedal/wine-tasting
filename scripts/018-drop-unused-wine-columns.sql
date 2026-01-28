-- Migration: Drop unused columns from wines table
-- These columns are not being used in the application

ALTER TABLE wines 
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS summary,
  DROP COLUMN IF EXISTS litre_price,
  DROP COLUMN IF EXISTS age_limit,
  DROP COLUMN IF EXISTS allergens,
  DROP COLUMN IF EXISTS bio_dynamic,
  DROP COLUMN IF EXISTS buyable,
  DROP COLUMN IF EXISTS cork,
  DROP COLUMN IF EXISTS eco,
  DROP COLUMN IF EXISTS environmental_packaging,
  DROP COLUMN IF EXISTS expired,
  DROP COLUMN IF EXISTS package_type,
  DROP COLUMN IF EXISTS release_mode,
  DROP COLUMN IF EXISTS similiar_products,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS status_notification,
  DROP COLUMN IF EXISTS sustainable,
  DROP COLUMN IF EXISTS distributor,
  DROP COLUMN IF EXISTS distributor_id;
