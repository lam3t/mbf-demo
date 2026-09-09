import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('❌ Server Error:', err);

  const status = err.status || 500;
  const message = err.message || 'Đã có lỗi xảy ra trên hệ thống.';

  res.status(status).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}
