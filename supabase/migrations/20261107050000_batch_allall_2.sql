do $$
declare base text := 'https://yoshi960.github.io/looksy-store/seed/'; c_j bigint; c_c bigint;
begin
  if exists (select 1 from products where title = 'Пуховик с кулиской на талии и капюшоном') then return; end if;
  select id into c_j from categories where name = 'Куртки' order by id limit 1;
  if c_j is null then insert into categories(name,grp,sort) values ('Куртки','w',3) returning id into c_j; end if;
  select id into c_c from categories where name = 'Тренчи и пальто' order by id limit 1;
  if c_c is null then insert into categories(name,grp,sort) values ('Тренчи и пальто','w',4) returning id into c_c; end if;
  insert into products(category_id,title,description,price,old_price,cost,promo,sizes,colors,photos,sort,supplier) values
  (c_j,'Пуховик с кулиской на талии и капюшоном',
   E'Тёплый пуховик средней длины с кулиской на талии и съёмным капюшоном. Новый, с биркой.\n\nКулиска собирает силуэт по фигуре, высокий воротник-стойка закрывает от ветра, манжеты на резинке. Держит тепло до −25 °C.\n\nУтеплитель: холлофайбер. Производство: Корея.',
   5490,null,2500,'hit','42, 44, 46, 48, 50','чёрный, шоколад, бордовый',jsonb_build_array(base||'puhk_1.jpg', base||'puhk_2.jpg', base||'puhk_3.jpg', base||'puhk_4.jpg', base||'puhk_5.jpg', base||'puhk_6.jpg', base||'puhk_7.jpg', base||'puhk_8.jpg'),0,'allall · Алижон, корпус Б, 2Г-31 · 2500 ₽ / 2400 ₽ опт'),
  (c_c,'Пальто оверсайз с поясом, короткое',
   E'Короткое пальто свободного кроя с большим воротником, поясом и объёмными рукавами с хлястиками. Новое, с биркой.\n\nПояс подчёркивает талию, широкие рукава и погоны делают образ современным. Утеплённое — на осень и мягкую зиму.\n\nРазмеры: S (42–44), M (46–48).',
   5490,null,2700,'','S (42–44), M (46–48)','молочный, тёмно-синий, чёрный, шоколад, серый',jsonb_build_array(base||'palto_1.jpg', base||'palto_2.jpg', base||'palto_3.jpg', base||'palto_4.jpg'),0,'allall · 2700 ₽ / 2500 ₽ опт · уточнить: без бирки Zara'),
  (c_j,'Пуховик длинный с меховым воротником и поясом',
   E'Длинный зимний пуховик ниже колена с пышным белым воротником из искусственного меха и широким поясом. Новый, с биркой.\n\nПояс подчёркивает талию, большие карманы, водоотталкивающая ткань. Тёплый — до −30 °C.\n\nЕсть большие размеры — до 54.',
   4490,null,1400,'fast','44, 46, 48, 50, 52, 54','графит, чёрный, шоколад',jsonb_build_array(base||'dlin_1.jpg', base||'dlin_2.jpg', base||'dlin_3.jpg'),0,'allall · 1400 ₽ · 2700+ отзывов');
end $$;
