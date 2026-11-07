-- Унисекс: вещь показывается и в «Женщинам», и в «Мужчинам» (одна карточка, общий остаток и статистика).
alter table products add column if not exists unisex boolean not null default false;
