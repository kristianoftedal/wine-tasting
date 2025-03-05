import mongoose from 'mongoose';

const GroupSchema = new mongoose.Schema({
  name: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const EventSchema = new mongoose.Schema({
  name: String,
  date: Date,
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  wines: [String]
});

export const Group = mongoose.models.Group || mongoose.model('Group', GroupSchema);
export const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);
