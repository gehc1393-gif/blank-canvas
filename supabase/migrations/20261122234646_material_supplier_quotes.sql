create unique index suppliers_owner_id on public.suppliers(user_id,id);

create table public.material_suppliers (
  user_id uuid not null,
  material_id text not null,
  supplier_id uuid not null,
  notes text not null default '' check (length(notes)<=3000),
  is_primary boolean not null default false,
  primary key(user_id,material_id,supplier_id),
  -- The stock transaction replaces material rows and restores their IDs before commit.
  foreign key(user_id,material_id) references public.materials(user_id,id) deferrable initially deferred,
  foreign key(user_id,supplier_id) references public.suppliers(user_id,id)
);
create unique index material_supplier_primary on public.material_suppliers(user_id,material_id) where is_primary;
create table public.supplier_quotes (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  material_id text not null,
  supplier_id uuid not null,
  package_price numeric(16,2) not null check(package_price>0),
  package_quantity numeric(18,6) not null check(package_quantity>0),
  unit text not null,
  quoted_on date not null,
  recorded_at timestamptz not null default clock_timestamp(),
  recorded_by uuid not null,
  foreign key(user_id,material_id,supplier_id) references public.material_suppliers
);
create index supplier_quote_history on public.supplier_quotes(user_id,material_id,supplier_id,quoted_on desc,id desc);
alter table public.material_suppliers enable row level security;
alter table public.supplier_quotes enable row level security;
revoke all on public.material_suppliers,public.supplier_quotes from public, anon, authenticated;
grant select on public.material_suppliers,public.supplier_quotes to authenticated;
create policy own_material_suppliers on public.material_suppliers for select to authenticated using(user_id=(select auth.uid()));
create policy own_supplier_quotes on public.supplier_quotes for select to authenticated using(user_id=(select auth.uid()));

create function public.save_material_supplier(
  p_material text,p_supplier uuid,p_action text,p_notes text default '',p_price numeric default null,
  p_quantity numeric default null,p_unit text default null,p_date date default null
) returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid := auth.uid(); material_unit text;
begin
  if owner_id is null then raise exception 'Sessão necessária.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || p_material,0));
  select unit into strict material_unit from public.materials where user_id=owner_id and id=p_material;
  if p_action='link' then
    if not exists(select from public.suppliers where user_id=owner_id and id=p_supplier and active) then raise exception 'Fornecedor indisponível.'; end if;
    insert into public.material_suppliers(user_id,material_id,supplier_id,notes) values(owner_id,p_material,p_supplier,p_notes);
    return;
  end if;
  if not exists(select from public.material_suppliers where user_id=owner_id and material_id=p_material and supplier_id=p_supplier) then raise exception 'Vínculo indisponível.'; end if;
  if p_action='notes' then
    update public.material_suppliers set notes=p_notes where user_id=owner_id and material_id=p_material and supplier_id=p_supplier;
  elsif p_action='primary' then
    update public.material_suppliers set is_primary=false where user_id=owner_id and material_id=p_material and is_primary;
    update public.material_suppliers set is_primary=true where user_id=owner_id and material_id=p_material and supplier_id=p_supplier;
  elsif p_action='quote' then
    if p_date > (now() at time zone 'America/Sao_Paulo')::date or
       not (p_unit=material_unit or (material_unit in ('g','kg') and p_unit in ('g','kg')) or
       (material_unit in ('ml','L') and p_unit in ('ml','L'))) or
       p_price::text in ('NaN','Infinity') or p_quantity::text in ('NaN','Infinity') or
       round(p_price,2)<>p_price or round(p_quantity,6)<>p_quantity then raise exception 'Cotação inválida.'; end if;
    insert into public.supplier_quotes(user_id,material_id,supplier_id,package_price,package_quantity,unit,quoted_on,recorded_by)
    values(owner_id,p_material,p_supplier,p_price,p_quantity,p_unit,p_date,owner_id);
  else raise exception 'Operação inválida.'; end if;
end $$;
revoke all on function public.save_material_supplier(text,uuid,text,text,numeric,numeric,text,date) from public,anon;
grant execute on function public.save_material_supplier(text,uuid,text,text,numeric,numeric,text,date) to authenticated;
create function public.material_supplier_details(p_material text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(details) order by details.name,details.supplier_id),'[]'::jsonb)
 from (
 select l.supplier_id,s.name,s.active,l.notes,l.is_primary,coalesce((
   select jsonb_agg(jsonb_build_object('price',q.package_price,'quantity',q.package_quantity,'unit',q.unit,
     'date',q.quoted_on,'recorded',q.recorded_at,'author',q.recorded_by,
     'equivalent',q.package_price*(case when q.unit in ('g','ml') then 1000 else 1 end)/q.package_quantity)
     order by q.quoted_on desc,q.id desc)
   from public.supplier_quotes q where (q.user_id,q.material_id,q.supplier_id)=(l.user_id,l.material_id,l.supplier_id)
 ),'[]'::jsonb) as history
 from public.material_suppliers l join public.suppliers s on (l.user_id,l.supplier_id)=(s.user_id,s.id)
 where l.user_id=auth.uid() and l.material_id=p_material
 ) details
$$;
revoke all on function public.material_supplier_details(text) from public,anon;
grant execute on function public.material_supplier_details(text) to authenticated;
