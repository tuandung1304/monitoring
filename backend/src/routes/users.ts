import { Router } from 'express'
import { timedQuery } from '../db'
import { parsePagination } from './pagination'

export const usersRouter = Router()

usersRouter.get('/users', async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req)
    const country =
      typeof req.query.country === 'string'
        ? req.query.country.toUpperCase()
        : null

    const result = country
      ? await timedQuery(
          'users.list.by_country',
          'SELECT id, email, full_name, country_code, is_active, created_at FROM users WHERE country_code = $1 ORDER BY id LIMIT $2 OFFSET $3',
          [country, limit, offset],
        )
      : await timedQuery(
          'users.list',
          'SELECT id, email, full_name, country_code, is_active, created_at FROM users ORDER BY id LIMIT $1 OFFSET $2',
          [limit, offset],
        )

    res.json({ page, limit, items: result.rows })
  } catch (err) {
    next(err)
  }
})

usersRouter.get('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'invalid user id' })
      return
    }

    const result = await timedQuery(
      'users.get',
      'SELECT * FROM users WHERE id = $1',
      [id],
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'user not found' })
      return
    }

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})
