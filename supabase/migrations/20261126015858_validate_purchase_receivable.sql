create function public.validate_purchase_receivable() returns trigger language plpgsql set search_path='' as $$
declare item record;
begin
 if new.status='emitido' and (tg_op='INSERT' or old.status is distinct from 'emitido') then
  for item in select x.name,x.code,x.receipt as v,x.stock_unit as unit from jsonb_to_recordset(new.items) x(name text,code text,receipt numeric,stock_unit text) loop
   if item.v is null or (item.v<=0 or item.v>99999999999.9999 or item.v<>round(item.v,4) or (item.unit in ('unidade','pacote') and item.v<>trunc(item.v))) then
    raise exception 'Item % (%): a quantidade prevista % % não pode ser recebida exatamente. Use até quatro casas decimais ou um inteiro para unidade/pacote.',item.name,item.code,item.v,item.unit;
   end if;
  end loop;
 end if;
 return new;
end $$;
create trigger validate_purchase_receivable before insert or update of status on public.purchase_orders for each row execute function public.validate_purchase_receivable();
