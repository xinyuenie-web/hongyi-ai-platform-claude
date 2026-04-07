import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface AdminDocument extends Document {
  username: string;
  password: string;
  comparePassword(candidate: string): Promise<boolean>;
}

const adminSchema = new Schema<AdminDocument>(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true },
);

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

adminSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const Admin = mongoose.model<AdminDocument>('Admin', adminSchema);
