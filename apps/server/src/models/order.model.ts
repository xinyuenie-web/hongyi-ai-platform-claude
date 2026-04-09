import mongoose, { Schema, Document } from 'mongoose';
import type { IOrder } from '@hongyi/shared';

export interface OrderDocument extends Omit<IOrder, '_id'>, Document {}

const logisticsNodeSchema = new Schema(
  {
    step: { type: String, required: true },
    description: { type: String, required: true },
    media: [{ type: String }],
    timestamp: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDocument>(
  {
    orderNo: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    designId: { type: String },
    treeIds: [{ type: String }],
    totalAmount: { type: Number, required: true },
    payStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunding', 'refunded'],
      default: 'unpaid',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'preparing', 'shipping', 'delivered', 'completed', 'cancelled', 'refunded'],
      default: 'pending',
    },
    shippingAddress: { type: String, default: '' },
    logistics: [logisticsNodeSchema],
    afterSaleNote: { type: String },
  },
  { timestamps: true },
);

orderSchema.index({ orderNo: 1 });
orderSchema.index({ customerId: 1 });
orderSchema.index({ status: 1 });

export const Order = mongoose.model<OrderDocument>('Order', orderSchema);
