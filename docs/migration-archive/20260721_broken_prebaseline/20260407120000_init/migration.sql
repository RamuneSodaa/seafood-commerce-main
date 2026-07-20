-- Initial Phase 1 schema for seafood commerce core loop
CREATE TYPE fulfillment_type AS ENUM ('STORE_PICKUP', 'SHIPPING');
CREATE TYPE order_status AS ENUM (
  'PENDING_PAYMENT',
  'PAID_PENDING_PREP',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'PAID_PENDING_SHIPMENT',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'AFTER_SALES'
);

CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  supports_pickup BOOLEAN NOT NULL DEFAULT TRUE,
  supports_shipping BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE skus (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_cents INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE store_sku_availabilities (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  sku_id TEXT NOT NULL REFERENCES skus(id),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, sku_id)
);

CREATE TABLE inventories (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  sku_id TEXT NOT NULL REFERENCES skus(id),
  physical_stock INT NOT NULL,
  available_stock INT NOT NULL,
  reserved_stock INT NOT NULL,
  damaged_stock INT NOT NULL DEFAULT 0,
  safe_stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, sku_id)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id),
  fulfillment_type fulfillment_type NOT NULL,
  status order_status NOT NULL,
  total_amount_cents INT NOT NULL,
  pickup_date TIMESTAMP,
  pickup_time_slot TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  sku_id TEXT NOT NULL REFERENCES skus(id),
  quantity INT NOT NULL,
  unit_price_cents INT NOT NULL
);

CREATE TABLE order_shipping_address_snapshots (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL REFERENCES orders(id),
  receiver_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  detail TEXT NOT NULL,
  postal_code TEXT
);

CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL REFERENCES orders(id),
  courier_company TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE pickup_records (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL REFERENCES orders(id),
  pickup_code TEXT NOT NULL,
  picked_up_at TIMESTAMP,
  verified_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_records (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  payment_ref TEXT UNIQUE NOT NULL,
  paid_amount_cents INT NOT NULL,
  paid_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_logs (
  id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL REFERENCES inventories(id),
  order_id TEXT,
  action TEXT NOT NULL,
  delta_available INT NOT NULL,
  delta_reserved INT NOT NULL,
  delta_physical INT NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE order_status_logs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  from_status order_status,
  to_status order_status NOT NULL,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
