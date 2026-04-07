import mongoose, { Schema, Document } from 'mongoose';
import type { IGardenStyleConfig } from '@hongyi/shared';

export interface GardenStyleDocument extends Omit<IGardenStyleConfig, '_id'>, Document {}

const gardenStyleSchema = new Schema<GardenStyleDocument>(
  {
    styleId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['modern', 'chinese', 'european', 'japanese', 'tuscan'],
      required: true,
    },
    image: { type: String },
    description: { type: String, required: true },
    keywords: [{ type: String }],
    elements: { type: String },
    architectureNotes: { type: String },
    suitableScenes: { type: String },
    atmosphere: { type: String },
  },
  { timestamps: true },
);

export const GardenStyle = mongoose.model<GardenStyleDocument>('GardenStyle', gardenStyleSchema);
