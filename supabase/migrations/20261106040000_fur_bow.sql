-- Новый товар: шуба с капюшоном и поясом-бантом (поставщик MZ, Садовод 2А-49).
-- Добавляется один раз: если товар с таким названием уже есть, ничего не делает.
do $$
declare
  base text := 'https://yoshi960.github.io/looksy-store/seed/';
  c_fur bigint;
begin
  if exists (select 1 from products where title = 'Шуба с капюшоном и поясом-бантом') then return; end if;
  select id into c_fur from categories where name = 'Шубы' order by id limit 1;
  if c_fur is null then
    insert into categories(name, grp, sort) values ('Шубы', 'w', 1) returning id into c_fur;
  end if;

  insert into products(category_id, title, description, price, old_price, cost, promo, sizes, colors, photos, sort) values
  (c_fur, 'Шуба с капюшоном и поясом-бантом',
   E'Шуба из искусственного меха с большим капюшоном и поясом-бантом. Новая, с биркой.\n\nГустой длинный мех, объёмный капюшон-воротник и свободные рукава — в такой шубе тепло даже в сильный ветер. Пояс завязывается бантом и собирает силуэт по талии, поэтому шуба не выглядит громоздкой. Длина до середины бедра.\n\nХорошо сочетается с широкими брюками и джинсами, подходит и на прогулку, и на вечер.\n\nМатериал: искусственный мех. Производство: Китай.',
   6990, null, 4000, '', '42, 44, 46, 48, 50', 'светло-серый',
   jsonb_build_array(base||'bant_1.jpg', base||'bant_2.jpg', base||'bant_3.jpg', base||'bant_4.jpg', base||'bant_5.jpg', base||'bant_6.jpg'), 0);
end $$;
