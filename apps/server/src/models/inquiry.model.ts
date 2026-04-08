import mongoose, { Schema, Document } from 'mongoose';
import type { IInquiry } from '@hongyi/shared';

export interface InquiryDocument extends Omit<IInquiry, '_id'>, Document {}

const inquirySchema = new Schema<InquiryDocument>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    wechatId: { type: String },
    message: { type: String, required: true },
    treeId: { type: String },
    photos: [{ type: String }],
    source: {
      type: String,
      enum: ['website_form', 'wechat', 'miniapp', 'douyin', 'xiaohongshu', 'referral', 'other'],
      default: 'website_form',
    },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'closed'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

export const Inquiry = mongoose.model<InquiryDocument>('Inquiry', inquirySchema);
