-- Isolated fixtures automatically rolled back after the assertions.
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); s uuid; f uuid; inactive uuid; sheet uuid:=gen_random_uuid(); links jsonb;
begin begin
 insert into auth.users(id) values(a),(b);
 perform set_config('request.jwt.claim.sub',a::text,true);
 insert into public.recipe_sheets(id,user_id,code,name,category,yield_units) values(sheet,a,'QA94','QA','QA',20);
 insert into public.products(user_id,id,name,"batchYield",recipe_sheet_id,units_per_presentation) values(a,'qa5','QA 5',20,sheet,5),(a,'qa10','QA 10',20,sheet,10);
 insert into public.packaging(user_id,code,name,category,use_unit,purchase_quantity,purchase_price) values(a,'QA94-S','QA','Tags','unidade',50,40) returning id into s;
 insert into public.packaging(user_id,code,name,category,use_unit,purchase_quantity,purchase_price) values(a,'QA94-F','QA','Tags','m',10,15) returning id into f;
 insert into public.packaging(user_id,code,name,category,use_unit,purchase_quantity,purchase_price,active) values(a,'QA94-I','QA','Tags','unidade',1,0,false) returning id into inactive;
 set local role authenticated;
 links:=jsonb_build_array(jsonb_build_object('id',s,'quantity',1));
 perform public.save_product_packaging('qa5','[]',links);
 perform public.save_product_packaging('qa10','[]',links||jsonb_build_array(jsonb_build_object('id',f,'quantity',0.30)));
 if jsonb_array_length(public.read_product_packaging('qa5'))<>1 or jsonb_array_length(public.read_product_packaging('qa10'))<>2 then raise exception 'Apresentações interferiram entre si'; end if;
 begin perform public.save_product_packaging('qa5',links,links||links); raise exception using errcode='ZX002'; exception when unique_violation then null; end;
 begin perform public.save_product_packaging('qa5',links,jsonb_build_array(jsonb_build_object('id',s,'quantity',0.5))); raise exception using errcode='ZX002'; exception when raise_exception then if sqlerrm<>'Quantidade incompatível com a unidade.' then raise;end if;end;
 begin perform public.save_product_packaging('qa5',links,jsonb_build_array(jsonb_build_object('id',inactive,'quantity',1))); raise exception using errcode='ZX002'; exception when raise_exception then if sqlerrm<>'Embalagem indisponível.' then raise;end if;end;
 begin perform public.save_product_packaging('qa5','[]',links); raise exception using errcode='ZX002'; exception when raise_exception then if sqlerrm not like 'Composição alterada%' then raise;end if;end;
 perform public.move_packaging_stock(s,gen_random_uuid(),'entrada',1,'unidade',current_date-1,'QA94','',null);
 update public.packaging set active=false where id=s;
 if (select count(*) from public.packaging_stock_movements where packaging_id=s)<>1 or public.read_product_packaging('qa5')<>links then raise exception 'Inativação perdeu histórico';end if;
 begin update public.packaging set stock_balance=99 where id=s; raise exception using errcode='ZX002'; exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if public.read_product_packaging('qa5')<>'[]' or exists(select from public.packaging_stock_movements where packaging_id=s) then raise exception 'Isolamento';end if;
 begin perform public.save_product_packaging('qa5','[]',links); raise exception using errcode='ZX002'; exception when raise_exception then if sqlerrm<>'Produto indisponível.' then raise;end if;end;
 raise exception using errcode='ZX001';exception when sqlstate 'ZX001' then null;end;end $$;
 select 'ok' resultado;
