-- =====================================================================
-- CB Stars — database setup
-- Run this whole file once in Supabase > SQL Editor > New query.
-- It is safe to re-run, and it upgrades an existing HJZ database
-- (products / orders / chat keep their data).
-- =====================================================================

create extension if not exists "pgcrypto";

-- 1. SITE SETTINGS -------------------------------------------------------
-- key/value store: Facebook Pixel id, low-stock threshold, etc.
create table if not exists site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into site_settings (key, value) values
  ('low_stock_threshold', '3'),
  ('auto_decrement_stock', 'true')
on conflict (key) do nothing;

-- 2. ADMIN ACCOUNTS + PERMISSIONS ------------------------------------------
-- One row per person allowed into /admin. Logins live in Supabase Auth;
-- this table says who they are and what they may touch.

create table if not exists admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('owner', 'staff')),
  permissions text[] not null default '{}',  -- products | stock | orders | analytics | chat | settings
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table admin_profiles enable row level security;

create or replace function public.has_perm(p text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_profiles
    where user_id = auth.uid()
      and active
      and (role = 'owner' or p = any(permissions))
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_profiles where user_id = auth.uid() and active
  );
$$;

-- True until the first owner exists (drives the "create owner account" screen).
create or replace function public.needs_setup()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select not exists (select 1 from admin_profiles where role = 'owner');
$$;

