-- Synthetic accounts and rows. The inner transaction rolls back after the assertions.
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sa uuid; sb uuid; sh uuid:=gen_random_uuid(); j jsonb; v numeric[]; stage int;
begin
 begin
 insert into auth.users(id) values(a),(b);
 insert into public.materials(user_id,id,name,unit,"unitCost") values(a,'f','Farinha de trigo','kg',8),(a,'m','QA B','kg',44),(b,'f','QA outra conta','kg',1);
 perform set_config('request.jwt.claim.sub',a::text,true);
 insert into public.recipe_sheets(id,user_id,code,name,category,yield_units,ingredients) values(sh,a,'QA','QA ficha','QA',20,'[{"material_id":"f","quantity":500,"unit":"g"}]');
 insert into public.products(user_id,id,name,"batchYield",recipe_sheet_id,units_per_presentation) values(a,'p','QA',20,sh,10);
 insert into public.product_prices values(a,'p',21,now(),now());
 insert into public.productions(user_id,id,"productId",batches,units,ingredient_cost) values(a,'run','p',1,20,3.80);
 set local role authenticated;
 insert into public.suppliers(user_id,name,person_type,document) values(a,'QA A','PF','529.982.247-25') returning id into sa;
 insert into public.suppliers(user_id,name,person_type,document) values(a,'QA B','PJ','04.252.011/0001-10') returning id into sb;
 insert into public.suppliers(user_id,name,person_type) values(a,'QA sem documento','PJ');
 begin insert into public.suppliers(user_id,name,person_type,document) values(a,'QA','PF','52998224725'); raise exception 'dup'; exception when unique_violation then null; end;
 begin insert into public.suppliers(user_id,name,person_type,document) values(a,'QA','PF','52998224726'); raise exception 'cpf'; exception when check_violation then null; end;
 begin insert into public.suppliers(user_id,name,person_type,document) values(a,'QA','PJ','04252011000111'); raise exception 'cnpj'; exception when check_violation then null; end;
 update public.suppliers set phone='QA-83' where id=sa;
 if not exists(select from public.suppliers where id=sa and phone='QA-83') then raise exception 'edit';end if;
 perform public.save_material_supplier('f',sa,'link'); perform public.save_material_supplier('f',sb,'link'); perform public.save_material_supplier('m',sa,'link');
 begin perform public.save_material_supplier('f',sb,'link'); raise exception 'dup'; exception when unique_violation then null; end;
 perform public.save_material_supplier('f',sa,'primary');
 if not exists(select from public.material_suppliers where supplier_id=sa and material_id='f' and is_primary) then raise exception 'principal'; end if;
 perform public.save_material_supplier('f',sb,'primary');
 perform public.save_material_supplier('f',sa,'quote','',30,5,'kg','2026-11-01');
 perform public.save_material_supplier('f',sb,'quote','',7.50,1,'kg','2026-11-01');
 for stage in 1..2 loop
 j:=public.material_supplier_details('f');
 if jsonb_array_length(j)<>2 or (j#>>'{0,is_primary}')::boolean or not (j#>>'{1,is_primary}')::boolean or (j#>>'{1,history,0,equivalent}')::numeric<>7.5 or (j#>>'{0,history,0,equivalent}')::numeric<>(case when stage=1 then 6 else 7 end) then raise exception 'comparison'; end if;
 select array[m."unitCost", (r.ingredients->0->>'quantity')::numeric/1000*m."unitCost",pr.ingredient_cost,pp.price] into strict v from public.recipe_sheets r join public.materials m on m.user_id=r.user_id and m.id=r.ingredients->0->>'material_id' join public.products p on p.recipe_sheet_id=r.id join public.productions pr on pr."productId"=p.id and pr.user_id=p.user_id join public.product_prices pp on pp."productId"=p.id and pp.user_id=p.user_id where r.id=sh;
 if v<>array[8,4,3.80,21]::numeric[] then raise exception 'costs %',v; end if;
 perform public.save_material_supplier('f',sa,'quote','',35,5,'kg','2026-11-02');
 end loop;
 update public.suppliers set active=false where id=sa;
 j:=public.material_supplier_details('f');
 if (j#>>'{0,active}')::boolean or jsonb_array_length(j#>'{0,history}')<>2 or (j#>>'{0,history,1,price}')::numeric<>30 then raise exception 'history';end if;
 update public.suppliers set active=true where id=sa;
 perform public.save_material_supplier('f',sa,'unlink');
 j:=public.material_supplier_details('f');
 if (j#>>'{0,linked}')::boolean or jsonb_array_length(j#>'{0,history}')<>2 or not exists(select from public.material_suppliers where material_id='m' and supplier_id=sa and linked) then raise exception 'unlink';end if;
 perform public.save_material_supplier('f',sa,'link');
 if (select count(*) from public.material_suppliers where supplier_id=sa and linked)<>2 then raise exception 'relink'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select from public.suppliers where user_id=a) or exists(select from public.supplier_quotes where user_id=a) or public.material_supplier_details('f')<>'[]' then raise exception 'isolation'; end if;
 begin perform public.save_material_supplier('f',sa,'link'); raise exception using errcode='ZZ001'; exception when raise_exception then null;end;
 begin delete from public.supplier_quotes where user_id=a;raise exception 'delete';exception when insufficient_privilege then null;end;
 raise exception using errcode='ZX001';
 exception when sqlstate 'ZX001' then null;end;
end $$; select 'ok' as resultado;
