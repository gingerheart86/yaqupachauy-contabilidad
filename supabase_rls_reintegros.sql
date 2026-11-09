-- ============================================================
-- RLS: limpieza de reglas duplicadas + solo el admin hace reintegros
-- Aplicado: 2026-11-09
--
-- Integrantes: pueden SOLICITAR (crear reintegro 'pending' propio),
--              retirar su solicitud pendiente y vincular/desvincular sus gastos.
-- Admin:       único que puede pagar, marcar gastos como reintegrados,
--              modificar reintegros o crearlos a nombre de otra integrante.
-- ============================================================

begin;

-- Helper: ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- ── EXPENSES: quitar duplicadas (comportamiento efectivo igual) ──
drop policy if exists "expenses_delete_admin"                        on public.expenses; -- dup de "admin puede eliminar gastos"
drop policy if exists "expenses_select_own"                          on public.expenses; -- dup de "usuarios ven sus gastos"
drop policy if exists "expenses_insert_own"                          on public.expenses; -- más restrictiva, ya anulada por "usuarios pueden insertar gastos"
drop policy if exists "admin puede actualizar gastos"                on public.expenses;
drop policy if exists "expenses_update_own"                          on public.expenses;
drop policy if exists "users can link own expenses to reimbursement" on public.expenses;

create policy "gastos update" on public.expenses
  for update to authenticated
  using      (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Solo el admin puede cambiar los campos de "reintegrado" de un gasto
create or replace function public.expenses_guard_reimbursed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.reimbursed    is distinct from old.reimbursed or
       new.reimbursed_at is distinct from old.reimbursed_at or
       new.reimbursed_by is distinct from old.reimbursed_by
     ) then
    raise exception 'Solo el admin puede marcar gastos como reintegrados';
  end if;
  -- Una integrante no puede mover un gasto ya reintegrado a otra solicitud
  if auth.uid() is not null and not public.is_admin()
     and old.reimbursed and new.reimbursement_id is distinct from old.reimbursement_id then
    raise exception 'El gasto ya fue reintegrado';
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_guard_reimbursed on public.expenses;
create trigger expenses_guard_reimbursed
  before update on public.expenses
  for each row execute function public.expenses_guard_reimbursed();

-- ── REIMBURSEMENTS ──
drop policy if exists "users see own reimbursements"    on public.reimbursements; -- dup de "reintegros select"
drop policy if exists "users create own reimbursements" on public.reimbursements;
drop policy if exists "reintegros insert"               on public.reimbursements;
drop policy if exists "reintegros update"               on public.reimbursements;
drop policy if exists "admin updates reimbursements"    on public.reimbursements;
drop policy if exists "reintegros delete"               on public.reimbursements;

-- Integrante: solo solicitudes propias, pendientes y sin datos de pago. Admin: cualquiera.
create policy "reintegros insert" on public.reimbursements
  for insert to authenticated
  with check (
    public.is_admin() or
    (user_id = auth.uid() and status = 'pending' and paid_at is null and paid_by is null)
  );

-- Solo el admin modifica (pagar / deshacer pago)
create policy "reintegros update" on public.reimbursements
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Integrante: retirar solo su solicitud pendiente. Admin: cualquiera.
create policy "reintegros delete" on public.reimbursements
  for delete to authenticated
  using (public.is_admin() or (user_id = auth.uid() and status = 'pending'));

commit;
