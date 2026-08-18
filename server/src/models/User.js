import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['commissioner', 'engineer', 'analyst'],
      default: 'analyst',
    },
    designation: { type: String, default: '' },
    authority: {
      type: String,
      enum: ['NMC', 'NIT', 'NMRDA', 'PWD', 'NHAI'],
      default: 'NMC',
    },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    designation: this.designation,
    authority: this.authority,
  };
};

export const User = mongoose.model('User', userSchema);
