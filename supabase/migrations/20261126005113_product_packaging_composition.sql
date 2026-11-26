alter table public.packaging add constraint packaging_composition_identity unique(user_id,id,use_unit);
create table public.product_packaging (
 user_id uuid not null, product_id text not null, packaging_id uuid not null, unit text not null,
 quantity numeric(12,4) not null check(quantity>0 and quantity<>'NaN' and (unit<>'unidade' or quantity=trunc(quantity))),
 primary key(user_id,product_id,packaging_id),
 foreign key(user_id,product_id) references public.products(user_id,id) deferrable initially deferred,
 foreign key(user_id,packaging_id,unit) references public.packaging(user_id,id,use_unit)
);
create function public.cleanup_product_packaging() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select from public.products where user_id=old.user_id and id=old.id) then
  delete from public.product_packaging where user_id=old.user_id and product_id=old.id;
 end if;
 return null;
end $$;
create constraint trigger "A_cleanup_product_packaging" after delete on public.products deferrable initially deferred for each row execute function public.cleanup_product_packaging();
alter table public.product_packaging enable row level security;
revoke all on public.product_packaging from public,anon,authenticated;
grant select on public.product_packaging to authenticated;
create policy own_product_packaging on public.product_packaging for select to authenticated using(user_id=(select auth.uid()));
create function public.read_product_packaging(p_product text) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',packaging_id,'quantity',quantity) order by packaging_id),'[]'::jsonb)
 from public.product_packaging where user_id=auth.uid() and product_id=p_product
$$;
create function public.save_product_packaging(p_product text,p_expected jsonb,p_items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); item record;
begin
 perform 1 from public.products where user_id=owner_id and id=p_product for update;
 if not found then raise exception 'Produto indisponível.'; end if;
 if public.read_product_packaging(p_product) is distinct from p_expected then raise exception 'Composição alterada em outra sessão. Reabra o produto.'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Composição inválida.'; end if;
 for item in select x.id,x.quantity,p.id as found_id,p.use_unit,p.active,l.packaging_id as existing
 from jsonb_to_recordset(p_items) x(id uuid,quantity numeric)
 left join public.packaging p on p.user_id=owner_id and p.id=x.id
 left join public.product_packaging l on l.user_id=owner_id and l.product_id=p_product and l.packaging_id=x.id
 loop
  if item.found_id is null or (not item.active and item.existing is null) then raise exception 'Embalagem indisponível.'; end if;
  if item.quantity is null or item.quantity not between 0.0001 and 99999999.9999 or item.quantity<>round(item.quantity,4) or (item.use_unit='unidade' and item.quantity<>trunc(item.quantity)) then raise exception 'Quantidade incompatível com a unidade.'; end if;
  perform 1 from public.packaging where user_id=owner_id and id=item.id and (active or item.existing is not null) for share;
  if not found then raise exception 'Embalagem indisponível.'; end if;
 end loop;
 delete from public.product_packaging where user_id=owner_id and product_id=p_product;
 insert into public.product_packaging(user_id,product_id,packaging_id,unit,quantity)
 select owner_id,p_product,p.id,p.use_unit,x.quantity from jsonb_to_recordset(p_items) x(id uuid,quantity numeric)
 join public.packaging p on p.user_id=owner_id and p.id=x.id;
end $$;
revoke all on function public.read_product_packaging(text),public.save_product_packaging(text,jsonb,jsonb) from public,anon;
grant execute on function public.read_product_packaging(text),public.save_product_packaging(text,jsonb,jsonb) to authenticated;
