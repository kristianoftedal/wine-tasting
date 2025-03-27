import mongoose from 'mongoose';

export interface EventDocument {
  _id: string;
  name: string;
  description: string;
  group: unknown;
  wines: [];
}

const EventSchema = new mongoose.Schema(
  {
    name: String,
    date: Date,
    description: String,
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    wines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WinesDetailed' }]
  },
  { collection: 'Events' }
);

const Event = mongoose.models.Event || mongoose.model<EventDocument>('Event', EventSchema);
export default Event;
