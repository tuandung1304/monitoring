import { Router } from 'express'
import { timedQuery } from '../db'
import { parsePagination } from './pagination'

export const productsRouter = Router()

productsRouter.get('/products', async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req)
    const category =
      typeof req.query.category === 'string' ? req.query.category : null

    const result = category
      ? await timedQuery(
          'products.list.by_category',
          'SELECT id, sku, name, category, price, stock FROM products WHERE category = $1 ORDER BY id LIMIT $2 OFFSET $3',
          [category, limit, offset],
        )
      : await timedQuery(
          'products.list',
          'SELECT id, sku, name, category, price, stock FROM products ORDER BY id LIMIT $1 OFFSET $2',
          [limit, offset],
        )

    res.json({ page, limit, items: result.rows })
  } catch (err) {
    next(err)
  }
})

productsRouter.get('/products/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'invalid product id' })
      return
    }

    const result = await timedQuery(
      'products.get',
      'SELECT * FROM products WHERE id = $1',
      [id],
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'product not found' })
      return
    }

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})
