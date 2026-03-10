-- ================================================
-- SubTrackr Database Schema v1.2
-- Changes from v1.1:
--   - notifications.digest_pending column added
--   - users.email_notifications default → FALSE
-- ================================================
DROP TABLE IF EXISTS spending_snapshots CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS price_trackers CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
-- ── USERS ────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    plan VARCHAR(20) NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PREMIUM')),
    fcm_token VARCHAR(500),
    email_notifications BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    -- ← changed from TRUE
    total_subscriptions_created INTEGER NOT NULL DEFAULT 0,
    total_trackers_created INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
-- ── SUBSCRIPTIONS ────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY' CHECK (billing_cycle IN ('WEEKLY', 'MONTHLY', 'YEARLY')),
    next_billing DATE NOT NULL,
    category VARCHAR(100),
    color VARCHAR(7) DEFAULT '#6366F1',
    icon_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
-- ── PRICE TRACKERS ───────────────────────────────────────────────────────
CREATE TABLE price_trackers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    affiliate_url TEXT,
    product_name VARCHAR(500),
    target_price DECIMAL(10, 2) NOT NULL,
    current_price DECIMAL(10, 2),
    lowest_price DECIMAL(10, 2),
    highest_price DECIMAL(10, 2),
    shop_name VARCHAR(255),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
-- ── PRICE HISTORY ────────────────────────────────────────────────────────
CREATE TABLE price_history (
    id BIGSERIAL PRIMARY KEY,
    tracker_id BIGINT NOT NULL REFERENCES price_trackers(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);
-- ── NOTIFICATIONS ────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(50) CHECK (
        type IN (
            'PRICE_DROP',
            'BILLING_REMINDER',
            'DUPLICATE_ALERT',
            'SAVING_REPORT'
        )
    ),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    digest_pending BOOLEAN NOT NULL DEFAULT FALSE,
    -- ← new column
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
-- ── REFRESH TOKENS ───────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
-- ── SPENDING SNAPSHOTS ───────────────────────────────────────────────────
CREATE TABLE spending_snapshots (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INT NOT NULL,
    month INT NOT NULL CHECK (
        month BETWEEN 1 AND 12
    ),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, year, month)
);
-- ── INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing);
CREATE INDEX idx_subscriptions_active ON subscriptions(user_id, is_active);
CREATE INDEX idx_subscriptions_paused ON subscriptions(user_id, is_paused);
CREATE INDEX idx_price_trackers_user_id ON price_trackers(user_id);
CREATE INDEX idx_price_trackers_active ON price_trackers(is_active);
CREATE INDEX idx_price_history_tracker_id ON price_history(tracker_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_digest ON notifications(digest_pending)
WHERE digest_pending = TRUE;
-- partial index — fast for digest job
CREATE INDEX idx_snapshots_user ON spending_snapshots(user_id);
CREATE INDEX idx_snapshots_month ON spending_snapshots(user_id, year, month);
CREATE INDEX idx_users_stripe ON users(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;
-- ── VERIFY ───────────────────────────────────────────────────────────────
SELECT t.table_name,
    COUNT(c.column_name) AS columns,
    STRING_AGG(
        c.column_name,
        ', '
        ORDER BY c.ordinal_position
    ) AS column_list
FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;