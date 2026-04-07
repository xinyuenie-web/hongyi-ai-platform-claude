import mongoose, { Schema, Document } from 'mongoose';
import type { ITree } from '@hongyi/shared';

export interface TreeDocument extends Omit<ITree, '_id'>, Document {}

const treeSchema = new Schema<TreeDocument>(
  {
    treeId: {
      type: String,
      required: true,
      unique: true,
      match: /^HY\d{4}$/,
    },
    name: { type: String, required: true },
    species: { type: String, required: true, index: true },
    age: { type: Number },
    specs: {
      height: { type: Number, required: true },
      crown: { type: Number, required: true },
      trunkDiameter: { type: Number },
      rootBall: { type: Number },
    },
    price: {
      sale: { type: Number, required: true, index: true },
      excavation: { type: Number },
      packaging: { type: Number },
    },
    coverImage: { type: String, default: '' },
    images: [{ type: String }],
    video: { type: String },
    video360: { type: String },
    fengshui: {
      symbol: { type: String },
      positions: [{ type: String }],
      element: { type: String },
    },
    health: {
      grade: { type: String, enum: ['A', 'B', 'C'] },
      report: { type: String },
      inspectedAt: { type: String },
    },
    growthLogs: [
      {
        date: { type: String },
        image: { type: String },
        note: { type: String },
      },
    ],
    careGuide: { type: String },
    tags: [{ type: String }],
    location: { type: String },
    qrCode: { type: String },
    status: {
      type: String,
      enum: ['available', 'reserved', 'sold', 'maintenance', 'archived'],
      default: 'available',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Text index for search
treeSchema.index({ name: 'text', species: 'text', tags: 'text' });

// Virtual: total price
treeSchema.virtual('totalPrice').get(function (this: TreeDocument) {
  const p = this.price;
  return p.sale + (p.excavation || 0) + (p.packaging || 0);
});

export const Tree = mongoose.model<TreeDocument>('Tree', treeSchema);
