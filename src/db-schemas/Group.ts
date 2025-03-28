import mongoose from 'mongoose';

export interface GroupDocument {
  _id: string;
  name: string;
  description: string;
  members: [];
}

const GroupSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { collection: 'Groups' }
);

const Group = mongoose.models.Group || mongoose.model<GroupDocument>('Group', GroupSchema);
export default Group;
