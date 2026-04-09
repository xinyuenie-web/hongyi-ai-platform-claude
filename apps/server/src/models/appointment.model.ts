import mongoose, { Schema, Document } from 'mongoose';
import type { IAppointment } from '@hongyi/shared';

export interface AppointmentDocument extends Omit<IAppointment, '_id'>, Document {}

const appointmentSchema = new Schema<AppointmentDocument>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    wechatId: { type: String },
    type: {
      type: String,
      enum: ['view_tree', 'live_stream', 'site_visit', 'consultation'],
      default: 'view_tree',
    },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    treeIds: [{ type: String }],
    message: { type: String },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    adminNote: { type: String },
  },
  { timestamps: true },
);

appointmentSchema.index({ date: 1, status: 1 });
appointmentSchema.index({ phone: 1 });

export const Appointment = mongoose.model<AppointmentDocument>('Appointment', appointmentSchema);
