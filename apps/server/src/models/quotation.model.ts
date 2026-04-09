import mongoose, { Schema, Document } from 'mongoose';
import type { IQuotation } from '@hongyi/shared';

export interface QuotationDocument extends Omit<IQuotation, '_id'>, Document {}

const quotationItemSchema = new Schema(
  {
    treeId: { type: String, required: true },
    name: { type: String, required: true },
    species: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
  },
  { _id: false },
);

const quotationServiceSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
  },
  { _id: false },
);

const quotationSchema = new Schema<QuotationDocument>(
  {
    quotationNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    items: [quotationItemSchema],
    services: [quotationServiceSchema],
    treesSubtotal: { type: Number, default: 0 },
    servicesSubtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    discount: { type: Number },
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'expired'],
      default: 'draft',
    },
    validUntil: { type: String, required: true },
  },
  { timestamps: true },
);

quotationSchema.index({ quotationNo: 1 });
quotationSchema.index({ phone: 1 });

export const Quotation = mongoose.model<QuotationDocument>('Quotation', quotationSchema);
