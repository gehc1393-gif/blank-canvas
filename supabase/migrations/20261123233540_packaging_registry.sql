create table public.packaging_categories (name text primary key);
insert into public.packaging_categories(name) values ('Sacos kraft'),('Sacos transparentes'),('Caixas para presente'),('Caixas corporativas'),('Etiquetas adesivas'),('Tags'),('Fitas e laços'),('Formas descartáveis'),('Marmitas de alumínio'),('Papéis e acessórios de embalagem'),('Outros materiais');
alter table public.packaging_categories enable row level security;
revoke all on public.packaging_categories from public,anon,authenticated;
grant select on public.packaging_categories to authenticated;
create policy packaging_categories_read on public.packaging_categories for select to authenticated using(true);

create table public.packaging (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id),
 code text not null check(code=upper(btrim(code)) and length(code) between 1 and 48),
 name text not null check(length(btrim(name)) between 1 and 160),
 category text not null references public.packaging_categories(name),
 description text not null default '', photo text not null default '' check(length(photo)<=350000 and (photo='' or photo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')),
 material text not null default '', width numeric(12,4) check(width>0 and width<>'NaN'), height numeric(12,4) check(height>0 and height<>'NaN'), depth numeric(12,4) check(depth>0 and depth<>'NaN'),
 dimension_unit text not null default 'cm' check(dimension_unit in ('mm','cm','m')),
 use_unit text not null check(use_unit in ('unidade','m','kg','m²')),
 purchase_quantity numeric(12,4) not null check(purchase_quantity>0 and purchase_quantity<>'NaN'),
 purchase_price numeric(12,2) not null check(purchase_price>=0 and purchase_price<>'NaN'),
 minimum numeric(12,4) not null default 0 check(minimum>=0 and minimum<>'NaN'),
 notes text not null default '', active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default clock_timestamp(),
 unique(user_id,code)
);
create function public.packaging_timestamp() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=clock_timestamp(); return new; end $$;
create trigger packaging_update before update on public.packaging for each row execute function public.packaging_timestamp();
alter table public.packaging enable row level security;
revoke all on public.packaging from public,anon,authenticated;
grant select, insert(code,name,category,description,photo,material,width,height,depth,dimension_unit,use_unit,purchase_quantity,purchase_price,minimum,notes,active), update(code,name,category,description,photo,material,width,height,depth,dimension_unit,use_unit,purchase_quantity,purchase_price,minimum,notes,active) on public.packaging to authenticated;
create policy packaging_read on public.packaging for select to authenticated using(user_id=(select auth.uid()));
create policy packaging_create on public.packaging for insert to authenticated with check(user_id=(select auth.uid()));
create policy packaging_edit on public.packaging for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
