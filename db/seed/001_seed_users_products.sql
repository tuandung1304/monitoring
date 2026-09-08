-- 001_seed_users_products.sql
-- Seeds base reference data. Runs once, on first container init.

INSERT INTO
    users (
        email,
        full_name,
        country_code,
        is_active,
        created_at
    )
SELECT 'user' || gs || '@example.com', 'User ' || gs, (
        ARRAY[
            'US', 'VN', 'GB', 'DE', 'FR', 'JP', 'SG', 'AU', 'CA', 'BR'
        ]
    ) [1 + floor(random() * 10)], (random() > 0.05), now() - (
        random() * interval '365 days'
    )
FROM generate_series(1, 50000) AS gs;

INSERT INTO
    products (
        sku,
        name,
        category,
        price,
        stock,
        created_at
    )
SELECT 'SKU-' || lpad(gs::text, 7, '0'), 'Product ' || gs, (
        ARRAY[
            'electronics', 'books', 'clothing', 'home', 'sports', 'toys', 'beauty', 'grocery'
        ]
    ) [1 + floor(random() * 8)], round(
        (random() * 490 + 10)::numeric, 2
    ), floor(random() * 1000), now() - (
        random() * interval '365 days'
    )
FROM generate_series(1, 10000) AS gs;

ANALYZE users;

ANALYZE products;