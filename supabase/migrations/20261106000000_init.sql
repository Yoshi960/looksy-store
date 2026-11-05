-- LOOKSY STORE: схема базы. Доступ к таблицам только у серверной функции (service role), RLS без политик закрывает всё остальное.

create table if not exists categories (
  id bigserial primary key,
  name text not null,
  grp text not null default 'w',          -- w = Женщинам, m = Мужчинам
  sort int not null default 0
);

create table if not exists products (
  id bigserial primary key,
  category_id bigint references categories(id) on delete set null,
  title text not null,
  description text not null default '',
  price int not null,
  old_price int,
  cost int,                               -- закупка, видна только админам
  promo text not null default '',         -- hit | fast | margin
  sizes text not null default '',
  colors text not null default '',
  photos jsonb not null default '[]',
  in_stock boolean not null default true,
  sort int not null default 0,
  created_at bigint not null default extract(epoch from now())::bigint
);

create table if not exists orders (
  id bigserial primary key,
  product_id bigint,
  product_title text,
  price int,
  cost int,
  size text, color text,
  name text, phone text,
  contact text not null default 'tg',     -- tg | phone
  city text, comment text,
  user_id bigint, username text,
  source text,
  status text not null default 'new',     -- new | paid | sent | done | cancel
  created_at bigint not null default extract(epoch from now())::bigint
);

create table if not exists events (
  id bigserial primary key,
  type text not null,                     -- open | view | order_click | order
  product_id bigint,
  user_id bigint,
  source text,
  created_at bigint not null default extract(epoch from now())::bigint
);
create index if not exists events_type_time on events(type, created_at);

create table if not exists favorites (
  user_id bigint not null,
  product_id bigint not null references products(id) on delete cascade,
  created_at bigint not null default extract(epoch from now())::bigint,
  primary key (user_id, product_id)
);

create table if not exists reviews (
  id bigserial primary key,
  product_id bigint references products(id) on delete cascade,
  order_id bigint unique,
  user_id bigint,
  name text,
  rating int not null check (rating between 1 and 5),
  fit text,                               -- small | ok | big
  text text not null default '',
  photos jsonb not null default '[]',
  status text not null default 'pending', -- pending | ok | hidden
  created_at bigint not null default extract(epoch from now())::bigint
);

alter table categories enable row level security;
alter table products   enable row level security;
alter table orders     enable row level security;
alter table events     enable row level security;
alter table favorites  enable row level security;
alter table reviews    enable row level security;

-- хранилище фото: публичное чтение по ссылке, запись только через функцию
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- сводка отзывов по товарам
create or replace function review_summary()
returns table(product_id bigint, n bigint, avg numeric, small bigint, ok bigint, big bigint)
language sql stable as $$
  select product_id, count(*), round(avg(rating)::numeric, 1),
         count(*) filter (where fit = 'small'), count(*) filter (where fit = 'ok'), count(*) filter (where fit = 'big')
  from reviews where status = 'ok' group by product_id
$$;

-- статистика для админки
create or replace function shop_stats(since bigint)
returns json language sql stable as $$
  select json_build_object(
    'by_source', coalesce((
      select json_agg(s order by s.visitors desc) from (
        select coalesce(source, 'direct') as source,
               count(distinct coalesce(user_id, id)) filter (where type = 'open') as visitors,
               count(*) filter (where type = 'view') as views,
               count(*) filter (where type = 'order_click') as clicks,
               count(*) filter (where type = 'order') as orders
        from events where created_at >= since group by 1) s), '[]'::json),
    'by_product', coalesce((
      select json_agg(p order by p.views desc) from (
        select pr.id, pr.title, pr.price,
               count(e.id) filter (where e.type = 'view') as views,
               count(e.id) filter (where e.type = 'order_click') as clicks,
               count(e.id) filter (where e.type = 'order') as orders
        from products pr left join events e on e.product_id = pr.id and e.created_at >= since
        group by pr.id) p), '[]'::json),
    'paid_orders', (select count(*) from orders where created_at >= since and status in ('paid','sent','done')),
    'revenue', (select coalesce(sum(price), 0) from orders where created_at >= since and status in ('paid','sent','done')),
    'profit', (select coalesce(sum(price - cost), 0) from orders where created_at >= since and status in ('paid','sent','done') and cost is not null),
    'no_cost', (select count(*) from orders where created_at >= since and status in ('paid','sent','done') and cost is null)
  )
$$;

revoke execute on function shop_stats(bigint) from public, anon, authenticated;
revoke execute on function review_summary() from public, anon, authenticated;
