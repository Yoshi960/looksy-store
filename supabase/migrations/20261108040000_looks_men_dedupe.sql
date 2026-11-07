-- Мужские образы были почти одинаковые: убираем дубль и даём оставшимся разные обложки.
delete from looks where title = 'Smart casual: рубчик + чёрные джинсы';
update looks set photos = jsonb_build_array('https://yoshi960.github.io/looksy-store/seed/jrib_3.jpg',
                                            'https://yoshi960.github.io/looksy-store/seed/jng_3.jpg')
  where title = 'Джемпер в рубчик + серые джинсы';
