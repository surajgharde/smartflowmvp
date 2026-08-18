import mongoose from 'mongoose';

const selectionSchema = new mongoose.Schema(
  {
    strategyId: String,
    intensity: Number,
    corridorCodes: [String],
  },
  { _id: false }
);

const simulationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    windowId: { type: String, enum: ['morning', 'evening'], default: 'morning' },
    selections: [selectionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdByName: String,
    status: {
      type: String,
      enum: ['saved', 'applied', 'archived'],
      default: 'saved',
      index: true,
    },
    appliedAt: Date,
    /** Headline deltas kept denormalised so the list view needs no re-run. */
    summary: {
      congestionIndexBefore: Number,
      congestionIndexAfter: Number,
      congestionIndexPct: Number,
      avgSpeedBefore: Number,
      avgSpeedAfter: Number,
      avgSpeedPct: Number,
      delayHoursBefore: Number,
      delayHoursAfter: Number,
      vehicleDelayPct: Number,
      co2Pct: Number,
      economicLossPct: Number,
      capexLakh: Number,
      paybackMonths: Number,
      deployDays: Number,
      improvedCount: Number,
      worsenedCount: Number,
    },
    /** Full paired-run payload, so a saved scenario reopens exactly as it ran. */
    result: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Simulation = mongoose.model('Simulation', simulationSchema);
