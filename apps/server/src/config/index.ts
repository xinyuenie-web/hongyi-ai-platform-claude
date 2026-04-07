import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hongyi',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: '7d',
  cors: {
    origins: [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.NEXT_PUBLIC_SITE_URL || '',
    ].filter(Boolean),
  },
  cos: {
    secretId: process.env.TENCENT_COS_SECRET_ID || '',
    secretKey: process.env.TENCENT_COS_SECRET_KEY || '',
    bucket: process.env.TENCENT_COS_BUCKET || '',
    region: process.env.TENCENT_COS_REGION || 'ap-guangzhou',
  },
} as const;
