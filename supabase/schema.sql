-- atillacam.com çevrimiçi özellikleri: ziyaretçi fısıltıları + dünya yarış sıralaması
-- Kurulum: Supabase panelinde SQL Editor > New query > bu dosyanın tamamını yapıştır > Run.
-- Ziyaretçiler (anon anahtarı) yalnızca okuyabilir ve kurallara uyan yeni satır ekleyebilir;
-- düzenleme / silme yalnızca panelden (service role) yapılabilir.

create table if not exists public.whispers (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 24),
  message text not null check (char_length(btrim(message)) between 1 and 140),
  x real not null check (x between -140 and 140),
  z real not null check (z between -140 and 140),
  created_at timestamptz not null default now()
);

create table if not exists public.race_scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 24),
  time_ms integer not null check (time_ms between 15000 and 600000),
  car text not null default '' check (char_length(car) <= 16),
  created_at timestamptz not null default now()
);

create index if not exists race_scores_time_idx on public.race_scores (time_ms);
create index if not exists whispers_created_idx on public.whispers (created_at desc);

alter table public.whispers enable row level security;
alter table public.race_scores enable row level security;

drop policy if exists "whispers are public" on public.whispers;
create policy "whispers are public" on public.whispers for select to anon, authenticated using (true);
drop policy if exists "anyone can whisper" on public.whispers;
create policy "anyone can whisper" on public.whispers for insert to anon, authenticated with check (true);

drop policy if exists "scores are public" on public.race_scores;
create policy "scores are public" on public.race_scores for select to anon, authenticated using (true);
drop policy if exists "anyone can submit a score" on public.race_scores;
create policy "anyone can submit a score" on public.race_scores for insert to anon, authenticated with check (true);

-- Sadece gerekli izinler: okuma + ekleme (güncelleme/silme yok)
revoke all on public.whispers, public.race_scores from anon, authenticated;
grant select, insert on public.whispers, public.race_scores to anon, authenticated;

-- Basit taşma koruması: 10 dakikada toplam 30'dan fazla yeni satır kabul edilmez
create or replace function public.limit_inserts() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent integer;
begin
  execute format('select count(*) from %I.%I where created_at > now() - interval ''10 minutes''', tg_table_schema, tg_table_name) into recent;
  if recent >= 30 then
    raise exception 'rate limit' using errcode = '53400';
  end if;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists whispers_limit on public.whispers;
create trigger whispers_limit before insert on public.whispers for each row execute function public.limit_inserts();
drop trigger if exists race_scores_limit on public.race_scores;
create trigger race_scores_limit before insert on public.race_scores for each row execute function public.limit_inserts();
