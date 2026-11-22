create function public.valid_supplier_document(doc text, kind text) returns boolean
language plpgsql immutable strict set search_path = '' as $$
declare base text; total integer; weight integer; digit integer;
begin
  if doc = '' then return true; end if;
  if (kind = 'PF' and doc !~ '^[0-9]{11}$') or (kind = 'PJ' and doc !~ '^[A-Z0-9]{12}[0-9]{2}$') or doc ~ '^(.)\1+$' then return false; end if;
  base := left(doc,-2);
  for pass in 1..2 loop
    total := 0;
    for i in 1..length(base) loop
      weight := case when kind='PF' then length(base)+2-i else (length(base)-i)%8+2 end;
      total := total + (ascii(substr(base,i,1))-48)*weight;
    end loop;
    digit := (11-total%11)%11;
    base := base || (case when digit=10 then 0 else digit end)::text;
  end loop;
  return base=doc;
end $$;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  code bigint generated always as identity unique,
  name text not null check (length(btrim(name)) between 1 and 200),
  trade_name text not null default '',
  document text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  contact text not null default '',
  postal_code text not null default '',
  address text not null default '',
  address_number text not null default '',
  complement text not null default '',
  district text not null default '',
  city text not null default '',
  state text not null default '',
  notes text not null default '',
  person_type text not null check (person_type in ('PF','PJ')),
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (public.valid_supplier_document(document, person_type))
);
create unique index suppliers_account_document on public.suppliers(user_id,document) where document <> '';
create index suppliers_account_code on public.suppliers(user_id,code);
create function public.prepare_supplier_write() returns trigger language plpgsql set search_path='' as $$
begin
  new.document := translate(upper(btrim(new.document)), './-', '');
  new.name := btrim(new.name);
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger prepare_supplier_write before insert or update on public.suppliers for each row execute function public.prepare_supplier_write();
alter table public.suppliers enable row level security;
revoke all on public.suppliers from public, anon, authenticated;
grant select, insert(user_id,name,trade_name,document,phone,whatsapp,email,contact,postal_code,address,address_number,complement,district,city,state,notes,person_type,active), update(name,trade_name,document,phone,whatsapp,email,contact,postal_code,address,address_number,complement,district,city,state,notes,person_type,active) on public.suppliers to authenticated;
create policy suppliers_select on public.suppliers for select to authenticated using (user_id=(select auth.uid()));
create policy suppliers_insert on public.suppliers for insert to authenticated with check (user_id=(select auth.uid()));
create policy suppliers_update on public.suppliers for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
