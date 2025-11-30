-- Rename code column to product_id in wines table
ALTER TABLE wines RENAME COLUMN code TO product_id;

-- Drop old index
DROP INDEX IF EXISTS idx_wines_code;

-- Create new index
CREATE INDEX idx_wines_product_id ON wines(product_id);
