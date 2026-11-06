-- Готовые образы: подборка товаров (одежда + обувь + аксессуары) со скидкой за весь образ.
create table if not exists looks (
  id bigserial primary key,
  title text not null,
  description text not null default '',
  grp text not null default 'w',
  photos jsonb not null default '[]',
  items jsonb not null default '[]',        -- id товаров по порядку
  discount int not null default 0,          -- скидка в % при покупке всего образа
  active boolean not null default true,
  sort int not null default 0,
  created_at bigint not null default extract(epoch from now())::bigint
);
alter table looks enable row level security;
