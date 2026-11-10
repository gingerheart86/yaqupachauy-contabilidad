-- Deshacer el pago de un reintegro en una sola transacción:
-- devuelve a cada crédito lo que se le había descontado, borra esos usos,
-- vuelve la solicitud a 'pending' y desmarca sus gastos. Solo admins.
create or replace function public.undo_reimbursement_payment(p_reimbursement_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el admin puede deshacer pagos';
  end if;

  update credits c
     set remaining = least(c.amount, c.remaining + a.total)
    from (select credit_id, sum(amount) total
            from credit_applications
           where reimbursement_id = p_reimbursement_id
           group by credit_id) a
   where c.id = a.credit_id;

  delete from credit_applications where reimbursement_id = p_reimbursement_id;

  update reimbursements
     set status = 'pending', paid_at = null, paid_by = null
   where id = p_reimbursement_id;

  update expenses
     set reimbursed = false, reimbursed_at = null, reimbursed_by = null
   where reimbursement_id = p_reimbursement_id;
end;
$$;

revoke execute on function public.undo_reimbursement_payment(uuid) from public, anon;
grant  execute on function public.undo_reimbursement_payment(uuid) to authenticated;
