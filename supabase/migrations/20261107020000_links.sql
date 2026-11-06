-- Ссылки с метками (UTM) для каналов: TikTok-аккаунты, Instagram, VK, Авито и т.д.
create table if not exists links (
  id bigserial primary key,
  code text not null unique,
  title text not null default '',
  created_at bigint not null default extract(epoch from now())::bigint
);
alter table links enable row level security;
create index if not exists events_source_time on events(source, created_at);
create index if not exists orders_source on orders(source);

-- Воронка по каждому источнику за период:
-- переходы в бота (/start) → открыли магазин → смотрели товары → в корзину → заказы → оплачено → выручка/прибыль.
create or replace function link_stats(since bigint)
returns json language sql stable as $$
  with ev as (select coalesce(source,'direct') as src, * from events where created_at >= since),
       ord as (select coalesce(source,'direct') as src, * from orders where created_at >= since and status <> 'cancel'),
       srcs as (select code as src from links union select src from ev union select src from ord)
  select coalesce(json_agg(r order by r.is_link desc, r.visitors desc, r.starts desc), '[]'::json) from (
    select s.src as code,
           l.id, l.title, l.created_at, (l.id is not null) as is_link,
           (select count(distinct coalesce(user_id::text, 'e' || id)) from ev where ev.src = s.src and type = 'start') as starts,
           (select count(distinct coalesce(user_id::text, 'e' || id)) from ev where ev.src = s.src and type = 'open') as visitors,
           (select count(*) from ev where ev.src = s.src and type = 'view') as views,
           (select count(*) from ev where ev.src = s.src and type = 'order_click') as carts,
           (select count(*) from ord where ord.src = s.src) as orders,
           (select count(*) from ord where ord.src = s.src and status in ('paid','sent','arrived','done')) as paid,
           (select coalesce(sum(price),0) from ord where ord.src = s.src and status in ('paid','sent','arrived','done')) as revenue,
           (select coalesce(sum(price - cost),0) from ord where ord.src = s.src and status in ('paid','sent','arrived','done') and cost is not null) as profit
    from srcs s left join links l on l.code = s.src) r
$$;
revoke execute on function link_stats(bigint) from public, anon, authenticated;
