-- SellAI schema. The app also creates these tables automatically on first start;
-- run this in the Supabase SQL editor if you prefer to create them yourself.

create table if not exists products (
  id text primary key,
  name text not null,
  description text not null default '',
  category text not null default '',
  tags text[] not null default '{}',
  image_url text,
  image_is_ai_enhanced boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists variants (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  label text not null,
  price_naira integer not null check (price_naira > 0),
  stock integer not null default 0 check (stock >= 0),
  position integer not null default 0
);
create index if not exists variants_product_idx on variants(product_id);

create table if not exists posts (
  id text primary key,
  channel text not null,
  caption text not null default '',
  product_ids text[] not null default '{}',
  posted_at timestamptz not null default now()
);

-- Every comment, DM and voice note. Triage, draft and reply state live on the row.
create table if not exists enquiries (
  id text primary key,
  channel text not null,
  text text not null,
  author_handle text,
  author_name text,
  post_id text,
  received_at timestamptz not null default now(),
  transcribed_from_voice boolean not null default false,
  intent text,
  language text,
  english_gloss text,
  confidence real,
  priority integer not null default 0,
  status text not null default 'new',
  draft_reply text,
  draft_meta jsonb,
  reply_text text,
  replied_at timestamptz,
  order_ref text,
  is_demo boolean not null default false
);
create index if not exists enquiries_received_idx on enquiries(received_at desc);
create index if not exists enquiries_post_idx on enquiries(post_id);

create table if not exists orders (
  ref text primary key,
  product_id text not null,
  variant_id text not null,
  quantity integer not null check (quantity > 0),
  unit_price_naira integer not null,
  delivery_fee_naira integer not null default 0,
  total_naira integer not null,
  city text,
  customer_handle text,
  channel text not null,
  source_post_id text,
  source_enquiry_id text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  link_clicks integer not null default 0,
  first_clicked_at timestamptz,
  confirmed_at timestamptz,
  paid_at timestamptz,
  is_demo boolean not null default false
);
create index if not exists orders_post_idx on orders(source_post_id);

-- Columns added after the first release (safe to run on existing databases).
alter table enquiries add column if not exists auto_sent boolean not null default false;
alter table orders add column if not exists discount_naira integer not null default 0;
alter table orders add column if not exists reward_code text;
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists origin_handle text;
create index if not exists orders_customer_idx on orders(customer_handle);

-- Loyalty rewards a vendor gives a customer. Applied automatically by the sales agent on the customer's next order.
create table if not exists rewards (
  code text primary key,
  customer_handle text not null,
  customer_name text,
  kind text not null check (kind in ('percent_off','amount_off','free_delivery','gift')),
  value integer not null default 0,
  gift_variant_id text,
  reason text,
  message text,
  status text not null default 'issued' check (status in ('issued','redeemed','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_order_ref text,
  sent_via text
);
create index if not exists rewards_customer_idx on rewards(customer_handle);

-- Seller logins: a one-time code the seller sends from their own WhatsApp (see src/auth/login.ts).
create table if not exists login_challenges (
  id text primary key,
  phone text not null,
  code text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz,
  claimed_at timestamptz
);
create index if not exists login_challenges_phone_idx on login_challenges(phone, created_at desc);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
