-- Где заказывать товар (видно только админам): продавец/павильон/ссылка в allall.
alter table products add column if not exists supplier text not null default '';

-- Новый товар: полупальто-тренч из драпа с поясом (allall, продавец «Хасан», 2-2-14, корпус А).
do $$
declare
  base text := 'https://yoshi960.github.io/looksy-store/seed/';
  c bigint;
begin
  if exists (select 1 from products where title = 'Полупальто-тренч из драпа с поясом') then return; end if;
  select id into c from categories where name = 'Тренчи и пальто' order by id limit 1;
  if c is null then
    insert into categories(name, grp, sort) values ('Тренчи и пальто', 'w', 4) returning id into c;
  end if;
  insert into products(category_id, title, description, price, old_price, cost, promo, sizes, colors, photos, sort, supplier) values
  (c, 'Полупальто-тренч из драпа с поясом',
   E'Короткое двубортное полупальто из драпа с воротником-стойкой и поясом. Новое, с биркой.\n\nПояс собирает силуэт по талии, объёмные рукава с хлястиками и погоны на плечах — образ выглядит дорого и собранно. Хорошо сочетается с широкими джинсами, брюками и юбкой миди.\n\nНа подкладке, утеплённое — на холодную осень и мягкую зиму. Сидит в размер.\n\nМатериал: драп. Производство: Китай.',
   4990, null, 2700, '', '42, 44, 46, 48', 'серый, чёрный, графит',
   jsonb_build_array(base||'drap_1.jpg', base||'drap_2.jpg', base||'drap_3.jpg', base||'drap_4.jpg'), 0,
   'allall · Хасан, 2-2-14, корпус А · 2700 ₽ штучно / 2600 ₽ от 3 шт');
end $$;
