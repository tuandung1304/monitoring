Hệ thống e2e để load-test sử dụng k6 với express và postgresql, đo hiệu năng thu thập logs/metrics và hiển thị dashboard sử dụng prometheus và grafana

- Express: cung cấp 1 số endpoint cơ bản
- Postgres: database cơ bản, dump vài triệu bản ghi trên 1 số bảng để backend truy vấn
- K6: viết baseline để fake lượng lớn request đến với toàn bộ endpoint, payload và status lỗi random một cách tự nhiên
- Prometheus/Grafana: thu thập các metrics cơ bản và phổ biến (best-practice) của cả db lẫn backend, hiện thị dashboard trực quan cho logs, metrics với utilization, percentile, 4xx logs, 5xx logs v.v

## Kiến trúc

| Service             | Vai trò                                                                 | Port |
| ------------------- | ----------------------------------------------------------------------- | ---- |
| `postgres`          | Database, tự migrate + seed dữ liệu khi khởi tạo lần đầu                | 5432 |
| `postgres-exporter` | Export metrics của Postgres cho Prometheus                              | 9187 |
| `backend`           | Express + TypeScript, expose REST API + `/metrics`                      | 4000 |
| `k6`                | Baseline load test, chỉ chạy khi được gọi tường minh (profile)          | -    |
| `prometheus`        | Scrape metrics từ backend, postgres-exporter, node-exporter             | 9090 |
| `node-exporter`     | Metrics hệ thống (CPU, memory, disk...)                                 | 9100 |
| `grafana`           | Dashboard, tự provision datasource + dashboard `E2E Load Test Overview` | 3000 |

## Chạy dự án

```bash
cp .env.example .env   # chỉnh sửa nếu cần, mặc định là creds dev
docker compose up -d --build
```

Lần khởi tạo đầu tiên, Postgres sẽ tự chạy các file trong `db/migrations/` (tạo schema + index) rồi `db/seed/` (seed ~50k users, 10k products, 1.5M orders, ~3.75M order_items) — quá trình seed mất vài phút. Theo dõi tiến trình bằng:

```bash
docker compose logs -f postgres
```

Sau khi mọi service healthy:

- Backend: http://localhost:4000 (thử `/health`, `/users`, `/products`, `/orders`, `/metrics`)
- Prometheus: http://localhost:9090/targets
- Grafana: http://localhost:3000 (mặc định `admin` / `admin`, xem dashboard **E2E Load Test Overview**)

## Chạy k6 baseline

`k6` được đặt trong Docker Compose profile `load-test` nên không tự chạy cùng `up -d`. Chạy thủ công:

```bash
docker compose run --rm k6
```

Script `k6/baseline.js` ramp VUs (0 → 20 → 50) trong ~6 phút, gọi ngẫu nhiên (có trọng số) vào toàn bộ endpoint của backend, thỉnh thoảng dùng id/payload không hợp lệ để tạo ra 4xx/5xx tự nhiên.

## Database

- `db/migrations/`: schema (`users`, `products`, `orders`, `order_items`) + index phục vụ các query của backend.
- `db/seed/`: seed dữ liệu tham chiếu (users/products) và dữ liệu quy mô lớn (orders/order_items) bằng SQL set-based, không cần tool ngoài.

Muốn seed lại từ đầu (xoá toàn bộ data):

```bash
docker compose down -v
docker compose up -d
```

## Backend

Các endpoint chính (xem `backend/src/routes/`):

- `GET /health` — kiểm tra kết nối DB
- `GET /users`, `GET /users/:id`
- `GET /products`, `GET /products/:id`
- `GET /orders`, `GET /orders/:id`, `POST /orders`
- `GET /metrics` — Prometheus exposition format (`http_requests_total`, `http_request_duration_seconds`, `db_query_duration_seconds`, default Node.js process metrics)
