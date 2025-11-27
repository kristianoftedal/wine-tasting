-- Add event_id column to tastings table
ALTER TABLE tastings
ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- Create index for faster queries by event
CREATE INDEX idx_tastings_event_id ON tastings(event_id);
