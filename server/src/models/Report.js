import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    refId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    windowId: String,
    simulation: { type: mongoose.Schema.Types.ObjectId, ref: 'Simulation', index: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    generatedByName: String,
    authority: String,
    /** Frozen snapshot: simulation result + recommendations at generation time. */
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Report = mongoose.model('Report', reportSchema);
