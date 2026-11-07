do $$
declare base text := 'https://yoshi960.github.io/looksy-store/seed/';
  m_sw bigint; m_jn bigint; m_st bigint; w_kn bigint; w_jn bigint;
  p_jo bigint; p_jb bigint;
begin
  if exists (select 1 from products where title = 'Джемпер оверсайз на полузамке') then return; end if;
  insert into categories(name,grp,sort) values ('Свитеры и джемперы','m',1) returning id into m_sw;
  insert into categories(name,grp,sort) values ('Джинсы','m',2) returning id into m_jn;
  insert into categories(name,grp,sort) values ('Костюмы','m',3) returning id into m_st;
  select id into w_kn from categories where name='Свитеры' and grp='w' limit 1;
  if w_kn is null then insert into categories(name,grp,sort) values ('Свитеры и водолазки','w',5) returning id into w_kn; end if;
  insert into categories(name,grp,sort) values ('Джинсы и брюки','w',6) returning id into w_jn;

  insert into products(category_id,title,description,price,cost,promo,sizes,colors,photos,sort,supplier) values
  (m_sw,'Джемпер оверсайз на полузамке',E'Мужской вязаный джемпер свободного кроя с воротником-стойкой на молнии. Новый, с биркой.\n\nПлотный рубчик, спущенное плечо, широкие манжеты. Носится с футболкой или рубашкой под низ, с джинсами и брюками.\n\nРазмер единый, подходит на 48–54.','2990',1100,'hit','48–54','шоколад, тёмно-синий, молочный, чёрный',jsonb_build_array(base||'jmpo_1.jpg', base||'jmpo_2.jpg', base||'jmpo_3.jpg', base||'jmpo_4.jpg', base||'jmpo_5.jpg', base||'jmpo_6.jpg', base||'jmpo_7.jpg', base||'jmpo_8.jpg', base||'jmpo_9.jpg', base||'jmpo_10.jpg', base||'jmpo_11.jpg', base||'jmpo_12.jpg'),0,'allall · Асад, 24-35 · 1100 ₽ / 1000 ₽ от 4 шт') returning id into p_jo;
  insert into products(category_id,title,description,price,cost,promo,sizes,colors,photos,sort,supplier) values
  (m_sw,'Джемпер в рубчик на полузамке',E'Мужской джемпер крупной вязки в рубчик с высоким воротником на молнии. Новый, с биркой.\n\nСидит по фигуре, держит форму. Подходит и под джинсы, и под классические брюки.','2490',900,'','M (48–50), L (52–54)','шоколад, тёмно-синий, графит, молочный, чёрный',jsonb_build_array(base||'jrib_1.jpg', base||'jrib_2.jpg', base||'jrib_3.jpg', base||'jrib_4.jpg', base||'jrib_5.jpg'),0,'allall · 900 ₽ / 800 ₽ от 4 шт');
  insert into products(category_id,title,description,price,cost,promo,sizes,colors,photos,sort,supplier) values
  (m_jn,'Джинсы мужские прямые, чёрные',E'Классические мужские джинсы прямого кроя. Новые, с биркой.\n\nПлотный хлопок с эластаном — тянутся и держат форму. Длина 110–115 см.\n\nСостав: 98% хлопок, 2% эластан. Производство: Турция.','2990',1300,'','44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64','чёрный',jsonb_build_array(base||'jnb_1.jpg', base||'jnb_2.jpg', base||'jnb_3.jpg', base||'jnb_4.jpg'),0,'allall · FARRUKH, корпус А, 2-1-18 · 1300 ₽ / 1100 ₽ от 8 шт') returning id into p_jb;
  insert into products(category_id,title,description,price,cost,promo,sizes,colors,photos,sort,supplier) values
  (m_jn,'Джинсы мужские прямые, серые',E'Мужские джинсы прямого кроя в сером цвете с лёгкой варкой. Новые, с биркой.\n\nПлотный хлопок с эластаном, хорошая посадка. Сочетаются с джемперами любого цвета.\n\nПроизводство: Турция.','2990',1300,'','46, 48, 50, 52, 54, 56, 58, 60','серый',jsonb_build_array(base||'jng_1.jpg', base||'jng_2.jpg', base||'jng_3.jpg'),0,'allall · FARRUKH, корпус А, 2-1-18 · 1300 ₽');
  insert into products(category_id,title,description,price,cost,promo,sizes,colors,photos,sort,supplier) values
  (m_st,'Флисовый костюм: кофта на полузамке и джоггеры',E'Мужской костюм-двойка из двустороннего флиса. Новый, с биркой.\n\nТёплый и мягкий: кофта с воротником-стойкой на молнии и джоггеры на резинке. На каждый день, в дорогу и дома.','3990',1600,'fast','48, 50, 52, 54','графит, чёрный, тёмно-синий, шоколад',jsonb_build_array(base||'flc_1.jpg', base||'flc_2.jpg', base||'flc_3.jpg', base||'flc_4.jpg', base||'flc_5.jpg', base||'flc_6.jpg'),0,'allall · 2А-49, корпус Б · 1600 ₽');
  insert into products(category_id,title,description,price,cost,promo,sizes,colors,photos,sort,supplier) values
  (w_kn,'Водолазка женская приталенная',E'Тонкая мягкая водолазка по фигуре с невысоким горлом. Новая, с биркой.\n\nНосится под пальто, пиджак, шубу — база для любого образа.\n\nСостав: 75% хлопок, 15% кашемир, 10% эластан. Производство: Китай.','1290',300,'','42–46 (единый), 48–64 (большой)','молочный, серый, мокко, шоколад',jsonb_build_array(base||'wvod_1.jpg', base||'wvod_2.jpg', base||'wvod_3.jpg', base||'wvod_4.jpg'),0,'allall · 2-2-23, корпус А · 300 ₽ (большой р. 400 ₽)'),
  (w_kn,'Свитер оверсайз крупной вязки',E'Объёмный вязаный свитер с широкими рукавами. Новый, с биркой.\n\nУютный и тёплый, красиво смотрится с джинсами, юбкой и под шубой.\n\nРазмер единый, подходит на 42–48. Материал: акрил.','2490',1000,'','42–48','шоколад, молочный, чёрный, серый, мокко, бордовый',jsonb_build_array(base||'wsvi_1.jpg', base||'wsvi_2.jpg', base||'wsvi_3.jpg', base||'wsvi_4.jpg', base||'wsvi_5.jpg', base||'wsvi_6.jpg'),0,'MZ 2А-49 корпус Б · 1000 ₽ (проверить в allall)'),
  (w_jn,'Джинсы-багги белые широкие',E'Широкие женские джинсы свободного кроя. Новые, с биркой.\n\nПлотный тянущийся деним. Отлично сочетаются со свитерами, водолазками и верхней одеждой.','2690',1200,'','40, 42, 44, 46, 48, 50','белый',jsonb_build_array(base||'wjb_1.jpg', base||'wjb_2.jpg', base||'wjb_3.jpg', base||'wjb_4.jpg', base||'wjb_5.jpg'),0,'allall · Дилшод, 2Г-68, корпус Б · 1200 ₽');

  insert into looks(title,description,grp,photos,items,discount) values
  ('Джемпер + джинсы', 'Мужской базовый образ на каждый день: оверсайз-джемпер на полузамке и классические чёрные джинсы.','m',
   jsonb_build_array(base||'jnb_1.jpg'), jsonb_build_array(p_jo,p_jb), 8);
end $$;
