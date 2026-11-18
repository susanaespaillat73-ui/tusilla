-- =====================================================================
-- 002 · Planes, prueba gratis, pagos y panel de administración
-- Correr después de schema.sql (Supabase → SQL Editor → Run).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Planes (se editan desde /admin)
-- ---------------------------------------------------------------------
create table public.plans (
  id          text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  name        text not null check (char_length(name) between 2 and 40),
  price       numeric(10,2) not null check (price >= 0),
  max_staff   int  not null check (max_staff between 1 and 500),
  description text not null default '',
  is_active   boolean not null default true,
  sort        int  not null default 0
);
insert into public.plans (id, name, price, max_staff, description, sort) values
  ('individual', 'Individual', 990,  1,  'Para quien atiende sola o solo', 1),
  ('equipo',     'Equipo',     1990, 4,  'Hasta 4 profesionales',          2),
  ('salon',      'Salón',      3490, 10, 'Hasta 10 profesionales',         3);

-- ---------------------------------------------------------------------
-- Administradores de la plataforma y ajustes generales
-- ---------------------------------------------------------------------
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  id                   int primary key default 1 check (id = 1),
  trial_days           int  not null default 15 check (trial_days between 0 and 90),
  grace_days           int  not null default 5  check (grace_days between 0 and 30),
  trial_max_staff      int  not null default 10 check (trial_max_staff between 1 and 500),
  payment_instructions text not null default 'Escríbenos por WhatsApp para recibir los datos de pago.',
  support_whatsapp     text not null default '',
  updated_at           timestamptz not null default now()
);
insert into public.platform_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Estado de la cuenta de cada negocio
-- ---------------------------------------------------------------------
alter table public.businesses
  add column plan_id       text references public.plans(id) on update cascade,
  add column trial_ends_at timestamptz,
  add column paid_until    timestamptz,
  add column suspended     boolean not null default false;

update public.businesses
set plan_id = 'individual', trial_ends_at = created_at + interval '15 days'
where plan_id is null;
alter table public.businesses alter column plan_id set not null;

-- Notas internas: solo las ve quien administra la plataforma
create table public.business_admin_notes (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  plan_id      text references public.plans(id) on update cascade,
  amount       numeric(10,2) not null check (amount >= 0),
  months       int not null check (months between 1 and 36),
  method       text not null default 'transferencia' check (method in ('transferencia','efectivo','tarjeta','otro')),
  note         text not null default '',
  period_start timestamptz not null,
  period_end   timestamptz not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index payments_business_idx on public.payments(business_id, created_at desc);

-- ---------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- trial | active | grace | expired | suspended
create or replace function private.account_state(b public.businesses) returns text
language sql stable security definer set search_path = public as $$
  select case
    when b.suspended then 'suspended'
    when b.paid_until is not null and b.paid_until > now() then 'active'
    when b.trial_ends_at is not null and b.trial_ends_at > now() then 'trial'
    when greatest(coalesce(b.paid_until, '-infinity'), coalesce(b.trial_ends_at, '-infinity'))
         + make_interval(days => (select grace_days from platform_settings where id = 1)) > now() then 'grace'
    else 'expired'
  end;
$$;

create or replace function private.can_book(b public.businesses) returns boolean
language sql stable security definer set search_path = public as $$
  select b.is_published and private.account_state(b) in ('trial', 'active', 'grace');
$$;

-- El negocio no puede cambiarse su plan, su prueba ni su fecha de pago.
create or replace function private.protect_business_account() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_trial int; v_plan text;
begin
  select trial_days into v_trial from platform_settings where id = 1;
  select id into v_plan from plans where is_active order by sort, price limit 1;
  if tg_op = 'INSERT' then
    if private.is_admin() or auth.uid() is null then
      new.plan_id := coalesce(new.plan_id, v_plan);
      new.trial_ends_at := coalesce(new.trial_ends_at, now() + make_interval(days => v_trial));
    else
      new.plan_id := v_plan;
      new.trial_ends_at := now() + make_interval(days => v_trial);
      new.paid_until := null;
      new.suspended := false;
    end if;
  elsif not (private.is_admin() or auth.uid() is null) then
    new.owner_id := old.owner_id;
    new.plan_id := old.plan_id;
    new.trial_ends_at := old.trial_ends_at;
    new.paid_until := old.paid_until;
    new.suspended := old.suspended;
  end if;
  return new;
end $$;
create trigger businesses_protect_account
  before insert or update on public.businesses
  for each row execute function private.protect_business_account();

-- Límite de profesionales activas según el plan (durante la prueba: trial_max_staff).
create or replace function private.enforce_staff_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare b businesses; v_limit int; v_count int;
begin
  if not new.is_active then return new; end if;
  if tg_op = 'UPDATE' and old.is_active then return new; end if;
  if private.is_admin() or auth.uid() is null then return new; end if;
  select * into b from businesses where id = new.business_id;
  if private.account_state(b) = 'trial' then
    select trial_max_staff into v_limit from platform_settings where id = 1;
  else
    select max_staff into v_limit from plans where id = b.plan_id;
  end if;
  select count(*) into v_count from staff where business_id = new.business_id and is_active and id <> new.id;
  if v_count >= coalesce(v_limit, 1) then
    raise exception 'plan_limit:%', v_limit;
  end if;
  return new;
end $$;
create trigger staff_plan_limit
  before insert or update on public.staff
  for each row execute function private.enforce_staff_limit();

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
alter table public.plans                enable row level security;
alter table public.platform_admins      enable row level security;
alter table public.platform_settings    enable row level security;
alter table public.business_admin_notes enable row level security;
alter table public.payments             enable row level security;

create policy plans_read  on public.plans for select using (true);
create policy plans_admin on public.plans for all using (private.is_admin()) with check (private.is_admin());

create policy admins_admin on public.platform_admins for select using (private.is_admin());

create policy settings_admin on public.platform_settings for all using (private.is_admin()) with check (private.is_admin());

create policy notes_admin on public.business_admin_notes for all using (private.is_admin()) with check (private.is_admin());

create policy payments_owner_read on public.payments for select using (private.owns_business(business_id));
create policy payments_admin on public.payments for all using (private.is_admin()) with check (private.is_admin());

-- Quien administra ve y edita todos los negocios
create policy biz_admin on public.businesses for all using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------
-- Reservas: solo negocios con la cuenta al día
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
  if not found or not private.can_book(b) then return; end if;
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
  if not private.can_book(b) then raise exception 'business_inactive'; end if;
  select * into sv from services where id = p_service and business_id = b.id and is_active;
  if not found then raise exception 'service_not_found'; end if;

  select count(*) into v_count from appointments
  where business_id = b.id and customer_phone = v_phone and status = 'confirmed' and starts_at > now();
  if v_count >= 3 then raise exception 'too_many_bookings'; end if;

  v_date := (p_starts_at at time zone tz)::date;

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

-- ¿Este negocio recibe reservas ahora? (para la página pública)
create or replace function public.business_can_book(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select private.can_book(b) from businesses b where b.slug = p_slug), false);
$$;

