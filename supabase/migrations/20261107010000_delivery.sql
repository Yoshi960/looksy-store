-- Способ доставки, который выбрал покупатель, и адрес (для курьера или пункта выдачи).
alter table orders add column if not exists delivery text not null default '';
alter table orders add column if not exists address text not null default '';
