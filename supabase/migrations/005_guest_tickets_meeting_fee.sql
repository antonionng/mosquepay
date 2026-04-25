-- Add guest ticket and meeting fee options to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS enable_guest_tickets BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS guest_ticket_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS guest_ticket_description TEXT,
  ADD COLUMN IF NOT EXISTS enable_meeting_fee BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meeting_fee_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS meeting_fee_description TEXT;

-- Track meeting fee and guest ticket amounts on payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS meeting_fee_amount DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS guest_ticket_amount DECIMAL(10,2) DEFAULT 0.00;

-- Named guest details per RSVP
CREATE TABLE IF NOT EXISTS event_guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lodge_id UUID REFERENCES lodges(id),
  rsvp_id UUID REFERENCES rsvps(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  guest_name VARCHAR(255) NOT NULL,
  dietary_requirements TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_guests_rsvp_id ON event_guests(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_event_id ON event_guests(event_id);
