-- Check current column types in wines table
SELECT 
  column_name, 
  data_type,
  udt_name
FROM information_schema.columns 
WHERE table_name = 'wines' 
AND column_name IN ('price', 'volume', 'price_new', 'volume_new', 'main_category', 'district', 'sub_district', 'main_country', 'main_producer', 'content')
ORDER BY column_name;