-- Directorio de la portada: solo negocios publicados y al día
create or replace function public.directory(p_q text default '', p_category text default '')
returns table (slug text, name text, category text, city text, description text, accent text, logo_url text)
language sql stable security definer set search_path = public as $$
  select b.slug, b.name, b.category, b.city, b.description, b.accent, b.logo_url
  from businesses b
  where private.can_book(b)
    and (coalesce(p_category, '') = '' or b.category = p_category)
    and (coalesce(p_q, '') = '' or b.name ilike '%' || p_q || '%' or b.city ilike '%' || p_q || '%' or b.description ilike '%' || p_q || '%')
  order by b.created_at desc
  limit 60;
$$;

-- Estado de la cuenta para el panel del negocio
create or replace function public.my_account() returns json
language plpgsql stable security definer set search_path = public as $$
declare b businesses; s platform_settings; p plans; v_state text; v_limit int;
begin
  select * into b from businesses where owner_id = auth.uid() order by created_at limit 1;
  if not found then return null; end if;
  select * into s from platform_settings where id = 1;
  select * into p from plans where id = b.plan_id;
  v_state := private.account_state(b);
  v_limit := case when v_state = 'trial' then s.trial_max_staff else p.max_staff end;
  return json_build_object(
    'state', v_state,
    'plan', json_build_object('id', p.id, 'name', p.name, 'price', p.price, 'max_staff', p.max_staff),
    'staff_limit', v_limit,
    'staff_active', (select count(*) from staff where business_id = b.id and is_active),
    'trial_ends_at', b.trial_ends_at,
    'paid_until', b.paid_until,
    'grace_until', greatest(coalesce(b.paid_until, '-infinity'), coalesce(b.trial_ends_at, '-infinity'))
                   + make_interval(days => s.grace_days),
    'payment_instructions', s.payment_instructions,
    'support_whatsapp', s.support_whatsapp,
    'plans', (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'price', price, 'max_staff', max_staff, 'description', description) order by sort, price), '[]') from plans where is_active),
    'payments', (select coalesce(json_agg(json_build_object('amount', amount, 'months', months, 'method', method, 'period_end', period_end, 'created_at', created_at) order by created_at desc), '[]')
                 from (select * from payments where business_id = b.id order by created_at desc limit 12) x)
  );
end $$;

-- ---------------------------------------------------------------------
-- Funciones del panel de administración (solo administradores)
-- ---------------------------------------------------------------------
create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin();
$$;

