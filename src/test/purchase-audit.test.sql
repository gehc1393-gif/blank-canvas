do $$ declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); s uuid; k uuid; f uuid; o uuid:=gen_random_uuid(); p jsonb; begin begin
insert into auth.users(id) values(a),(b);
insert into public.suppliers(user_id,name,person_type) values(a,'QA compra','PJ') returning id into s;
insert into public.materials(user_id,id,name,unit,quantity) values(a,'flour','Farinha','kg',5);
insert into public.packaging(user_id,code,name,category,use_unit,purchase_price,purchase_quantity) values(a,'QA-K','Kraft','Sacos kraft','unidade',40,50) returning id into k;
insert into public.packaging(user_id,code,name,category,use_unit,purchase_price,purchase_quantity) values(a,'QA-F','Fita','Fitas e laços','m',15,10) returning id into f;
perform set_config('request.jwt.claim.sub',a::text,true);set local role authenticated;
p:=jsonb_build_object('id',o,'operation',gen_random_uuid(),'revision',0,'action','salvar','supplier',s,'date','2026-11-25','items',
jsonb_build_array(jsonb_build_object('id','flour','kind','ingrediente','buy_unit','saco','content_unit','g','qty',3,'content',5000,'price',30),
jsonb_build_object('id',k,'kind','embalagem','buy_unit','pacote','content_unit','unidade','qty',2,'content',50,'price',40),
jsonb_build_object('id',f,'kind','embalagem','buy_unit','rolo','content_unit','m','qty',2,'content',10,'price',15)));
declare invalid jsonb; begin

invalid:=jsonb_set(jsonb_set(jsonb_set(p,'{items,0,qty}','1.1111'),'{items,0,content}','1.1111'),'{items,0,content_unit}','"kg"');
invalid:=invalid||jsonb_build_object('id',gen_random_uuid(),'operation',gen_random_uuid());
perform public.change_purchase_order(invalid);
if not exists(select from public.purchase_orders where id=(invalid->>'id')::uuid and status='rascunho' and (items->0->>'receipt')::numeric=1.23454321) then raise exception 'draft precision';end if;
begin perform public.change_purchase_order(invalid||jsonb_build_object('operation',gen_random_uuid(),'revision',1,'action','emitir'));raise exception using errcode='ZX002';exception when raise_exception then if sqlerrm not like '%Farinha%1.23454321%' then raise;end if;end;
end;
perform public.change_purchase_order(p);perform public.change_purchase_order(p);
if (select count(*) from public.purchase_orders where id=o and total=200 and (items->0->>'receipt')::numeric=15 and (items->1->>'receipt')::numeric=100 and (items->2->>'receipt')::numeric=20)<>1 then raise exception 'mixed';end if;
p:=p||jsonb_build_object('operation',gen_random_uuid(),'revision',1,'freight',15,'discount',5);
perform public.change_purchase_order(p);
if not exists(select from public.purchase_orders where id=o and total=210 and revision=2) then raise exception 'totals';end if;
begin perform public.change_purchase_order(p||jsonb_build_object('operation',gen_random_uuid()));raise exception using errcode='ZX002';exception when raise_exception then if sqlerrm not like 'Pedido alterado%' then raise;end if;end;
p:=jsonb_set(p,'{items,0,qty}','4')||jsonb_build_object('operation',gen_random_uuid(),'revision',2);
perform public.change_purchase_order(p);
if not exists(select from public.purchase_orders where id=o and total=240) then raise exception 'edit';end if;
p:=p||jsonb_build_object('operation',gen_random_uuid(),'revision',3,'action','emitir');
perform public.change_purchase_order(p);perform public.change_purchase_order(p);
if not exists(select from public.purchase_orders where id=o and status='emitido' and issued_by=a) then raise exception 'issue';end if;
begin perform public.change_purchase_order(p||jsonb_build_object('operation',gen_random_uuid(),'revision',4,'action','salvar'));raise exception using errcode='ZX002';exception when raise_exception then if sqlerrm not like 'Somente rascunhos%' then raise;end if;end;
if (select quantity from public.materials where user_id=a and id='flour')<>5 or exists(select from public.packaging where user_id=a and stock_balance<>0) or exists(select from public.expenses where user_id=a) then raise exception 'stock';end if;
perform public.change_purchase_order(p||jsonb_build_object('operation',gen_random_uuid(),'revision',4,'action','cancelar','reason','QA'));
if not exists(select from public.purchase_orders where id=o and status='cancelado' and cancellation_reason='QA' and cancelled_at is not null) then raise exception 'cancel';end if;
perform set_config('request.jwt.claim.sub',b::text,true);
if exists(select from public.purchase_orders where id=o) then raise exception 'read';end if;
begin perform public.change_purchase_order(p||jsonb_build_object('operation',gen_random_uuid(),'revision',5,'action','cancelar','reason','QA'));raise exception using errcode='ZX002';exception when raise_exception then if sqlerrm not like 'Pedido alterado%' then raise;end if;end;
raise exception using errcode='ZX001';exception when sqlstate 'ZX001' then null;end;end $$;
select 'ok' resultado;
