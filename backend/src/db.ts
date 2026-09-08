import { Pool, QueryResultRow } from 'pg'
import { dbQueryDurationSeconds } from './metrics'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', err => {
  // eslint-disable-next-line no-console
  console.error('unexpected postgres pool error', err)
})

export async function timedQuery<T extends QueryResultRow>(
  queryName: string,
  text: string,
  params: readonly unknown[] = [],
) {
  const endTimer = dbQueryDurationSeconds.startTimer({ query_name: queryName })
  try {
    return await pool.query<T>(text, params as unknown[])
  } finally {
    endTimer()
  }
}
