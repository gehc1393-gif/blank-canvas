do $$ declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); s uuid; k uuid; o uuid:=gen_random_uuid(); l1 uuid:='10000000-0000-4000-8000-000000000001'; l2 uuid:='20000000-0000-4000-8000-000000000001'; p jsonb; first jsonb; prior int; begin begin
insert into auth.users(id) values(a),(b);
insert into public.suppliers(user_id,name,person_type) values(a,'QA recebimento','PJ') returning id into s;
insert into public.materials(user_id,id,name,unit,quantity,"unitCost") values(a,'qa','QA farinha','kg',2,8);
insert into public.packaging(user_id,code,name,category,use_unit,purchase_price,purchase_quantity,stock_balance) values(a,'QA','QA kraft','Sacos kraft','unidade',40,50,42) returning id into k;
insert into public.purchase_orders(user_id,id,number,supplier_id,supplier_name,ordered_on,status,notes,items,subtotal,discount,freight,created_by)
values(a,o,1,s,'QA',current_date,'emitido','',jsonb_build_array(jsonb_build_object('line_id',l1,'id','qa','kind','ingrediente','name','QA farinha','stock_unit','kg','receipt',15),jsonb_build_object('line_id',l2,'id',k,'kind','embalagem','name','QA kraft','stock_unit','unidade','receipt',100)),200,0,0,a);
perform set_config('request.jwt.claim.sub',a::text,true);set local role authenticated;
select coalesce((select revision from public.business_revisions where user_id=a),0) into prior;
p:=jsonb_build_object('order',o,'operation',gen_random_uuid(),'revision',1,'date',current_date-1,'items',jsonb_build_array(jsonb_build_object('line_id',l1,'qty',10),jsonb_build_object('line_id',l2,'qty',100)));
update public.packaging set active=false where id=k;
begin perform public.receive_purchase(p);raise exception using errcode='ZX002';exception when raise_exception then if sqlerrm<>'Embalagem inativa.' then raise;end if;end;
if (select quantity from public.materials where id='qa')<>2 or exists(select from public.stock_movements where user_id=a) then raise exception 'atomic';end if;
update public.packaging set active=true where id=k;
perform public.receive_purchase(p);perform public.receive_purchase(p);
if not exists(select from public.purchase_orders where id=o and status='parcialmente recebido') then raise exception 'partial';end if;
begin perform public.save_business_data(prior,'{}');raise exception using errcode='ZX002';exception when raise_exception then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
begin perform public.change_purchase_order(jsonb_build_object('id',o,'operation',gen_random_uuid(),'revision',2,'action','cancelar','reason','QA'));raise exception using errcode='ZX002';exception when raise_exception then if sqlerrm not like 'Pedido com recebimento%' then raise;end if;end;
first:=p;
p:=p||jsonb_build_object('operation',gen_random_uuid(),'revision',2,'items',jsonb_build_array(jsonb_build_object('line_id',l1,'qty',5)));
perform public.receive_purchase(p);
if (select quantity from public.materials where id='qa')<>17 or (select stock_balance from public.packaging where id=k)<>142 or not exists(select from public.purchase_orders where id=o and status='recebido') or (select count(*) from public.purchase_receipts where order_id=o)<>2 or (select count(*) from public.packaging_stock_movements where packaging_id=k)<>1 or (select "unitCost" from public.materials where id='qa')<>8 then raise exception 'total';end if;
begin perform public.receive_purchase(first||jsonb_build_object('notes','Changed'));raise exception using errcode='ZX002';exception when raise_exception then if sqlerrm<>'Operação já utilizada.' then raise;end if;end;
perform set_config('request.jwt.claim.sub',b::text,true);
if exists(select from public.purchase_receipts where order_id=o) then raise exception 'leak';end if;
begin perform public.receive_purchase(p);raise exception using errcode='ZX002';exception when raise_exception then if sqlerrm<>'Pedido indisponível para recebimento.' then raise;end if;end;
raise exception using errcode='ZX001';exception when sqlstate 'ZX001' then null;end;end $$;select 'ok' resultado;
