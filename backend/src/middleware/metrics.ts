import { NextFunction, Request, Response } from 'express'
import { httpRequestDurationSeconds, httpRequestsTotal } from '../metrics'

function normalizeUnmatchedPath(path: string): string {
  return path
    .split('/')
    .map(segment => (/^\d+$/.test(segment) ? ':id' : segment))
    .join('/')
}

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const endTimer = httpRequestDurationSeconds.startTimer()

  res.on('finish', () => {
    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : normalizeUnmatchedPath(req.path)
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
