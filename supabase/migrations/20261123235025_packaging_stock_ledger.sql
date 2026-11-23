alter table public.packaging
 add column stock_balance numeric(15,4) not null default 0 check (stock_balance>=0),
 add column last_stock_at timestamptz,
 add constraint packaging_owner_identity unique(user_id,id);
create table public.packaging_stock_movements (
 user_id uuid not null, operation_id uuid not null, packaging_id uuid not null,
 responsible uuid not null, kind text not null check(kind in ('entrada','saida','perda','ajuste')),
 quantity numeric(15,4) not null check(quantity>=0), unit text not null,
 previous_balance numeric(15,4) not null check(previous_balance>=0),
 new_balance numeric(15,4) not null check(new_balance>=0),
 movement_date date not null, recorded_at timestamptz not null,
 reason text not null, notes text not null,
 primary key(user_id,operation_id),
 foreign key(user_id,packaging_id) references public.packaging(user_id,id)
);
create index packaging_stock_history on public.packaging_stock_movements(user_id,packaging_id,recorded_at desc);
create index packaging_stock_period on public.packaging_stock_movements(user_id,movement_date);
alter table public.packaging_stock_movements enable row level security;
revoke all on public.packaging_stock_movements from public, anon, authenticated;
grant select on public.packaging_stock_movements to authenticated;
create policy packaging_stock_read on public.packaging_stock_movements for select to authenticated using(user_id=(select auth.uid()));
create function public.guard_packaging_stock_unit() returns trigger language plpgsql set search_path='' as $$
begin
 if old.last_stock_at is not null and new.use_unit<>old.use_unit then raise exception 'A unidade não pode mudar após uma movimentação.'; end if;
 return new;
end $$;
create trigger packaging_stock_unit before update of use_unit on public.packaging for each row execute function public.guard_packaging_stock_unit();

-- Only this authenticated operation can append to the ledger and change the balance.
create function public.move_packaging_stock(p_item uuid,p_operation uuid,p_kind text,p_quantity numeric,p_unit text,p_date date,p_reason text,p_notes text,p_expected numeric)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); item public.packaging%rowtype; prior public.packaging_stock_movements%rowtype;
 next_balance numeric; stamp timestamptz;
begin
 select * into item from public.packaging where user_id=owner_id and id=p_item for update;
 if not found then raise exception 'Embalagem indisponível.';end if;
 select * into prior from public.packaging_stock_movements where user_id=owner_id and operation_id=p_operation;
 if found then
  if (prior.packaging_id,prior.kind,prior.quantity,prior.unit,prior.movement_date,prior.reason,prior.notes)
    is distinct from (p_item,p_kind,p_quantity,p_unit,p_date,btrim(p_reason),btrim(p_notes)) then raise exception 'Identificador já utilizado em outra operação.';end if;
  return;
 end if;
 if not item.active then raise exception 'Embalagem inativa.';end if;
 if p_unit is distinct from item.use_unit then raise exception 'Unidade incompatível.';end if;
 if p_quantity is null or p_quantity not between 0 and 99999999999.9999 or round(p_quantity,4)<>p_quantity
 or (p_kind<>'ajuste' and p_quantity=0) or (p_unit='unidade' and trunc(p_quantity)<>p_quantity) then raise exception 'Quantidade inválida para a unidade.';end if;
 if p_date is null or p_date>(now() at time zone 'America/Sao_Paulo')::date or coalesce(length(btrim(p_reason)),0) not between 1 and 300 or p_notes is null or length(p_notes)>2000 then raise exception 'Confira a data, o motivo e as observações.';end if;
 case p_kind when 'entrada' then next_balance:=item.stock_balance+p_quantity;
 when 'saida','perda' then next_balance:=item.stock_balance-p_quantity;
 when 'ajuste' then
  if item.stock_balance is distinct from p_expected then raise exception 'Saldo alterado. Confira novamente antes de ajustar.';end if;
  next_balance:=p_quantity;
 else raise exception 'Tipo de movimentação inválido.';end case;
 if next_balance<0 then raise exception 'Saldo insuficiente.';end if;
 stamp:=clock_timestamp();
 insert into public.packaging_stock_movements values(owner_id,p_operation,p_item,owner_id,p_kind,p_quantity,p_unit,item.stock_balance,next_balance,p_date,stamp,btrim(p_reason),btrim(p_notes));
 update public.packaging set stock_balance=next_balance,last_stock_at=stamp where user_id=owner_id and id=p_item;
end $$;
revoke all on function public.move_packaging_stock(uuid,uuid,text,numeric,text,date,text,text,numeric) from public,anon;
grant execute on function public.move_packaging_stock(uuid,uuid,text,numeric,text,date,text,text,numeric) to authenticated;
