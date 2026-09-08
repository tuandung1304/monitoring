-- 002_indexes.sql
-- Indexes matching the access patterns used by the Express endpoints and k6 baseline.

CREATE INDEX IF NOT EXISTS idx_users_country_code ON users (country_code);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);