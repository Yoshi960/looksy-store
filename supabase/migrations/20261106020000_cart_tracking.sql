-- Корзина и отслеживание: заказ из нескольких вещей, перевозчик и трек-номер.
alter table orders add column if not exists items jsonb not null default '[]';   -- [{product_id,title,price,cost,size,color,qty,photo}]
alter table orders add column if not exists carrier text;                          -- cdek | post | other
alter table orders add column if not exists track text;
alter table orders add column if not exists updated_at bigint;

-- старые заказы из одной вещи → в формат позиций
update orders set items = jsonb_build_array(jsonb_build_object(
  'product_id', product_id, 'title', product_title, 'price', price, 'cost', cost,
  'size', size, 'color', color, 'qty', 1, 'photo', null))
where items = '[]'::jsonb and product_id is not null;

-- отзыв теперь на каждую вещь в заказе
alter table reviews drop constraint if exists reviews_order_id_key;
create unique index if not exists reviews_order_product on reviews(order_id, product_id);
