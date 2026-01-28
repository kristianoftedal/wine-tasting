-- Migration: Remove "style" property from content JSONB column (case insensitive)
-- This removes any key matching "style", "Style", "STYLE", etc.

-- Update all wines to remove "style" from content
UPDATE wines
SET content = content - 'style' - 'Style' - 'STYLE' - 'STYLE'
WHERE content IS NOT NULL 
  AND (
    content ? 'style' 
    OR content ? 'Style' 
    OR content ? 'STYLE'
  );

-- Verify the change
SELECT COUNT(*) as wines_with_style FROM wines 
WHERE content IS NOT NULL 
  AND (
    content ? 'style' 
    OR content ? 'Style' 
    OR content ? 'STYLE'
  );
