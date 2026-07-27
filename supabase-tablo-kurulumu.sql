-- Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır.

create table reservations (
  id bigint generated always as identity primary key,
  code text unique not null,
  owner_name text not null,
  owner_phone text,
  owner_email text,
  pet_name text not null,
  pet_type text,
  pet_breed text,
  pet_age int,
  pet_notes text,
  check_in date not null,
  check_out date not null,
  room_id text not null,
  room_name text,
  nights int,
  total numeric,
  status text not null default 'beklemede',
  created_at timestamptz not null default now()
);

-- Satır bazlı güvenliği aç: kimin ne yapabileceğini biz belirleyeceğiz
alter table reservations enable row level security;

-- Herkes (site ziyaretçisi) yeni rezervasyon TALEBİ oluşturabilsin
create policy "herkes_rezervasyon_olusturabilir"
on reservations for insert
to anon
with check (true);

-- Sadece giriş yapmış (admin) kullanıcılar rezervasyonları görebilsin
create policy "sadece_admin_okuyabilir"
on reservations for select
to authenticated
with check (true);

-- Sadece giriş yapmış (admin) kullanıcılar durum güncelleyebilsin
create policy "sadece_admin_guncelleyebilir"
on reservations for update
to authenticated
using (true);
