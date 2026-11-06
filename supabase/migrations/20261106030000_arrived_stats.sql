-- Статус «Прибыл в пункт выдачи» + напоминания, честная статистика.
alter table orders add column if not exists reminders int not null default 0;
alter table orders add column if not exists reminded_at bigint;

-- Статистика:
--  посетители — уникальные люди за период (а не сумма по источникам);
--  заказы — именно заказы (корзина из 3 вещей = 1 заказ), отменённые и удалённые не считаются;
--  «продано» по товару — штуки из оформленных заказов.
create or replace function shop_stats(since bigint)
returns json language sql stable as $$
  with ev as (select * from events where created_at >= since),
       ord as (select * from orders where created_at >= since and status <> 'cancel'),
       paid as (select * from ord where status in ('paid','sent','arrived','done')),
       sold as (
         select (i->>'product_id')::bigint as product_id, sum(coalesce((i->>'qty')::int, 1)) as qty
         from ord, jsonb_array_elements(ord.items) i group by 1)
  select json_build_object(
    'visitors', (select count(distinct coalesce(user_id::text, 'e' || id)) from ev where type = 'open'),
    'orders', (select count(*) from ord),
    'by_source', coalesce((
      select json_agg(s order by s.visitors desc, s.orders desc) from (
        select src as source,
               (select count(distinct coalesce(user_id::text, 'e' || id)) from ev where type = 'open' and coalesce(ev.source,'direct') = src) as visitors,
               (select count(*) from ev where type = 'order_click' and coalesce(ev.source,'direct') = src) as clicks,
               (select count(*) from ord where coalesce(ord.source,'direct') = src) as orders
        from (select distinct coalesce(source,'direct') as src from ev
              union select distinct coalesce(source,'direct') from ord) srcs) s), '[]'::json),
    'by_product', coalesce((
      select json_agg(p order by p.views desc, p.sold desc) from (
        select pr.id, pr.title, pr.price,
               (select count(*) from ev where type = 'view' and product_id = pr.id) as views,
               (select count(*) from ev where type = 'order_click' and product_id = pr.id) as clicks,
               coalesce((select qty from sold where product_id = pr.id), 0) as sold
        from products pr) p), '[]'::json),
    'paid_orders', (select count(*) from paid),
    'revenue', (select coalesce(sum(price), 0) from paid),
    'profit', (select coalesce(sum(price - cost), 0) from paid where cost is not null),
    'no_cost', (select count(*) from paid where cost is null)
  )
$$;
revoke execute on function shop_stats(bigint) from public, anon, authenticated;
