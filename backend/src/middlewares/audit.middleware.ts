import { Response, NextFunction } from 'express';
import { db } from '../db/connection';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Helper to fetch snapshot from database based on entityType and entityId
 */
export function getEntitySnapshot(entityType: string, entityId: number | string): any {
  if (!entityId) return null;
  const numId = typeof entityId === 'number' ? entityId : parseInt(entityId, 10);
  if (isNaN(numId)) return null;

  try {
    const normalizedType = entityType.toUpperCase();
    if (normalizedType.includes('OBJECT')) {
      return db.prepare('SELECT * FROM business_objects WHERE id = ?').get(numId) || null;
    } else if (normalizedType.includes('PLAN')) {
      return db.prepare('SELECT * FROM plans WHERE id = ?').get(numId) || null;
    } else if (normalizedType.includes('INSPECTION') && !normalizedType.includes('REQUEST') && !normalizedType.includes('DOMAIN')) {
      return db.prepare(`
        SELECT i.*, o.name as objectName, o.taxCode as objectTaxCode
        FROM inspections i
        LEFT JOIN business_objects o ON i.objectId = o.id
        WHERE i.id = ?
      `).get(numId) || null;
    } else if (normalizedType.includes('ADHOC')) {
      return db.prepare(`
        SELECT a.*, o.name as objectName, o.ward as objectWard
        FROM adhoc_inspection_requests a
        LEFT JOIN business_objects o ON a.objectId = o.id
        WHERE a.id = ?
      `).get(numId) || null;
    } else if (normalizedType.includes('USER')) {
      return db.prepare('SELECT id, username, fullName, role, unit, isActive, createdAt FROM users WHERE id = ?').get(numId) || null;
    } else if (normalizedType.includes('CATALOG') || normalizedType.includes('VIOLATION')) {
      return db.prepare('SELECT * FROM violation_catalog WHERE id = ?').get(numId) || null;
    } else if (normalizedType.includes('DOMAIN')) {
      return db.prepare('SELECT * FROM inspection_domains WHERE id = ?').get(numId) || null;
    }
  } catch (err) {
    // Ignore snapshot fetch error
  }
  return null;
}

/**
 * Helper to resolve ward from snapshot, request, or entity references
 */
export function resolveWardForEntity(entityType: string, entityId: number | null, snapshot: any, req: AuthenticatedRequest): string | null {
  if (snapshot?.ward) return snapshot.ward;
  if (snapshot?.wardRequestedBy) return snapshot.wardRequestedBy;
  if (snapshot?.objectWard) return snapshot.objectWard;
  if (snapshot?.unit && snapshot.unit.startsWith('Phường')) return snapshot.unit;

  if (req.body?.ward) return req.body.ward;
  if (req.query?.ward) return String(req.query.ward);

  if (entityId) {
    try {
      const normalizedType = entityType.toUpperCase();
      if (normalizedType.includes('INSPECTION')) {
        const insp = db.prepare('SELECT ward FROM inspections WHERE id = ?').get(entityId) as { ward?: string } | undefined;
        if (insp?.ward) return insp.ward;
        const obj = db.prepare('SELECT o.ward FROM business_objects o JOIN inspections i ON i.objectId = o.id WHERE i.id = ?').get(entityId) as { ward?: string } | undefined;
        if (obj?.ward) return obj.ward;
      } else if (normalizedType.includes('PLAN')) {
        const plan = db.prepare('SELECT ward FROM plans WHERE id = ?').get(entityId) as { ward?: string } | undefined;
        if (plan?.ward) return plan.ward;
      } else if (normalizedType.includes('ADHOC')) {
        const adhoc = db.prepare('SELECT wardRequestedBy FROM adhoc_inspection_requests WHERE id = ?').get(entityId) as { wardRequestedBy?: string } | undefined;
        if (adhoc?.wardRequestedBy) return adhoc.wardRequestedBy;
      }
    } catch (e) {
      // ignore
    }
  }

  if (req.user?.unit && req.user.unit.startsWith('Phường')) {
    return req.user.unit;
  }

  return null;
}

/**
 * Enhanced Audit Logger Middleware
 * Automatically captures pre-update snapshot (beforeData) on PUT/PATCH/DELETE,
 * captures post-update snapshot (afterData) on finish,
 * extracts client IP address, and denormalizes ward.
 */
export function auditLogger(action: string, entityType: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // 1. Determine entity ID from route params or body
    let candidateEntityId: number | null = null;
    if (req.params.id) {
      const parsed = parseInt(req.params.id, 10);
      if (!isNaN(parsed)) candidateEntityId = parsed;
    } else if (req.params.inspectionId) {
      const parsed = parseInt(req.params.inspectionId, 10);
      if (!isNaN(parsed)) candidateEntityId = parsed;
    } else if (req.params.planId) {
      const parsed = parseInt(req.params.planId, 10);
      if (!isNaN(parsed)) candidateEntityId = parsed;
    } else if (req.params.objectId) {
      const parsed = parseInt(req.params.objectId, 10);
      if (!isNaN(parsed)) candidateEntityId = parsed;
    }

    // 2. Pre-fetch Before Snapshot (especially for PUT, PATCH, DELETE)
    let beforeSnapshot: any = null;
    if (candidateEntityId && (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE' || req.method === 'POST')) {
      beforeSnapshot = getEntitySnapshot(entityType, candidateEntityId);
    }

    // 3. Client IP Address extraction
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || req.ip || '127.0.0.1';
    const cleanIp = rawIp.replace('::ffff:', '');

    // 4. Intercept response body or completion
    let responseBody: any = null;
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      responseBody = body;
      return originalJson(body);
    };

    // 5. Intercept finish event to log upon successful response
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const userId = req.user?.id || null;
          let finalEntityId = candidateEntityId;

          // If entity ID was not in params (e.g. POST create), try to get from response
          if (!finalEntityId && responseBody?.data) {
            const data = responseBody.data;
            if (typeof data.id === 'number') finalEntityId = data.id;
            else if (typeof data.inspectionId === 'number') finalEntityId = data.inspectionId;
            else if (typeof data.planId === 'number') finalEntityId = data.planId;
            else if (typeof data.objectId === 'number') finalEntityId = data.objectId;
          }

          // Fetch After Snapshot (unless it's a DELETE)
          let afterSnapshot: any = null;
          if (req.method !== 'DELETE' && finalEntityId) {
            afterSnapshot = getEntitySnapshot(entityType, finalEntityId);
          }

          // If afterSnapshot is still null for create, maybe use response body data
          if (!afterSnapshot && responseBody?.data && typeof responseBody.data === 'object') {
            afterSnapshot = responseBody.data;
          }

          // Resolve Ward
          const resolvedWard = resolveWardForEntity(entityType, finalEntityId, afterSnapshot || beforeSnapshot, req);

          // Build detail JSON
          const detail = JSON.stringify({
            method: req.method,
            path: req.originalUrl,
            params: req.params,
            query: req.query,
            body: req.body
          });

          const beforeDataStr = beforeSnapshot ? JSON.stringify(beforeSnapshot) : null;
          const afterDataStr = afterSnapshot ? JSON.stringify(afterSnapshot) : null;

          const stmt = db.prepare(`
            INSERT INTO audit_logs (userId, action, entityType, entityId, ward, beforeData, afterData, ipAddress, detail, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `);
          stmt.run(userId, action, entityType, finalEntityId, resolvedWard, beforeDataStr, afterDataStr, cleanIp, detail);
        } catch (err) {
          console.error('⚠️ Failed to write enhanced audit log:', err);
        }
      }
    });

    next();
  };
}
