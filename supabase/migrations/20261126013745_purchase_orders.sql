create table public.purchase_orders (
 user_id uuid not null references auth.users(id), id uuid not null, number bigint not null,
 supplier_id uuid not null, supplier_name text not null, ordered_on date not null, delivery_on date,
 status text not null default 'rascunho' check(status in ('rascunho','emitido','cancelado')),
 notes text not null, items jsonb not null, subtotal numeric not null, discount numeric not null, freight numeric not null,
 total numeric generated always as (subtotal-discount+freight) stored, revision integer not null default 1,
 created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 issued_by uuid, issued_at timestamptz, cancelled_by uuid, cancelled_at timestamptz, cancellation_reason text,
 primary key(user_id,id), unique(user_id,number), foreign key(user_id,supplier_id) references public.suppliers(user_id,id)
);
create table public.purchase_operations (
 user_id uuid not null, operation_id uuid not null, request jsonb not null,
 primary key(user_id,operation_id)
);
alter table public.purchase_orders enable row level security;
alter table public.purchase_operations enable row level security;
revoke all on public.purchase_orders,public.purchase_operations from public,anon,authenticated;
grant select on public.purchase_orders to authenticated;
create policy purchase_order_owner on public.purchase_orders for select to authenticated using(user_id=(select auth.uid()));
create function public.change_purchase_order(p jsonb) returns void language plpgsql security definer set search_path='' as $$
<<vars>>
declare u uuid:=auth.uid(); k uuid:=(p->>'id')::uuid; op uuid:=(p->>'operation')::uuid;
 action text:=p->>'action'; old public.purchase_orders%rowtype; previous jsonb; s public.suppliers%rowtype;
 x record; line jsonb; lines jsonb:='[]'; stock_unit text; item_name text; item_code text;
 subtotal numeric:=0; discount numeric:=coalesce((p->>'discount')::numeric,0); freight numeric:=coalesce((p->>'freight')::numeric,0);
 factor numeric; receipt numeric; order_date date:=(p->>'date')::date; delivery date:=nullif(p->>'delivery','')::date;
begin
 if u is null then raise exception 'Sessão necessária.';end if;
 perform pg_advisory_xact_lock(hashtextextended('purchase:'||u::text,0));
 select request into previous from public.purchase_operations where user_id=u and operation_id=op;
 if found then
  if previous is distinct from p then raise exception 'Operação já utilizada.';end if;
  return;
 end if;
 select * into old from public.purchase_orders where user_id=u and id=k for update;
 if old.revision is distinct from nullif((p->>'revision')::int,0) then raise exception 'Pedido alterado em outra sessão. Reabra o pedido.';end if;
 if action='cancelar' then
  if old.id is null or old.status='cancelado' or coalesce(length(btrim(p->>'reason')),0) not between 1 and 500 then raise exception 'Informe o motivo do cancelamento.';end if;
  update public.purchase_orders set status='cancelado',cancelled_by=u,cancelled_at=now(),cancellation_reason=btrim(p->>'reason'),revision=revision+1,updated_at=now() where user_id=u and id=k;
 else
  if action is null or action not in ('salvar','emitir') or (old.id is not null and old.status<>'rascunho') then raise exception 'Somente rascunhos podem ser alterados.';end if;
  select * into s from public.suppliers where user_id=u and id=(p->>'supplier')::uuid for share;
  if not found or (not s.active and (old.supplier_id is distinct from s.id or action='emitir')) then raise exception 'Fornecedor indisponível.';end if;
  if order_date is null or delivery<order_date or jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 200 then raise exception 'Confira as datas e inclua pelo menos um item.';end if;
  if discount not between 0 and 9999999999 or freight not between 0 and 9999999999 or discount<>round(discount,2) or freight<>round(freight,2) then raise exception 'Confira desconto e frete.';end if;
  for x in select * from jsonb_to_recordset(p->'items') as i(id text,kind text,buy_unit text,content_unit text,qty numeric,content numeric,price numeric) loop
   if x.kind='ingrediente' then select name,id,unit into item_name,item_code,stock_unit from public.materials where user_id=u and id=x.id;
   elsif x.kind='embalagem' then select name,code,use_unit into item_name,item_code,stock_unit from public.packaging where user_id=u and id=x.id::uuid and active;
   else raise exception 'Tipo de material inválido.';end if;
   if not found then raise exception 'Material indisponível.';end if;
   if coalesce(length(btrim(x.buy_unit)),0) not between 1 and 40 or x.qty is null or x.content is null or x.price is null or x.qty not between 0.0001 and 99999999 or x.content not between 0.0001 and 99999999 or x.price not between 0 and 9999999999 or x.qty<>round(x.qty,4) or x.content<>round(x.content,4) or x.price<>round(x.price,2) then raise exception 'Confira quantidades, unidade de compra e preço.';end if;
   factor:=case when x.content_unit=stock_unit then 1 when (x.content_unit,stock_unit) in (('g','kg'),('ml','L')) then 0.001 when (x.content_unit,stock_unit) in (('kg','g'),('L','ml')) then 1000 end;
   if factor is null then raise exception 'Unidade incompatível com o estoque.';end if;
   receipt:=x.qty*x.content*factor;
   if stock_unit='unidade' and receipt<>trunc(receipt) then raise exception 'O recebimento em unidades deve ser inteiro.';end if;
   subtotal:=subtotal+x.qty*x.price;
   line:=to_jsonb(x)||jsonb_build_object('name',item_name,'code',item_code,'stock_unit',stock_unit,'receipt',receipt,'total',x.qty*x.price,'line_id',gen_random_uuid());
   lines:=lines||jsonb_build_array(line);
  end loop;
  if discount>subtotal then raise exception 'Desconto superior ao subtotal.';end if;
  if old.id is null then
   insert into public.purchase_orders(user_id,id,number,supplier_id,supplier_name,ordered_on,delivery_on,notes,items,subtotal,discount,freight,created_by)
   values(u,k,(select coalesce(max(number),0)+1 from public.purchase_orders where user_id=u),s.id,s.name,order_date,delivery,coalesce(p->>'notes',''),lines,vars.subtotal,vars.discount,vars.freight,u);
  else
   update public.purchase_orders set supplier_id=s.id,supplier_name=s.name,ordered_on=order_date,delivery_on=delivery,notes=coalesce(p->>'notes',''),items=lines,subtotal=vars.subtotal,discount=vars.discount,freight=vars.freight,updated_at=now(),revision=revision+1 where user_id=u and id=k;
  end if;
  if action='emitir' then update public.purchase_orders set status='emitido',issued_by=u,issued_at=now() where user_id=u and id=k;end if;
 end if;
 insert into public.purchase_operations values(u,op,p);
end $$;
revoke all on function public.change_purchase_order(jsonb) from public,anon;
grant execute on function public.change_purchase_order(jsonb) to authenticated;
