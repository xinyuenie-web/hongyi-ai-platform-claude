import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/index.js';
import { treeRouter } from './routes/tree.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { inquiryRouter } from './routes/inquiry.routes.js';
import { gardenStyleRouter } from './routes/garden-style.routes.js';
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

  // Serve uploaded files in development
  app.use('/uploads', express.static('uploads'));

  // API routes
  app.use('/api/v1/trees', treeRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/inquiries', inquiryRouter);
  app.use('/api/v1/garden-styles', gardenStyleRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
