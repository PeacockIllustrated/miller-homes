-- Miller Homes Signage Portal -- Supabase Migration
-- This creates mh_ prefixed tables alongside the existing psp_ tables.
-- Both brands share the same Supabase project.
-- Run this in Supabase SQL Editor.

-- ============================================================
-- Orders table
-- ============================================================
create table if not exists mh_orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text unique not null,
  status        text not null default 'new' check (status in ('new','awaiting_po','in-progress','completed','cancelled')),
  contact_name  text not null,
  email         text not null,
  phone         text not null,
  site_name     text not null,
  site_address  text not null,
  po_number     text,
  notes         text,
  subtotal      numeric(10,2) not null,
  vat           numeric(10,2) not null,
  total         numeric(10,2) not null,
  contact_id    uuid,
  site_id       uuid,
  purchaser_name  text,
  purchaser_email text,
  purchaser_id    uuid,
  po_document_name text,
  dn_document_name text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- Order items table
-- ============================================================
create table if not exists mh_order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references mh_orders(id) on delete cascade,
  code        text not null,
  base_code   text,
  name        text not null,
  size        text,
  material    text,
  price       numeric(10,2) not null,
  quantity    integer not null check (quantity > 0),
  line_total  numeric(10,2) not null,
  custom_data jsonb default null
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_mh_orders_status on mh_orders(status);
create index if not exists idx_mh_orders_created_at on mh_orders(created_at desc);
create index if not exists idx_mh_order_items_order_id on mh_order_items(order_id);
create index if not exists idx_mh_order_items_code on mh_order_items(code);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
create or replace function mh_update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger mh_orders_updated_at
  before update on mh_orders
  for each row execute function mh_update_updated_at();

-- ============================================================
-- Row Level Security (service role has full access)
-- ============================================================
alter table mh_orders enable row level security;
alter table mh_order_items enable row level security;

create policy "service_mh_orders" on mh_orders for all using (true) with check (true);
create policy "service_mh_items" on mh_order_items for all using (true) with check (true);

-- ============================================================
-- Suggestions table
-- ============================================================
create table if not exists mh_suggestions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  message     text not null,
  status      text not null default 'new' check (status in ('new','noted','done','dismissed')),
  created_at  timestamptz default now()
);

create index if not exists idx_mh_suggestions_created_at on mh_suggestions(created_at desc);

alter table mh_suggestions enable row level security;
create policy "service_mh_suggestions" on mh_suggestions for all using (true) with check (true);

-- ============================================================
-- Contacts & Sites
-- ============================================================
create table if not exists mh_contacts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null unique,
  phone        text not null,
  created_at   timestamptz default now()
);

create table if not exists mh_sites (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  address      text not null,
  created_at   timestamptz default now()
);

alter table mh_contacts enable row level security;
alter table mh_sites enable row level security;
create policy "service_mh_contacts" on mh_contacts for all using (true) with check (true);
create policy "service_mh_sites" on mh_sites for all using (true) with check (true);

-- ============================================================
-- Purchasers
-- ============================================================
create table if not exists mh_purchasers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null unique,
  created_at   timestamptz default now()
);

alter table mh_purchasers enable row level security;
create policy "service_mh_purchasers" on mh_purchasers for all using (true) with check (true);

-- ============================================================
-- Foreign keys on orders (to contacts, sites, purchasers)
-- ============================================================
alter table mh_orders add constraint fk_mh_orders_contact_id foreign key (contact_id) references mh_contacts(id);
alter table mh_orders add constraint fk_mh_orders_site_id foreign key (site_id) references mh_sites(id);
alter table mh_orders add constraint fk_mh_orders_purchaser_id foreign key (purchaser_id) references mh_purchasers(id);

create index if not exists idx_mh_orders_contact_id on mh_orders(contact_id);
create index if not exists idx_mh_orders_site_id on mh_orders(site_id);
create index if not exists idx_mh_orders_purchaser_id on mh_orders(purchaser_id);
