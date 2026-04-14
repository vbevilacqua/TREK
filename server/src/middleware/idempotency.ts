import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface IdempotencyRow {
  status_code: number;
  response_body: string;
}

/**
 * Called from within `authenticate` after req.user is set.
 *
 * For mutating requests carrying X-Idempotency-Key:
 * - If (key, userId) already stored: replays the cached response.
 * - Otherwise: wraps res.json to capture and store a successful response.
 *
 * Storing happens in idempotency_keys (24h TTL, cleaned by scheduler).
 */
export function applyIdempotency(req: Request, res: Response, next: NextFunction, userId: number): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const key = req.headers['x-idempotency-key'] as string | undefined;
  if (!key) {
    next();
    return;
  }

  // Return cached response if key already processed for this user
  const existing = db.prepare(
    'SELECT status_code, response_body FROM idempotency_keys WHERE key = ? AND user_id = ?'
  ).get(key, userId) as IdempotencyRow | undefined;

  if (existing) {
    res.status(existing.status_code).json(JSON.parse(existing.response_body));
    return;
  }

  // Wrap res.json to capture the response on first successful execution
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown): Response {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        db.prepare(
          `INSERT OR IGNORE INTO idempotency_keys (key, user_id, method, path, status_code, response_body, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(key, userId, req.method, req.path, res.statusCode, JSON.stringify(body), Math.floor(Date.now() / 1000));
      } catch {
        // Non-fatal: if storage fails, the request still succeeds
      }
    }
    return originalJson(body);
  };

  next();
}
