-- =====================================================================
-- TuSilla · esquema de base de datos (Supabase / PostgreSQL)
-- Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
-- Se puede correr una sola vez en un proyecto nuevo.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table public.businesses (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  slug            text not null unique,
  name            text not null check (char_length(name) between 2 and 80),
  category        text not null default 'estetica'
                  check (category in ('estetica','salon','barberia','unas','spa','cejas')),
  description     text not null default '',
  phone           text not null check (phone ~ '^(809|829|849)[0-9]{7}$'),
  address         text not null default '',
  city            text not null default '',
  instagram       text not null default '',
  accent          text not null default '#B8336A' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url        text,
  slot_step       int  not null default 30 check (slot_step in (10,15,20,30,45,60)),
  min_notice_min  int  not null default 60 check (min_notice_min between 0 and 10080),
  max_days_ahead  int  not null default 30 check (max_days_ahead between 1 and 180),
  cancel_hours    int  not null default 4  check (cancel_hours between 0 and 168),
  is_published    boolean not null default true,
  auto_confirm    boolean not null default true,
  auto_24h        boolean not null default true,
  auto_2h         boolean not null default true,
  tpl_confirm     text,
  tpl_24h         text,
  tpl_2h          text,
  created_at      timestamptz not null default now(),
  constraint slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  constraint slug_reserved check (slug not in (
    'panel','entrar','registro','salir','cita','api','auth','negocios','ayuda',
    'terminos','privacidad','admin','app','www','manifest','icon','apple-icon'))
);
create index businesses_owner_idx on public.businesses(owner_id);

create table public.services (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 80),
  description  text not null default '',
  duration_min int  not null check (duration_min between 5 and 600),
  price        numeric(10,2) not null default 0 check (price >= 0),
  is_active    boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index services_business_idx on public.services(business_id);

create table public.staff (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 60),
  role         text not null default '',
  is_active    boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index staff_business_idx on public.staff(business_id);

