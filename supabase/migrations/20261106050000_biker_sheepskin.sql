-- Новый товар: дублёнка-косуха чёрная оверсайз (поставщик MZ, Садовод 2А-49).
do $$
declare
  base text := 'https://yoshi960.github.io/looksy-store/seed/';
  c bigint;
begin
  if exists (select 1 from products where title = 'Дублёнка-косуха женская чёрная оверсайз') then return; end if;
  select id into c from categories where name = 'Дублёнки' order by id limit 1;
  if c is null then
    insert into categories(name, grp, sort) values ('Дублёнки', 'w', 2) returning id into c;
  end if;

  insert into products(category_id, title, description, price, old_price, cost, promo, sizes, colors, photos, sort) values
  (c, 'Дублёнка-косуха женская чёрная оверсайз',
   E'Укороченная дублёнка-косуха свободного кроя с мехом. Новая, с биркой.\n\nБольшой меховой воротник, мех на манжетах и по низу, внутри тёплая меховая подкладка. Косая молния, карманы на молниях и пояс с металлической пряжкой — выглядит дерзко и дорого.\n\nОверсайз-посадка: легко надевается на худи или свитер. Смотрится с широкими джинсами, брюками и платьями.\n\nМатериал: экокожа, искусственный мех. Производство: Китай.',
   3990, null, 2000, '', '42, 44, 46, 48, 50', 'чёрный',
   jsonb_build_array(base||'biker_1.jpg', base||'biker_2.jpg', base||'biker_3.jpg', base||'biker_4.jpg'), 0);
end $$;
