import mongoose, { Schema, Document } from 'mongoose';
import type { ICustomer } from '@hongyi/shared';

export interface CustomerDocument extends Omit<ICustomer, '_id'>, Document {}

const customerSchema = new Schema<CustomerDocument>(
  {
    openid: { type: String, sparse: true },
    phone: { type: String, index: true },
    name: { type: String, required: true },
    wechatId: { type: String },
    address: { type: String },
    level: {
      type: String,
      enum: ['lead', 'prospect', 'customer', 'vip'],
      default: 'lead',
    },
    tags: [{ type: String }],
    source: {
      type: String,
      enum: ['website_form', 'wechat', 'miniapp', 'douyin', 'xiaohongshu', 'referral', 'other'],
      default: 'website_form',
    },
    assignedSalesId: { type: String },
    notes: { type: String },
  },
  { timestamps: true },
);

export const Customer = mongoose.model<CustomerDocument>('Customer', customerSchema);
