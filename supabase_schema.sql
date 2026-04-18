-- ============================================================
-- YAQUPACHAUY · Sistema de contabilidad
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Habilitar extensión para UUIDs
create extension if not exists "uuid-ossp";

-- ============================================================
-- PERFILES DE USUARIO
-- Extiende la tabla auth.users de Supabase
-- ============================================================
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  created_at  timestamptz default now()
);

-- Trigger: crear perfil automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PROYECTOS
-- ============================================================
create table public.projects (
  id            uuid default uuid_generate_v4() primary key,
  name          text not null,
  description   text,
  start_date    date,
  end_date      date,
  budget_usd    numeric(12,2),   -- presupuesto en USD (opcional)
  budget_uyu    numeric(12,2),   -- presupuesto en pesos uruguayos (opcional)
  active        boolean default true,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now()
);

-- ============================================================
-- CATEGORÍAS DE GASTO
-- ============================================================
create table public.categories (
  id    serial primary key,
  name  text not null unique,
  icon  text  -- emoji o nombre de ícono
);

-- Categorías base
insert into public.categories (name, icon) values
  ('Logística / Transporte', '🚗'),
  ('Investigación', '🔬'),
  ('Educación ambiental', '📚'),
  ('Equipamiento', '🛠️'),
  ('Comunicación / Difusión', '📢'),
  ('Alimentación', '🍽️'),
  ('Alojamiento', '🏕️'),
  ('Veterinaria / Biología', '🐋'),
  ('Administrativo', '📋'),
  ('Otro', '📦');

-- ============================================================
-- GASTOS
-- ============================================================
create table public.expenses (
  id                  uuid default uuid_generate_v4() primary key,
  project_id          uuid not null references public.projects(id) on delete restrict,
  category_id         integer not null references public.categories(id),
  user_id             uuid not null references public.profiles(id),
  description         text not null,
  amount              numeric(12,2) not null check (amount > 0),
  currency            text not null default 'USD' check (currency in ('USD', 'UYU')),
  expense_date        date not null default current_date,
  payment_type        text not null default 'institutional'
                        check (payment_type in ('institutional', 'personal')),
                        -- institutional: pagó la ONG directamente
                        -- personal: pagó el integrante, necesita reintegro
  notes               text,
  receipt_url         text,   -- URL del archivo en Supabase Storage
  receipt_filename    text,
  reimbursed          boolean default false,
  reimbursed_at       timestamptz,
  reimbursed_by       uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Índices para búsquedas frecuentes
create index expenses_project_id_idx on public.expenses(project_id);
create index expenses_user_id_idx on public.expenses(user_id);
create index expenses_expense_date_idx on public.expenses(expense_date);
create index expenses_payment_type_idx on public.expenses(payment_type);

-- Trigger: actualizar updated_at automáticamente
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles  enable row level security;
alter table public.projects   enable row level security;
alter table public.categories enable row level security;
alter table public.expenses   enable row level security;

-- Perfiles: cada uno ve el suyo; admins ven todos
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Proyectos: todos los autenticados pueden ver y crear
create policy "projects_select" on public.projects
  for select using (auth.role() = 'authenticated');

create policy "projects_insert" on public.projects
  for insert with check (auth.role() = 'authenticated');

create policy "projects_update_admin" on public.projects
  for update using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Categorías: solo lectura para todos
create policy "categories_select" on public.categories
  for select using (auth.role() = 'authenticated');

-- Gastos: cada uno ve los suyos; admins ven todos
create policy "expenses_select_own" on public.expenses
  for select using (
    user_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "expenses_insert_own" on public.expenses
  for insert with check (user_id = auth.uid());

create policy "expenses_update_own" on public.expenses
  for update using (
    user_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "expenses_delete_admin" on public.expenses
  for delete using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ============================================================
-- STORAGE: bucket para comprobantes
-- ============================================================
-- Ejecutar en Supabase Dashboard > Storage > New bucket
-- Nombre: "receipts", tipo: Private
-- O descomentar estas líneas si tu versión de Supabase lo soporta:
-- insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

-- Policy de storage: solo el dueño del gasto puede subir/ver su comprobante
-- (configurar en Dashboard > Storage > receipts > Policies)