grant execute on function public.has_perm(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.needs_setup() to anon, authenticated;

drop policy if exists "Read own profile or team" on admin_profiles;
create policy "Read own profile or team"
  on admin_profiles for select
  using (user_id = auth.uid() or has_perm('team'));
-- Inserts/updates/deletes happen only through the server (service role).

-- 3. PRODUCTS ----------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null,
  category text not null default 'other',
  has_size boolean not null default false,
  sizes text[] not null default '{}',
  images text[] not null default '{}',
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

alter table products add column if not exists stock integer not null default 0;
-- When false, the product has no stock number: it is never "sold out", never
-- triggers low-stock alerts, and accepting an order does not touch its quantity.
alter table products add column if not exists track_stock boolean not null default true;
alter table products add column if not exists category text not null default 'other';
-- Colours offered for the product, stored as hex codes, e.g. {#111111,#6e1423}
alter table products add column if not exists colors text[] not null default '{}';
-- Longer free-text description shown on the product page.
alter table products add column if not exists description text not null default '';

alter table products enable row level security;

drop policy if exists "Public can read products" on products;
drop policy if exists "Public can manage products" on products;
drop policy if exists "Admins read products" on products;
drop policy if exists "Products insert" on products;
drop policy if exists "Products update" on products;
drop policy if exists "Products delete" on products;

create policy "Admins read products" on products for select
  using (is_admin());
create policy "Products insert" on products for insert
  with check (has_perm('products'));
create policy "Products update" on products for update
  using (has_perm('products') or has_perm('stock'))
  with check (has_perm('products') or has_perm('stock'));
create policy "Products delete" on products for delete
  using (has_perm('products'));

-- Someone with only the "stock" permission may change the stock number and
-- nothing else on a product.
create or replace function public.products_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;  -- SQL editor / service role
  if not has_perm('products')
     and (to_jsonb(new) - 'stock') is distinct from (to_jsonb(old) - 'stock') then
    raise exception 'The stock permission only allows changing the stock quantity.';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_trg on products;
create trigger products_guard_trg before update on products
  for each row execute function public.products_guard();

-- The storefront reads this view, so the real stock number never leaves the
-- database: visitors only get a sold_out flag.
create or replace view products_public as
  select
    id, name, price, category, has_size, sizes, images, created_at,
    (track_stock and stock <= 0) as sold_out,
    colors, description
  from products;

grant select on products_public to anon, authenticated;

-- 4. ORDERS ---------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  wilaya text not null,
  size text,
  status text not null default 'new', -- new | contacted | confirmed (accepted) | cancelled (refused)
  created_at timestamptz not null default now()
);

alter table orders add column if not exists color text;
alter table orders add column if not exists unit_price numeric(10, 2);
alter table orders add column if not exists commune text;

alter table orders enable row level security;

drop policy if exists "Public can create orders" on orders;
drop policy if exists "Public can read and update orders" on orders;
drop policy if exists "Public can update orders" on orders;
drop policy if exists "Admins read orders" on orders;
drop policy if exists "Admins update orders" on orders;

create policy "Public can create orders" on orders for insert
  with check (status = 'new');
create policy "Admins read orders" on orders for select
  using (has_perm('orders') or has_perm('analytics'));
create policy "Admins update orders" on orders for update
  using (has_perm('orders')) with check (has_perm('orders'));

-- Price is copied from the product at order time (trusted, not sent by the browser),
-- so revenue statistics stay correct if the price changes later.
create or replace function public.orders_set_price()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  select price into new.unit_price from products where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists orders_set_price_trg on orders;
create trigger orders_set_price_trg before insert on orders
  for each row execute function public.orders_set_price();

-- Accepting an order takes one piece out of stock; un-accepting puts it back.
-- Turn it off with the "auto_decrement_stock" setting (Stock page).
create or replace function public.orders_stock_sync()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  auto_on boolean;
begin
  select coalesce((select value from site_settings where key = 'auto_decrement_stock'), 'true') = 'true'
    into auto_on;
  if not auto_on or new.product_id is null then return new; end if;

  -- Products with stock tracking switched off keep no quantity.
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    update products set stock = greatest(stock - 1, 0) where id = new.product_id and track_stock;
  elsif old.status = 'confirmed' and new.status is distinct from 'confirmed' then
    update products set stock = stock + 1 where id = new.product_id and track_stock;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_stock_sync_trg on orders;
create trigger orders_stock_sync_trg after update of status on orders
  for each row execute function public.orders_stock_sync();

-- 5. SETTINGS POLICIES ----------------------------------------------------------
alter table site_settings enable row level security;

drop policy if exists "Read settings" on site_settings;
drop policy if exists "Write pixel setting" on site_settings;
drop policy if exists "Write stock settings" on site_settings;
drop policy if exists "Update pixel setting" on site_settings;
drop policy if exists "Update stock settings" on site_settings;

-- Visitors need the pixel id; everything else is for admins only.
create policy "Read settings" on site_settings for select
  using (key = 'fb_pixel_id' or is_admin());

create policy "Write pixel setting" on site_settings for insert
  with check (key = 'fb_pixel_id' and has_perm('settings'));
create policy "Update pixel setting" on site_settings for update
  using (key = 'fb_pixel_id' and has_perm('settings'))
  with check (key = 'fb_pixel_id' and has_perm('settings'));

create policy "Write stock settings" on site_settings for insert
  with check (key in ('low_stock_threshold', 'auto_decrement_stock') and has_perm('stock'));
create policy "Update stock settings" on site_settings for update
  using (key in ('low_stock_threshold', 'auto_decrement_stock') and has_perm('stock'))
  with check (key in ('low_stock_threshold', 'auto_decrement_stock') and has_perm('stock'));

-- 6. AI PROVIDER KEYS --------------------------------------------------------------
-- No policies on purpose: the browser can never read this table. Only the
-- server functions (service role) touch it.
create table if not exists ai_keys (
  provider text primary key,
  api_key text not null,
  updated_at timestamptz not null default now()
);
alter table ai_keys enable row level security;
revoke all on ai_keys from anon, authenticated;

-- 7. SUPPORT CHAT ---------------------------------------------------------------
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  sender text not null check (sender in ('client', 'admin')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;

drop policy if exists "Public can read chat" on chat_messages;
drop policy if exists "Public can send chat" on chat_messages;
drop policy if exists "Clients send chat" on chat_messages;
drop policy if exists "Admins send chat" on chat_messages;

create policy "Public can read chat" on chat_messages for select using (true);
create policy "Clients send chat" on chat_messages for insert
  with check (sender = 'client');
create policy "Admins send chat" on chat_messages for insert
  with check (sender = 'admin' and has_perm('chat'));

do $$
begin
  alter publication supabase_realtime add table chat_messages;
exception when duplicate_object then null;
end $$;

-- 8. STORAGE BUCKET FOR PRODUCT PHOTOS ---------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view product images" on storage.objects;
drop policy if exists "Public can upload product images" on storage.objects;
drop policy if exists "Public can delete product images" on storage.objects;
drop policy if exists "Admins upload product images" on storage.objects;
drop policy if exists "Admins delete product images" on storage.objects;

create policy "Public can view product images" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "Admins upload product images" on storage.objects for insert
  with check (bucket_id = 'product-images' and has_perm('products'));
create policy "Admins delete product images" on storage.objects for delete
  using (bucket_id = 'product-images' and has_perm('products'));
