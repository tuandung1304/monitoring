import { NextFunction, Request, Response } from 'express'
import { httpRequestDurationSeconds, httpRequestsTotal } from '../metrics'

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const endTimer = httpRequestDurationSeconds.startTimer()

  res.on('finish', () => {
    // req.route is only set once Express has matched a route, so this also
    // covers 404s (falls back to the raw path) without exploding cardinality
    // on truly unmatched paths thanks to the catch-all 404 handler.
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    }

    endTimer(labels)
    httpRequestsTotal.inc(labels)
  })

  next()
}
