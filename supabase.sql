-- Qala: схема для Supabase.
-- Как применить: Supabase → SQL Editor → вставить весь файл → Run.
-- Все права выдаются через Row Level Security (RLS): даже зная публичный ключ,
-- пользователь видит и меняет только то, что разрешено правилами ниже.

------------------------------------------------------------------
-- 1. Таблицы
------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  public_id  text not null unique check (public_id ~ '^[0-9]{8}$'),
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  role       text not null default 'Турист' check (role in ('Турист','Житель')),
  interests  text[] not null default '{}'
             check (interests <@ array['Music','Tech','Sport','Art','Business','Food']),
  city       text check (city is null or city in ('astana','almaty','shymkent','karaganda','aktobe','atyrau','aktau','turkestan')),  -- город проживания (для жителей)
  created_at timestamptz not null default now()
);

create table public.friendships (
  id            bigint generated always as identity primary key,
  requester     uuid not null references public.profiles(id) on delete cascade,
  addressee     uuid not null references public.profiles(id) on delete cascade,
  addressee_pid text not null check (addressee_pid ~ '^[0-9]{8}$'),
  status        text not null default 'pending' check (status in ('pending','accepted')),
  created_at    timestamptz not null default now(),
  check (requester <> addressee)
);
-- одна пара людей — одна запись, независимо от того, кто кого добавил
create unique index friendships_pair
  on public.friendships (least(requester::text, addressee::text), greatest(requester::text, addressee::text));
create index friendships_addressee on public.friendships (addressee);

-- где пользователь сейчас (видно только ему и подтверждённым друзьям)
create table public.locations (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  place      text check (place ~ '^[a-z0-9]{1,20}$'),   -- id места из любого города
  status     text check (char_length(status) <= 40),
  updated_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  key     text not null check (key ~ '^[pe]:[a-z0-9]{1,20}$'),
  primary key (user_id, key)
);

create table public.tickets (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  code       text not null check (code ~ '^QL-[A-Z0-9]{6}$'),
  event_id   text not null check (char_length(event_id) between 1 and 10),
  qty        int  not null check (qty between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, code),
  unique (user_id, event_id)
);

create table public.day_plans (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  plans      jsonb not null default '{}'
             check (jsonb_typeof(plans) = 'object' and octet_length(plans::text) < 50000),
  att        int not null default 0 check (att between 0 and 100000),
  updated_at timestamptz not null default now()
);

-- журнал попыток поиска по ID (защита от перебора), клиентам недоступен
create table public.id_lookups (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index id_lookups_user_at on public.id_lookups (user_id, at);

------------------------------------------------------------------
-- 2. Функции
------------------------------------------------------------------

-- Случайный неповторяющийся 8-значный ID (первая цифра не 0)
create or replace function public.gen_public_id() returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  loop
    v := (10000000 + floor(random() * 90000000))::int::text;
    exit when not exists (select 1 from public.profiles where public_id = v);
  end loop;
  return v;
end $$;

-- При регистрации автоматически создаём профиль и выдаём личный ID
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  nm := left(btrim(coalesce(new.raw_user_meta_data->>'name', '')), 30);
  if nm = '' then nm := left(btrim(split_part(coalesce(new.email, ''), '@', 1)), 30); end if;
  if nm = '' then nm := 'Пользователь'; end if;
  insert into public.profiles (id, public_id, name) values (new.id, public.gen_public_id(), nm);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Являюсь ли я другом этого человека (запрос подтверждён)
create or replace function public.is_friend(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = other)
        or (f.requester = other and f.addressee = auth.uid()))
  );
$$;

