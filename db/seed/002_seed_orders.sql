-- 002_seed_orders.sql
-- Seeds orders + order_items at multi-million-row scale so the backend has
-- realistic query volume/joins to serve during the k6 load test.
-- This step takes a few minutes on first container init.

INSERT INTO
    orders (
        user_id,
        status,
        total_amount,
        created_at
    )
SELECT (1 + floor(random() * 50000))::bigint, (
        ARRAY[
            'pending', 'paid', 'shipped', 'cancelled', 'refunded'
        ]
    ) [1 + floor(random() * 5)], 0, now() - (
        random() * interval '180 days'
    )
FROM generate_series(1, 1500000) AS gs;

-- 1-4 line items per order (item_num 1 always kept, 2-4 kept with decreasing
-- probability), each referencing a random product. Products are addressed
-- directly by id (instead of ORDER BY random()) to keep this a cheap
-- set-based insert instead of a per-order sort over the whole table.
--
-- MATERIALIZED forces the CTE to actually execute and store its rows before
-- the outer query filters/joins them. Without it, Postgres can prove that
-- nothing in the CROSS JOIN depends on the outer `orders` row, and reuses a
-- single evaluation of random() for every row instead of one per line item.
WITH
    item_candidates AS MATERIALIZED (
        SELECT
            o.id AS order_id,
            item_num,
            random() AS keep_roll,
            (1 + floor(random() * 10000))::bigint AS product_id,
            (1 + floor(random() * 5))::int AS quantity
        FROM orders o
            CROSS JOIN generate_series(1, 4) AS item_num
    )
INSERT INTO
    order_items (
        order_id,
        product_id,
        quantity,
        unit_price
    )
SELECT ic.order_id, ic.product_id, ic.quantity, pr.price
FROM
    item_candidates ic
    JOIN products pr ON pr.id = ic.product_id
WHERE
    ic.keep_roll < CASE ic.item_num
        WHEN 1 THEN 1.0
        WHEN 2 THEN 0.7
        WHEN 3 THEN 0.5
        WHEN 4 THEN 0.3
    END;

UPDATE orders o
SET
    total_amount = sub.total
FROM (
        SELECT order_id, SUM(quantity * unit_price) AS total
        FROM order_items
        GROUP BY
            order_id
    ) sub
WHERE
    o.id = sub.order_id;

ANALYZE orders;

ANALYZE order_items;