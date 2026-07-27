-- Supabase SQL Editor'e yapıştırıp çalıştır.

-- 1) Oda tiplerini ve kaç ADET olduklarını tutan tablo
create table if not exists room_types (
  id text primary key,          -- 'standart', 'deluxe', 'kedi', 'vip'
  name text not null,
  price numeric not null,
  units integer not null        -- bu tipten kaç fiziksel kulübe/oda var
);

insert into room_types (id, name, price, units) values
  ('standart', 'Standart Kulübe', 450, 8),
  ('deluxe',   'Deluxe Süit',      750, 5),
  ('kedi',     'Kedi Odası',       400, 5),
  ('vip',      'VIP Aile Süiti',   980, 2)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  units = excluded.units;

-- room_types herkese açık okunabilir olmalı (fiyat/isim bilgisi gizli değil)
alter table room_types enable row level security;
drop policy if exists "herkes_oda_tiplerini_okuyabilir" on room_types;
create policy "herkes_oda_tiplerini_okuyabilir"
on room_types for select
to anon, authenticated
using (true);

-- 2) Belirli bir oda tipi, belirli tarih aralığında müsait mi?
-- Sadece "onaylandi" durumundaki rezervasyonlar kapasiteyi dolduruyor.
-- security definer sayesinde anon kullanıcılar, rezervasyon tablosunun
-- satırlarını görmeden sadece "müsait mi" sonucunu alabiliyor.
create or replace function check_room_availability(
  p_room_id text,
  p_check_in date,
  p_check_out date
) returns boolean
language sql
security definer
set search_path = public
as $$
  select
    (select units from room_types where id = p_room_id)
    >
    (
      select count(*) from reservations
      where room_id = p_room_id
        and status = 'onaylandi'
        and check_in < p_check_out
        and check_out > p_check_in
    );
$$;

grant execute on function check_room_availability(text, date, date) to anon, authenticated;
