alter table public.purchase_orders drop constraint purchase_orders_status_check;
alter table public.purchase_orders add constraint purchase_orders_status_check check(status in ('rascunho','emitido','cancelado','parcialmente recebido','recebido'));
create table public.purchase_receipts (
 user_id uuid not null, id uuid not null, order_id uuid not null, number bigint not null,
 received_on date not null, invoice text not null, notes text not null, received_by uuid not null,
 created_at timestamptz not null default clock_timestamp(), items jsonb not null, request jsonb not null,
 primary key(user_id,id), unique(user_id,number), foreign key(user_id,order_id) references public.purchase_orders(user_id,id)
);
create index purchase_receipts_order on public.purchase_receipts(user_id,order_id);
alter table public.purchase_receipts enable row level security;
revoke all on public.purchase_receipts from public,anon,authenticated;
grant select on public.purchase_receipts to authenticated;
create policy purchase_receipt_owner on public.purchase_receipts for select to authenticated using(user_id=(select auth.uid()));
create function public.prevent_received_cancellation() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='cancelado' and old.status in ('parcialmente recebido','recebido') then raise exception 'Pedido com recebimento não pode ser cancelado.';end if;
 return new;
end $$;
create trigger prevent_received_cancellation before update of status on public.purchase_orders for each row execute function public.prevent_received_cancellation();
create function public.receive_purchase(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); op uuid:=(p->>'operation')::uuid; oid uuid:=(p->>'order')::uuid;
 d date:=(p->>'date')::date; o public.purchase_orders%rowtype; previous jsonb; n bigint;
 row record; source jsonb; delivered numeric; recorded jsonb:='[]'; movement uuid; actual_unit text; memo text;
 complete boolean; touched_ingredients boolean:=false;
begin
 if u is null or op is null or oid is null then raise exception 'Recebimento inválido.';end if;
 perform pg_advisory_xact_lock(hashtextextended('purchase:'||u::text,0));
 select request into previous from public.purchase_receipts where user_id=u and id=op;
 if found then
  if previous is distinct from p then raise exception 'Operação já utilizada.';end if;
  return;
 end if;
 select * into o from public.purchase_orders where user_id=u and id=oid for update;
 if not found or o.status not in ('emitido','parcialmente recebido') then raise exception 'Pedido indisponível para recebimento.';end if;
 if o.revision is distinct from (p->>'revision')::int then raise exception 'Pedido alterado. Reabra para conferir as quantidades.';end if;
 if d is null or d>(now() at time zone 'America/Sao_Paulo')::date or length(coalesce(p->>'invoice',''))>100 or length(coalesce(p->>'notes',''))>4000 or jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 200 then raise exception 'Confira a data e os itens do recebimento.';end if;
 if exists(select from jsonb_to_recordset(p->'items') x(line_id uuid,qty numeric) group by line_id having count(*)>1) then raise exception 'Item repetido.';end if;
 insert into public.business_revisions(user_id) values(u) on conflict do nothing;
 perform 1 from public.business_revisions where user_id=u for update;
 select coalesce(max(number),0)+1 into n from public.purchase_receipts where user_id=u;
 memo:=format('Pedido #%s · Recebimento #%s',o.number,n);
 for row in select * from jsonb_to_recordset(p->'items') x(line_id uuid,qty numeric) order by line_id loop
  select j into source from jsonb_array_elements(o.items) j where j->>'line_id'=row.line_id::text;
  if not found or row.qty is null or row.qty not between 0.0001 and 99999999999.9999 or row.qty<>round(row.qty,4) then raise exception 'Item ou quantidade inválida.';end if;
  select coalesce(sum((i->>'qty')::numeric),0) into delivered from public.purchase_receipts r cross join lateral jsonb_array_elements(r.items) i where r.user_id=u and r.order_id=oid and i->>'line_id'=row.line_id::text;
  if delivered+row.qty>(source->>'receipt')::numeric then raise exception 'Quantidade superior à pendente.';end if;
  if source->>'stock_unit' in ('unidade','pacote') and row.qty<>trunc(row.qty) then raise exception 'A quantidade deve ser inteira.';end if;
  movement:=gen_random_uuid();
  if source->>'kind'='ingrediente' then
   select unit into actual_unit from public.materials where user_id=u and id=source->>'id' for update;
   if not found or actual_unit is distinct from source->>'stock_unit' then raise exception 'Ingrediente indisponível ou unidade alterada.';end if;
   update public.materials set quantity=quantity+row.qty where user_id=u and id=source->>'id';
   insert into public.stock_movements(id,user_id,"materialId",kind,quantity,note,"createdAt")
   values(movement::text,u,source->>'id','entrada',row.qty,memo,clock_timestamp());
   touched_ingredients:=true;
  elsif source->>'kind'='embalagem' then
   perform public.move_packaging_stock((source->>'id')::uuid,movement,'entrada',row.qty,source->>'stock_unit',d,memo,'',null);
  else raise exception 'Tipo de item inválido.';end if;
  recorded:=recorded||jsonb_build_array(jsonb_build_object('line_id',row.line_id,'qty',row.qty,'name',source->>'name','unit',source->>'stock_unit','kind',source->>'kind','movement_id',movement));
 end loop;
 insert into public.purchase_receipts(user_id,id,order_id,number,received_on,invoice,notes,received_by,items,request)
 values(u,op,oid,n,d,coalesce(p->>'invoice',''),coalesce(p->>'notes',''),u,recorded,p);
 select not exists(select from jsonb_array_elements(o.items) j where (j->>'receipt')::numeric>
   (select coalesce(sum((i->>'qty')::numeric),0) from public.purchase_receipts r cross join lateral jsonb_array_elements(r.items) i where r.user_id=u and r.order_id=oid and i->>'line_id'=j->>'line_id')) into complete;
 update public.purchase_orders set status=case when complete then 'recebido' else 'parcialmente recebido' end,revision=revision+1,updated_at=now() where user_id=u and id=oid;
 if touched_ingredients then update public.business_revisions set revision=revision+1 where user_id=u;end if;
end $$;
revoke all on function public.receive_purchase(jsonb) from public,anon;
grant execute on function public.receive_purchase(jsonb) to authenticated;
