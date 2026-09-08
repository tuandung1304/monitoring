import { Request } from 'express'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

export function parsePagination(req: Request): {
  limit: number
  offset: number
  page: number
} {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT),
  )
  return { limit, offset: (page - 1) * limit, page }
}
