-- Прогревочный бот SelfClub (@selfclub_manbot): воронка тест → видео → оплата в Tribute.
create table if not exists sc_users (
  user_id     bigint primary key,
  username    text,
  first_name  text,
  src         text,            -- метка из ссылки t.me/selfclub_manbot?start=<src> (какой ролик привёл)
  started_at  bigint not null, -- секунды
  q           int not null default 0,  -- номер текущего вопроса теста (0..5), 5 = тест пройден
  yes         int not null default 0,
  offer_at    bigint,          -- когда показали видео и кнопку оплаты
  nudge_at    bigint,
  remind1_at  bigint,
  remind2_at  bigint,
  member_at   bigint,          -- появился в закрытой группе
  left_at     bigint,          -- вышел из группы (отписка)
  blocked     boolean not null default false
);
create index if not exists sc_users_offer on sc_users (offer_at) where member_at is null;
create table if not exists sc_kv (key text primary key, value text);
alter table sc_users enable row level security;
alter table sc_kv enable row level security;
