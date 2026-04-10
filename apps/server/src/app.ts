import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/index.js';
import { treeRouter } from './routes/tree.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { inquiryRouter } from './routes/inquiry.routes.js';
import { gardenStyleRouter } from './routes/garden-style.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { appointmentRouter } from './routes/appointment.routes.js';
import { orderRouter } from './routes/order.routes.js';
import { quotationRouter } from './routes/quotation.routes.js';
import { errorHandler } from './middleware/error.js';

export function createApp(): express.Application {
  const app = express();

  // Security & parsing
  app.use(helmet());
  app.use(cors({ origin: config.cors.origins, credentials: true }));
  app.use(compression());
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded files (uploads volume in Docker)
  // Use absolute path to avoid cwd resolution issues
  const uploadsPath = path.join(process.cwd(), 'uploads');
  console.log(`[Static] Serving uploads from: ${uploadsPath}`);
  app.use('/uploads', express.static(uploadsPath, {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
    fallthrough: true,
  }));

  // Explicit fallback route for ai-generated images (belt-and-suspenders)
  app.get('/uploads/ai-generated/:filename', (req, res) => {
    const filePath = path.join(uploadsPath, 'ai-generated', req.params.filename);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`[Static] File not found: ${filePath}`);
        res.status(404).json({ error: 'File not found' });
      }
    });
  });

  // API routes
  app.use('/api/v1/trees', treeRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/inquiries', inquiryRouter);
  app.use('/api/v1/garden-styles', gardenStyleRouter);
  app.use('/api/v1/ai', aiRouter);
  app.use('/api/v1/appointments', appointmentRouter);
  app.use('/api/v1/orders', orderRouter);
  app.use('/api/v1/quotations', quotationRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
