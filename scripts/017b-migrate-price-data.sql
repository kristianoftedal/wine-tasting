-- Step 2a: Migrate price data - extract value from JSON
UPDATE wines 
SET price_new = (price->>'value')::TEXT
WHERE price IS NOT NULL AND price_new IS NULL;
