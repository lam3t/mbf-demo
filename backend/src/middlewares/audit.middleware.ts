import { Response, NextFunction } from 'express';
import { db } from '../db/connection';
import { AuthenticatedRequest } from './auth.middleware';

export function auditLogger(action: string, entityType: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Intercept finish event to log only upon successful response
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const userId = req.user?.id || null;
          const entityId = req.params.id ? parseInt(req.params.id, 10) : null;
          const detail = JSON.stringify({
            method: req.method,
            path: req.originalUrl,
            body: req.body,
            query: req.query
          });

          const stmt = db.prepare(`
            INSERT INTO audit_logs (userId, action, entityType, entityId, detail, createdAt)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
          `);
          stmt.run(userId, action, entityType, entityId, detail);
        } catch (err) {
          console.error('⚠️ Failed to write audit log:', err);
        }
      }
    });

    next();
  };
}
