import { Router } from 'express'
import { pool, timedQuery } from '../db'
import { parsePagination } from './pagination'

export const ordersRouter = Router()

const VALID_STATUSES = new Set([
  'pending',
  'paid',
  'shipped',
  'cancelled',
  'refunded',
])

ordersRouter.get('/orders', async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req)
    const userId =
      req.query.user_id !== undefined ? Number(req.query.user_id) : null
    const status =
      typeof req.query.status === 'string' ? req.query.status : null

    if (userId !== null && (!Number.isInteger(userId) || userId <= 0)) {
      res.status(400).json({ error: 'invalid user_id' })
      return
    }
    if (status !== null && !VALID_STATUSES.has(status)) {
      res
        .status(400)
        .json({
          error: `invalid status, expected one of ${[...VALID_STATUSES].join(', ')}`,
        })
      return
    }

    const conditions: string[] = []
    const params: unknown[] = []
    if (userId !== null) {
      params.push(userId)
      conditions.push(`user_id = $${params.length}`)
    }
    if (status !== null) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }
    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    params.push(limit, offset)
    const result = await timedQuery(
      'orders.list',
      `SELECT id, user_id, status, total_amount, created_at FROM orders ${where} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    res.json({ page, limit, items: result.rows })
  } catch (err) {
    next(err)
  }
})

ordersRouter.get('/orders/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'invalid order id' })
      return
    }

    const orderResult = await timedQuery(
      'orders.get',
      'SELECT * FROM orders WHERE id = $1',
      [id],
    )
    if (orderResult.rows.length === 0) {
      res.status(404).json({ error: 'order not found' })
      return
    }

    const itemsResult = await timedQuery(
      'orders.get.items',
      `SELECT oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id],
    )

    res.json({ ...orderResult.rows[0], items: itemsResult.rows })
  } catch (err) {
    next(err)
  }
})

interface CreateOrderItem {
  product_id: number
  quantity: number
}

ordersRouter.post('/orders', async (req, res, next) => {
  const { user_id: userId, items } = req.body as {
    user_id?: unknown
    items?: unknown
  }

  if (!Number.isInteger(userId) || (userId as number) <= 0) {
    res.status(400).json({ error: 'user_id must be a positive integer' })
    return
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items must be a non-empty array' })
    return
  }
  const parsedItems: CreateOrderItem[] = []
  for (const item of items as unknown[]) {
    const candidate = item as { product_id?: unknown; quantity?: unknown }
    if (
      !Number.isInteger(candidate.product_id) ||
      !Number.isInteger(candidate.quantity) ||
      (candidate.quantity as number) <= 0
    ) {
      res
        .status(400)
        .json({
          error:
            'each item requires a positive integer product_id and quantity',
        })
      return
    }
    parsedItems.push({
      product_id: candidate.product_id as number,
      quantity: candidate.quantity as number,
    })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const userExists = await client.query('SELECT 1 FROM users WHERE id = $1', [
      userId,
    ])
    if (userExists.rows.length === 0) {
      await client.query('ROLLBACK')
      res.status(404).json({ error: 'user not found' })
      return
    }

    const productIds = parsedItems.map(item => item.product_id)
    const productsResult = await client.query(
      'SELECT id, price FROM products WHERE id = ANY($1::bigint[])',
      [productIds],
    )
    const priceByProductId = new Map<number, number>(
      productsResult.rows.map(row => [Number(row.id), Number(row.price)]),
    )

    const missingProductId = productIds.find(id => !priceByProductId.has(id))
    if (missingProductId !== undefined) {
      await client.query('ROLLBACK')
      res.status(404).json({ error: `product ${missingProductId} not found` })
      return
    }

    const totalAmount = parsedItems.reduce(
      (sum, item) =>
        sum + priceByProductId.get(item.product_id)! * item.quantity,
      0,
    )

    const orderResult = await client.query(
      'INSERT INTO orders (user_id, status, total_amount) VALUES ($1, $2, $3) RETURNING *',
      [userId, 'pending', totalAmount],
    )
    const orderId = orderResult.rows[0].id

    for (const item of parsedItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [
          orderId,
          item.product_id,
          item.quantity,
          priceByProductId.get(item.product_id),
        ],
      )
    }

    await client.query('COMMIT')
    res.status(201).json(orderResult.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})