-- Si una persona no tiene filas aquí, hace TODOS los servicios.
create table public.staff_services (
  staff_id    uuid not null references public.staff(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- Horario semanal. weekday: 0 = domingo … 6 = sábado. Se permiten varios
-- rangos por día (por ejemplo 9:00–13:00 y 14:00–18:00).
create table public.working_hours (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);
create index working_hours_staff_idx on public.working_hours(staff_id);

-- Bloqueos: vacaciones, citas médicas, días libres puntuales.
create table public.time_off (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text not null default '',
  check (ends_at > starts_at)
);
create index time_off_staff_idx on public.time_off(staff_id);

create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null,
  phone        text not null,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  unique (business_id, phone)
);

create table public.appointments (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  staff_id              uuid references public.staff(id) on delete set null,
  service_id            uuid references public.services(id) on delete set null,
  customer_id           uuid references public.customers(id) on delete set null,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  status                text not null default 'confirmed'
                        check (status in ('confirmed','completed','no_show','cancelled')),
  price                 numeric(10,2) not null default 0,
  service_name          text not null,
  customer_name         text not null,
  customer_phone        text not null,
  source                text not null default 'online' check (source in ('online','panel')),
  notes                 text not null default '',
  manage_token          uuid not null unique default gen_random_uuid(),
  confirm_sent_at       timestamptz,
  reminder_24h_sent_at  timestamptz,
  reminder_2h_sent_at   timestamptz,
  created_at            timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Nunca dos citas activas a la misma hora con la misma persona.
  constraint no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled')
);
create index appointments_business_time_idx on public.appointments(business_id, starts_at);
create index appointments_reminders_idx on public.appointments(status, starts_at);

-- ---------------------------------------------------------------------
-- Funciones de apoyo para los permisos
-- ---------------------------------------------------------------------

create or replace function public.owns_business(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = b and owner_id = auth.uid());
$$;

create or replace function public.business_is_public(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = b and is_published);
$$;

create or replace function public.staff_business(s uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from staff where id = s;
$$;

create or replace function public.service_business(s uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from services where id = s;
$$;

-- ---------------------------------------------------------------------
-- Permisos (Row Level Security)
--   · Cualquiera ve negocios publicados, sus servicios, equipo y horario.
--   · Solo la dueña o el dueño ve clientes y citas, y edita todo lo suyo.
--   · El público reserva y cancela solo a través de las funciones de abajo.
-- ---------------------------------------------------------------------

alter table public.businesses     enable row level security;
alter table public.services       enable row level security;
alter table public.staff          enable row level security;
alter table public.staff_services enable row level security;
alter table public.working_hours  enable row level security;
alter table public.time_off       enable row level security;
alter table public.customers      enable row level security;
alter table public.appointments   enable row level security;

create policy biz_read   on public.businesses for select using (is_published or owner_id = auth.uid());
create policy biz_insert on public.businesses for insert with check (owner_id = auth.uid());
create policy biz_update on public.businesses for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy biz_delete on public.businesses for delete using (owner_id = auth.uid());

create policy svc_read  on public.services for select using (business_is_public(business_id) or owns_business(business_id));
create policy svc_write on public.services for all using (owns_business(business_id)) with check (owns_business(business_id));

create policy staff_read  on public.staff for select using (business_is_public(business_id) or owns_business(business_id));
create policy staff_write on public.staff for all using (owns_business(business_id)) with check (owns_business(business_id));

create policy ss_read  on public.staff_services for select
  using (business_is_public(staff_business(staff_id)) or owns_business(staff_business(staff_id)));
create policy ss_write on public.staff_services for all
  using (owns_business(staff_business(staff_id)))
  with check (owns_business(staff_business(staff_id)) and staff_business(staff_id) = service_business(service_id));

create policy wh_read  on public.working_hours for select
  using (business_is_public(staff_business(staff_id)) or owns_business(staff_business(staff_id)));
create policy wh_write on public.working_hours for all
  using (owns_business(staff_business(staff_id))) with check (owns_business(staff_business(staff_id)));

create policy off_owner on public.time_off for all
  using (owns_business(staff_business(staff_id))) with check (owns_business(staff_business(staff_id)));

create policy cust_owner on public.customers for all
  using (owns_business(business_id)) with check (owns_business(business_id));

create policy appt_owner on public.appointments for all
  using (owns_business(business_id)) with check (owns_business(business_id));

-- ---------------------------------------------------------------------
-- Horas disponibles para un servicio en un día
-- ---------------------------------------------------------------------

create or replace function public.get_available_slots(
  p_slug text, p_service uuid, p_date date, p_staff uuid default null
) returns table (staff_id uuid, starts_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  b  businesses;
  sv services;
  tz constant text := 'America/Santo_Domingo';
  local_today date;
  dur interval;
begin
  select * into b from businesses where slug = p_slug and is_published;
  if not found then return; end if;
  select * into sv from services where id = p_service and business_id = b.id and is_active;
  if not found then return; end if;

  local_today := (now() at time zone tz)::date;
  if p_date < local_today or p_date > local_today + b.max_days_ahead then return; end if;
  dur := make_interval(mins => sv.duration_min);

  return query
  with st as (
    select s.id from staff s
    where s.business_id = b.id and s.is_active
      and (p_staff is null or s.id = p_staff)
      and ( not exists (select 1 from staff_services x where x.staff_id = s.id)
            or exists (select 1 from staff_services x where x.staff_id = s.id and x.service_id = sv.id) )
  ), cand as (
    select distinct st.id as sid, (g.t at time zone tz) as ts
    from st
    join working_hours wh on wh.staff_id = st.id and wh.weekday = extract(dow from p_date)::int
    cross join lateral generate_series(
      p_date + wh.start_time,
      p_date + wh.end_time - dur,
      make_interval(mins => b.slot_step)
    ) as g(t)
  )
  select c.sid, c.ts from cand c
  where c.ts >= now() + make_interval(mins => b.min_notice_min)
    and not exists (
      select 1 from appointments a
      where a.staff_id = c.sid and a.status <> 'cancelled'
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(c.ts, c.ts + dur, '[)'))
    and not exists (
      select 1 from time_off o
      where o.staff_id = c.sid
        and tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange(c.ts, c.ts + dur, '[)'))
  order by c.ts, c.sid;
end $$;

-- ---------------------------------------------------------------------
-- Reservar (lo usa la página pública; no hace falta cuenta)
-- ---------------------------------------------------------------------

create or replace function public.book_appointment(
  p_slug text, p_service uuid, p_staff uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_notes text default ''
) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  b businesses; sv services; ap appointments;
  v_phone text; v_staff uuid; v_cust uuid; v_date date; v_count int;
  tz constant text := 'America/Santo_Domingo';
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone) = 11 and left(v_phone, 1) = '1' then v_phone := substr(v_phone, 2); end if;
  if v_phone !~ '^(809|829|849)[0-9]{7}$' then raise exception 'invalid_phone'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 then raise exception 'invalid_name'; end if;

  select * into b from businesses where slug = p_slug and is_published;
  if not found then raise exception 'business_not_found'; end if;
  select * into sv from services where id = p_service and business_id = b.id and is_active;
  if not found then raise exception 'service_not_found'; end if;

  -- Freno contra reservas falsas en masa
  select count(*) into v_count from appointments
  where business_id = b.id and customer_phone = v_phone and status = 'confirmed' and starts_at > now();
  if v_count >= 3 then raise exception 'too_many_bookings'; end if;

  v_date := (p_starts_at at time zone tz)::date;

  -- Si la clienta eligió "cualquiera", se asigna a quien tenga menos citas ese día
  select s.staff_id into v_staff
  from get_available_slots(p_slug, p_service, v_date, p_staff) s
  where s.starts_at = p_starts_at
  order by (select count(*) from appointments a
            where a.staff_id = s.staff_id and a.status <> 'cancelled'
              and (a.starts_at at time zone tz)::date = v_date), random()
  limit 1;
  if v_staff is null then raise exception 'slot_taken'; end if;

  insert into customers (business_id, name, phone)
  values (b.id, trim(p_name), v_phone)
  on conflict (business_id, phone) do update set name = excluded.name
  returning id into v_cust;

  begin
    insert into appointments (business_id, staff_id, service_id, customer_id, starts_at, ends_at,
                              price, service_name, customer_name, customer_phone, source, notes)
    values (b.id, v_staff, sv.id, v_cust, p_starts_at, p_starts_at + make_interval(mins => sv.duration_min),
            sv.price, sv.name, trim(p_name), v_phone, 'online', left(coalesce(p_notes, ''), 300))
    returning * into ap;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  return json_build_object(
    'id', ap.id, 'token', ap.manage_token, 'starts_at', ap.starts_at,
    'staff_name', (select name from staff where id = v_staff),
    'service_name', sv.name, 'price', sv.price,
    'customer_name', ap.customer_name, 'customer_phone', v_phone,
    'business_name', b.name, 'business_phone', b.phone, 'address', b.address,
    'slug', b.slug, 'auto_confirm', b.auto_confirm);
end $$;

-- ---------------------------------------------------------------------
-- Ver y cancelar una cita con el link privado que recibe la clienta
-- ---------------------------------------------------------------------

create or replace function public.get_appointment_by_token(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'status', a.status,
    'service_name', a.service_name, 'price', a.price, 'customer_name', a.customer_name,
    'staff_name', s.name, 'business_name', b.name, 'slug', b.slug, 'business_phone', b.phone,
    'address', b.address, 'city', b.city, 'accent', b.accent, 'cancel_hours', b.cancel_hours,
    'can_cancel', a.status = 'confirmed' and a.starts_at - make_interval(hours => b.cancel_hours) > now())
  from appointments a
  join businesses b on b.id = a.business_id
  left join staff s on s.id = a.staff_id
  where a.manage_token = p_token;
$$;

create or replace function public.cancel_appointment_by_token(p_token uuid) returns json
language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  update appointments a set status = 'cancelled'
  from businesses b
  where b.id = a.business_id and a.manage_token = p_token and a.status = 'confirmed'
    and a.starts_at - make_interval(hours => b.cancel_hours) > now()
  returning a.id into v_id;
  if v_id is null then raise exception 'cannot_cancel'; end if;
  return get_appointment_by_token(p_token);
end $$;

-- Quién puede llamar a cada función
revoke all on function public.get_available_slots(text, uuid, date, uuid) from public;
revoke all on function public.book_appointment(text, uuid, uuid, timestamptz, text, text, text) from public;
revoke all on function public.get_appointment_by_token(uuid) from public;
revoke all on function public.cancel_appointment_by_token(uuid) from public;
grant execute on function public.get_available_slots(text, uuid, date, uuid) to anon, authenticated;
grant execute on function public.book_appointment(text, uuid, uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.get_appointment_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_appointment_by_token(uuid) to anon, authenticated;

-- Las funciones de apoyo de los permisos no deben quedar expuestas en la API:
-- se mueven a un esquema privado (los permisos siguen funcionando igual).
create schema if not exists private;
grant usage on schema private to anon, authenticated;
alter function public.owns_business(uuid) set schema private;
alter function public.business_is_public(uuid) set schema private;
alter function public.staff_business(uuid) set schema private;
alter function public.service_business(uuid) set schema private;
