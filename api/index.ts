export default async function handler(req: any, res: any) {
  try {
    const app = require('../backend/src/server').default;
    return app(req, res);
  } catch (err: any) {
    console.error('Serverless Init Error:', err);
    return res.status(500).json({
      error: 'Serverless Handler Exception',
      message: err?.message || String(err),
      stack: err?.stack,
      nodeVersion: process.version,
      env: {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV
      }
    });
  }
}
