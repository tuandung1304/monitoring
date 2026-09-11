import { NextFunction, Request, Response } from 'express'

// Setting CHAOS_5XX_RATE (0-1)
// makes that fraction of requests fail with a random 5xx before hitting any
// route, so dashboards/alerts have real error traffic to show.
const CHAOS_5XX_RATE = Number(process.env.CHAOS_5XX_RATE ?? 0)
const CHAOS_STATUSES = [500, 502, 503]

export function chaosMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (CHAOS_5XX_RATE > 0 && Math.random() < CHAOS_5XX_RATE) {
    const status =
      CHAOS_STATUSES[Math.floor(Math.random() * CHAOS_STATUSES.length)]
    res.status(status).json({ error: 'injected chaos failure' })
    return
  }
  next()
}
