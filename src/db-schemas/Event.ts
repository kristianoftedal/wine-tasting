import mongoose from 'mongoose';

export interface EventDocument {
  _id: string;
  name: string;
  description: string;
  date: Date;
  group: string;
  wines: string[];
}

const EventSchema = new mongoose.Schema(
  {
    name: String,
    date: Date,
    description: String,
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    wines: [{ type: mongoose.Schema.Types.String }]
  },
  { collection: 'Events' }
);

const Event = mongoose.models.Event || mongoose.model<EventDocument>('Event', EventSchema);
export default Event;
