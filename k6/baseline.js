import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://backend:4000'

export const clientErrors = new Counter('client_errors')
export const serverErrors = new Counter('server_errors')

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
  },
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)]
}

const STATUSES = ['pending', 'paid', 'shipped', 'cancelled', 'refunded']
const CATEGORIES = [
  'electronics',
  'books',
  'clothing',
  'home',
  'sports',
  'toys',
  'beauty',
  'grocery',
]

// Weighted endpoint mix, roughly modelled on a typical read-heavy API.
const ENDPOINTS = [
  { weight: 20, fn: listUsers },
  { weight: 15, fn: getUser },
  { weight: 20, fn: listProducts },
  { weight: 15, fn: getProduct },
  { weight: 15, fn: listOrders },
  { weight: 10, fn: getOrder },
  { weight: 5, fn: createOrder },
]

function pickWeighted() {
  const total = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0)
  let roll = Math.random() * total
  for (const entry of ENDPOINTS) {
    if (roll < entry.weight) return entry.fn
    roll -= entry.weight
  }
  return ENDPOINTS[0].fn
}

function record(res) {
  check(res, { 'status is not 5xx': r => r.status < 500 })
  if (res.status >= 400 && res.status < 500) clientErrors.add(1)
  if (res.status >= 500) serverErrors.add(1)
}

// ~90% of ids are in-range; the rest are deliberately out-of-range / invalid
// so the backend naturally produces a realistic mix of 400s and 404s.
function randomUserId() {
  return Math.random() < 0.9
    ? randomInt(1, 50000)
    : pick([0, -1, 999999999, 'abc'])
}

function randomProductId() {
  return Math.random() < 0.9
    ? randomInt(1, 10000)
    : pick([0, -1, 999999999, 'abc'])
}

function randomOrderId() {
  return Math.random() < 0.9
    ? randomInt(1, 1500000)
    : pick([0, -1, 999999999, 'abc'])
}

function listUsers() {
  const params =
    Math.random() < 0.3
      ? `?country=${pick(['US', 'VN', 'GB', 'ZZ'])}`
      : `?page=${randomInt(1, 50)}`
  record(http.get(`${BASE_URL}/users${params}`))
}

function getUser() {
  record(http.get(`${BASE_URL}/users/${randomUserId()}`))
}

function listProducts() {
  const params =
    Math.random() < 0.3
      ? `?category=${pick(CATEGORIES)}`
      : `?page=${randomInt(1, 50)}`
  record(http.get(`${BASE_URL}/products${params}`))
}

function getProduct() {
  record(http.get(`${BASE_URL}/products/${randomProductId()}`))
}

function listOrders() {
  const params =
    Math.random() < 0.3
      ? `?status=${pick(STATUSES)}`
      : `?user_id=${randomInt(1, 50000)}`
  record(http.get(`${BASE_URL}/orders${params}`))
}

function getOrder() {
  record(http.get(`${BASE_URL}/orders/${randomOrderId()}`))
}

function createOrder() {
  // Occasionally send a malformed/invalid payload to naturally trigger 400s/404s.
  const bad = Math.random() < 0.15
  const payload = bad
    ? pick([
        JSON.stringify({
          user_id: 'not-a-number',
          items: [{ product_id: 1, quantity: 1 }],
        }),
        JSON.stringify({ user_id: randomInt(1, 50000), items: [] }),
        JSON.stringify({
          user_id: 999999999,
          items: [{ product_id: 1, quantity: 1 }],
        }),
        JSON.stringify({
          user_id: randomInt(1, 50000),
          items: [{ product_id: 999999999, quantity: 1 }],
        }),
      ])
    : JSON.stringify({
        user_id: randomInt(1, 50000),
        items: Array.from({ length: randomInt(1, 3) }, () => ({
          product_id: randomInt(1, 10000),
          quantity: randomInt(1, 5),
        })),
      })

  record(
    http.post(`${BASE_URL}/orders`, payload, {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

export default function baseline() {
  pickWeighted()()
  sleep(Math.random() * 1.5)
}
