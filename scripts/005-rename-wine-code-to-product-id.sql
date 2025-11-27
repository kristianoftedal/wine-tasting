-- Rename 'code' column to 'product_id' in wines table
ALTER TABLE wines RENAME COLUMN code TO product_id;

-- Drop old index and create new one
DROP INDEX IF EXISTS idx_wines_code;
CREATE INDEX IF NOT EXISTS idx_wines_product_id ON wines(product_id);
