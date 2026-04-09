import { Router } from 'express';
import { createAppointment, listAppointments, updateAppointment, getAvailableSlots } from '../controllers/appointment.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const appointmentRouter = Router();

// Public
appointmentRouter.post('/', createAppointment);
appointmentRouter.get('/available-slots', getAvailableSlots);

// Admin
appointmentRouter.get('/', requireAuth, listAppointments);
appointmentRouter.put('/:id', requireAuth, updateAppointment);
