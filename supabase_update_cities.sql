-- Qala: обновление базы для городов Казахстана.
-- Нужно один раз выполнить в Supabase → SQL Editor, если схему из supabase.sql вы применяли раньше.
-- Если создаёте базу с нуля, этот файл не нужен: обновлённый supabase.sql уже всё содержит.

-- 1. Город проживания в профиле
alter table public.profiles add column if not exists city text;
alter table public.profiles drop constraint if exists profiles_city_check;
alter table public.profiles add constraint profiles_city_check
  check (city is null or city in ('astana','almaty','shymkent','karaganda','aktobe','atyrau','aktau','turkestan'));

-- 2. Место друга может быть в любом городе, а не только в Астане
alter table public.locations drop constraint if exists locations_place_check;
alter table public.locations add constraint locations_place_check
  check (place is null or place ~ '^[a-z0-9]{1,20}$');

-- 3. Разрешаем пользователю менять свой город
grant update (name, role, interests, city) on public.profiles to authenticated;
