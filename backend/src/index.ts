import express, { NextFunction, Request, Response } from 'express'
import { metricsMiddleware } from './middleware/metrics'
import { chaosMiddleware } from './middleware/chaos'
import { register } from './metrics'
import { healthRouter } from './routes/health'
import { usersRouter } from './routes/users'
import { productsRouter } from './routes/products'
import { ordersRouter } from './routes/orders'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(express.json())
app.use(metricsMiddleware)

app.use(healthRouter)

app.use(chaosMiddleware)
app.use(usersRouter)
app.use(productsRouter)
app.use(ordersRouter)

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err)
  res.status(500).json({ error: 'internal server error' })
})

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`backend listening on :${port}`)
})