create or replace function public.admin_businesses() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'not_admin'; end if;
  return (
    select coalesce(json_agg(row_to_json(x) order by x.created_at desc), '[]')
    from (
      select b.id, b.slug, b.name, b.category, b.city, b.phone, b.created_at, b.is_published,
             b.plan_id, p.name as plan_name, p.price as plan_price, p.max_staff,
             b.trial_ends_at, b.paid_until, b.suspended,
             private.account_state(b) as state,
             u.email as owner_email,
             coalesce(n.notes, '') as notes,
             (select count(*) from staff s where s.business_id = b.id and s.is_active) as staff_active,
             (select count(*) from services v where v.business_id = b.id and v.is_active) as services_active,
             (select count(*) from appointments a where a.business_id = b.id and a.created_at > now() - interval '30 days') as bookings_30d,
             (select count(*) from appointments a where a.business_id = b.id and a.source = 'online' and a.created_at > now() - interval '30 days') as online_30d,
             (select count(*) from appointments a where a.business_id = b.id and a.status = 'confirmed' and a.starts_at > now()) as upcoming,
             (select max(a.created_at) from appointments a where a.business_id = b.id) as last_booking_at,
             (select coalesce(sum(pm.amount), 0) from payments pm where pm.business_id = b.id) as total_paid
      from businesses b
      join plans p on p.id = b.plan_id
      left join auth.users u on u.id = b.owner_id
      left join business_admin_notes n on n.business_id = b.id
    ) x
  );
end $$;

create or replace function public.admin_record_payment(
  p_business uuid, p_amount numeric, p_months int, p_method text default 'transferencia', p_note text default ''
) returns json
language plpgsql volatile security definer set search_path = public as $$
declare b businesses; v_start timestamptz; v_end timestamptz;
begin
  if not private.is_admin() then raise exception 'not_admin'; end if;
  select * into b from businesses where id = p_business for update;
  if not found then raise exception 'business_not_found'; end if;
  -- El periodo pagado empieza cuando termina lo ya cubierto (prueba o pago anterior)
  v_start := greatest(now(), coalesce(b.paid_until, '-infinity'), coalesce(b.trial_ends_at, '-infinity'));
  v_end := v_start + make_interval(months => p_months);
  insert into payments (business_id, plan_id, amount, months, method, note, period_start, period_end, created_by)
  values (b.id, b.plan_id, p_amount, p_months, p_method, coalesce(p_note, ''), v_start, v_end, auth.uid());
  update businesses set paid_until = v_end, suspended = false where id = b.id;
  return json_build_object('paid_until', v_end);
end $$;

create or replace function public.admin_overview() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'not_admin'; end if;
  return (
    with st as (select b.*, private.account_state(b) as state, p.price from businesses b join plans p on p.id = b.plan_id)
    select json_build_object(
      'total',      (select count(*) from st),
      'trial',      (select count(*) from st where state = 'trial'),
      'active',     (select count(*) from st where state = 'active'),
      'grace',      (select count(*) from st where state = 'grace'),
      'expired',    (select count(*) from st where state = 'expired'),
      'suspended',  (select count(*) from st where state = 'suspended'),
      'mrr',        (select coalesce(sum(price), 0) from st where state = 'active'),
      'trial_value',(select coalesce(sum(price), 0) from st where state = 'trial'),
      'new_7d',     (select count(*) from st where created_at > now() - interval '7 days'),
      'new_30d',    (select count(*) from st where created_at > now() - interval '30 days'),
      'bookings_30d', (select count(*) from appointments where created_at > now() - interval '30 days'),
      'online_30d',   (select count(*) from appointments where source = 'online' and created_at > now() - interval '30 days'),
      'collected_30d', (select coalesce(sum(amount), 0) from payments where created_at > now() - interval '30 days'),
      'ending_soon', (select count(*) from st where state in ('trial','active')
                       and greatest(coalesce(paid_until, '-infinity'), coalesce(trial_ends_at, '-infinity')) < now() + interval '5 days')
    )
  );
end $$;

revoke all on function public.business_can_book(text) from public;
revoke all on function public.directory(text, text) from public;
revoke all on function public.my_account() from public;
revoke all on function public.am_i_admin() from public;
revoke all on function public.admin_businesses() from public;
revoke all on function public.admin_record_payment(uuid, numeric, int, text, text) from public;
revoke all on function public.admin_overview() from public;
grant execute on function public.business_can_book(text) to anon, authenticated;
grant execute on function public.directory(text, text) to anon, authenticated;
grant execute on function public.my_account() to authenticated;
grant execute on function public.am_i_admin() to authenticated;
grant execute on function public.admin_businesses() to authenticated;
grant execute on function public.admin_record_payment(uuid, numeric, int, text, text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on all functions in schema private to anon, authenticated;
