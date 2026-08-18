import mongoose from 'mongoose';

const corridorSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    zone: String,
    jurisdiction: {
      type: String,
      enum: ['NMC', 'NIT', 'NMRDA', 'PWD', 'NHAI'],
      required: true,
      index: true,
    },
    roadClass: String,
    lengthKm: Number,
    lanes: Number,
    signals: Number,
    peakVolume: Number,
    peakBias: { type: String, enum: ['AM', 'PM', 'BAL'], default: 'BAL' },
    heavyPct: Number,
    transitShare: Number,
    alternates: [String],
    landmarks: [String],
    /** Simplified centreline, [[lat, lng], ...] */
    path: { type: [[Number]], default: [] },
  },
  { timestamps: true }
);

export const Corridor = mongoose.model('Corridor', corridorSchema);
