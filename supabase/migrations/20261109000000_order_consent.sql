-- Когда покупатель отметил согласие на обработку персональных данных и условия продажи (время в секундах, как created_at).
alter table orders add column if not exists consent_at bigint;
