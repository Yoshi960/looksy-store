-- Пользователи бота (для уведомлений о новых) и переписка поддержки.
create table if not exists bot_users (
  id bigint primary key,
  first_name text not null default '',
  username text,
  source text,
  created_at bigint not null default extract(epoch from now())::bigint
);
alter table bot_users enable row level security;

-- связь «сообщение у админа» → «покупатель», чтобы ответ админа ушёл нужному человеку
create table if not exists support_map (
  admin_chat bigint not null,
  admin_msg bigint not null,
  user_id bigint not null,
  created_at bigint not null default extract(epoch from now())::bigint,
  primary key (admin_chat, admin_msg)
);
alter table support_map enable row level security;

create table if not exists admin_prefs (
  admin_id bigint primary key,
  new_users boolean not null default true
);
alter table admin_prefs enable row level security;
