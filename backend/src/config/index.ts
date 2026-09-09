import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const isVercel = !!process.env.VERCEL;

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'pa04_super_secret_jwt_key_2026_demo',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DB_PATH: process.env.DB_PATH || (isVercel ? '/tmp/pa04.db' : path.resolve(__dirname, '../../pa04.db')),
  UPLOAD_DIR: process.env.UPLOAD_DIR || (isVercel ? '/tmp/uploads' : path.resolve(__dirname, '../../uploads')),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};