-- Отправить запрос в друзья по 8-значному ID.
-- Возвращает: sent | accepted | exists | exists_pending | not_found | self | invalid | rate_limited
-- Не более 10 попыток в час: иначе ID можно было бы перебирать.
create or replace function public.send_friend_request(target text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t  uuid;
  f  public.friendships%rowtype;
  n  int;
begin
  if me is null then return 'invalid'; end if;
  if target is null or target !~ '^[0-9]{8}$' then return 'invalid'; end if;

  delete from public.id_lookups where user_id = me and at < now() - interval '1 day';
  select count(*) into n from public.id_lookups where user_id = me and at > now() - interval '1 hour';
  if n >= 10 then return 'rate_limited'; end if;
  insert into public.id_lookups (user_id) values (me);

  select id into t from public.profiles where public_id = target;
  if t is null then return 'not_found'; end if;
  if t = me then return 'self'; end if;

  select * into f from public.friendships
   where (requester = me and addressee = t) or (requester = t and addressee = me);
  if found then
    if f.status = 'accepted' then return 'exists'; end if;
    if f.requester = t then
      update public.friendships set status = 'accepted' where id = f.id;
      return 'accepted';
    end if;
    return 'exists_pending';
  end if;

  insert into public.friendships (requester, addressee, addressee_pid) values (me, t, target);
  return 'sent';
end $$;

-- Принять или отклонить входящий запрос
create or replace function public.respond_friend_request(req bigint, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if accept then
    update public.friendships set status = 'accepted'
     where id = req and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships
     where id = req and addressee = auth.uid() and status = 'pending';
  end if;
end $$;

-- Удалить друга или отменить свой запрос
create or replace function public.remove_friend(other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
   where (requester = auth.uid() and addressee = other)
      or (requester = other and addressee = auth.uid());
end $$;

------------------------------------------------------------------
-- 3. Row Level Security
------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.friendships enable row level security;
alter table public.locations   enable row level security;
alter table public.favorites   enable row level security;
alter table public.tickets     enable row level security;
alter table public.day_plans   enable row level security;
alter table public.id_lookups  enable row level security;  -- политик нет: доступа нет

-- Профиль видят: я сам, мои друзья и тот, кто прислал мне запрос.
-- Того, кому я отправил запрос, до его согласия я не вижу.
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or public.is_friend(id)
  or exists (select 1 from public.friendships f
              where f.status = 'pending' and f.requester = profiles.id and f.addressee = (select auth.uid()))
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Свои запросы и дружбы видны, менять напрямую нельзя (только через функции)
create policy friendships_select on public.friendships for select to authenticated
  using (requester = (select auth.uid()) or addressee = (select auth.uid()));

-- Место: только я и подтверждённые друзья
create policy locations_select on public.locations for select to authenticated
  using (user_id = (select auth.uid()) or public.is_friend(user_id));
create policy locations_insert on public.locations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy locations_update on public.locations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy locations_delete on public.locations for delete to authenticated
  using (user_id = (select auth.uid()));

-- Избранное, билеты и план дня: только владелец
create policy favorites_all on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy tickets_select on public.tickets for select to authenticated
  using (user_id = (select auth.uid()));
create policy tickets_insert on public.tickets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy tickets_delete on public.tickets for delete to authenticated
  using (user_id = (select auth.uid()));

create policy day_plans_all on public.day_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

------------------------------------------------------------------
-- 4. Права доступа
------------------------------------------------------------------

-- Без входа (роль anon) не доступно ничего
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon, public;

-- Вошедшим пользователям: только то, что нужно сайту
revoke insert, delete on public.profiles from authenticated;
revoke update         on public.profiles from authenticated;
grant  update (name, role, interests, city) on public.profiles to authenticated;   -- public_id менять нельзя

revoke insert, update, delete on public.friendships from authenticated;      -- только через функции
revoke all on public.id_lookups from authenticated;

grant execute on function public.is_friend(uuid)                      to authenticated;
grant execute on function public.send_friend_request(text)            to authenticated;
grant execute on function public.respond_friend_request(bigint, boolean) to authenticated;
grant execute on function public.remove_friend(uuid)                  to authenticated;
