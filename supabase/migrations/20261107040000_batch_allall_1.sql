-- Партия товаров с allall (Садовод).
do $$
declare
  base text := 'https://yoshi960.github.io/looksy-store/seed/';
  c_fur bigint; c_sheep bigint;
begin
  if exists (select 1 from products where title = 'Шуба с капюшоном и поясом, эко-норка') then return; end if;
  select id into c_fur from categories where name = 'Шубы' order by id limit 1;
  if c_fur is null then insert into categories(name, grp, sort) values ('Шубы','w',1) returning id into c_fur; end if;
  select id into c_sheep from categories where name = 'Дублёнки' order by id limit 1;
  if c_sheep is null then insert into categories(name, grp, sort) values ('Дублёнки','w',2) returning id into c_sheep; end if;

  insert into products(category_id, title, description, price, old_price, cost, promo, sizes, colors, photos, sort, supplier) values
  (c_fur, 'Шуба с капюшоном и поясом, эко-норка',
   E'Шуба из искусственного меха под норку с большим капюшоном и поясом. Новая, с биркой.\n\nГустой мягкий мех, объёмный капюшон-воротник и пояс по талии — тепло и женственно. Длина 75 см, закрывает бёдра.\n\nЕсть большие размеры — до 54.\n\nМатериал: искусственный мех (эко-норка). Производство: Корея.',
   5490, null, 2500, 'hit', '42, 44, 46, 48, 50, 52, 54', 'молочный, чёрный, шоколад, дымчатый', jsonb_build_array(base||'kap_1.jpg', base||'kap_2.jpg', base||'kap_3.jpg', base||'kap_4.jpg', base||'kap_5.jpg', base||'kap_6.jpg', base||'kap_7.jpg', base||'kap_8.jpg', base||'kap_9.jpg'), 0,
   'allall · продавец «Исо», 24-30 · 2500 ₽ штучно / 2300 ₽ опт'),

  (c_sheep, 'Дублёнка-косуха чёрная с мехом',
   E'Укороченная дублёнка-косуха оверсайз. Новая, с биркой.\n\nБольшой меховой воротник, мех на манжетах и по низу, косая молния, карманы на молниях и пояс с пряжкой. Свободный крой — надевается на свитер.\n\nДва варианта: чёрная с чёрным мехом или чёрная с белым мехом.\n\nМатериал: экокожа, искусственный мех. Производство: Китай.',
   3490, null, 1000, 'fast', '40, 42, 44, 46, 48, 50', 'чёрный мех, белый мех', jsonb_build_array(base||'kos1000_1.jpg', base||'kos1000_2.jpg', base||'kos1000_3.jpg', base||'kos1000_4.jpg'), 0,
   'allall · Гена, корпус Б, 2Г-30 · 1000 ₽ (акция)'),

  (c_fur, 'Шуба укороченная с большим воротником',
   E'Короткая шуба из искусственного меха с объёмным отложным воротником. Новая, с биркой.\n\nОчень плотная, с наполнителем, на подкладке. Короткая длина и широкие рукава — выглядит дорого и современно, смотрится с джинсами и брюками.\n\nМатериал: искусственный мех. Производство: Китай.',
   4990, null, 2500, '', '42, 44, 46, 48', 'чёрный, шоколад, молочный', jsonb_build_array(base||'korot_1.jpg', base||'korot_2.jpg', base||'korot_3.jpg', base||'korot_4.jpg', base||'korot_5.jpg', base||'korot_6.jpg', base||'korot_7.jpg', base||'korot_8.jpg', base||'korot_9.jpg'), 0,
   'allall · 2500 ₽ штучно'),

  (c_sheep, 'Дублёнка-авиатор укороченная с бежевым мехом',
   E'Укороченная дублёнка-авиатор с контрастным бежевым мехом. Новая, с биркой.\n\nМеховой воротник с ремешком, мех на манжетах и по низу, молния по центру, карманы на молниях. Тёплая — до −15 °C.\n\nМатериал: экокожа, искусственный мех. Производство: Китай.',
   3490, null, 1000, '', '42, 44, 46, 48', 'чёрный', jsonb_build_array(base||'avb_1.jpg', base||'avb_2.jpg', base||'avb_3.jpg'), 0,
   'allall · 1000 ₽');

  -- косуха от MZ заменена косухой с allall
  update products set in_stock = false where title = 'Дублёнка-косуха женская чёрная оверсайз';
end $$;
