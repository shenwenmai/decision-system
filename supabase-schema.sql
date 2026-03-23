-- 顾问决策系统 · Supabase Schema
-- 在 Supabase 控制台 SQL Editor 里运行这个文件

-- 1. decisions 表
create table if not exists public.decisions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  input       text not null,
  diagnosis   jsonb default null,
  analysis    jsonb default null,
  verdict     text default null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- 2. 自动更新 updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger decisions_updated_at
  before update on public.decisions
  for each row execute function update_updated_at();

-- 3. Row Level Security（用户只能访问自己的数据）
alter table public.decisions enable row level security;

create policy "用户只能查看自己的决策"
  on public.decisions for select
  using (auth.uid() = user_id);

create policy "用户只能创建自己的决策"
  on public.decisions for insert
  with check (auth.uid() = user_id);

create policy "用户只能更新自己的决策"
  on public.decisions for update
  using (auth.uid() = user_id);

create policy "用户只能删除自己的决策"
  on public.decisions for delete
  using (auth.uid() = user_id);

-- 4. 索引
create index decisions_user_id_idx on public.decisions(user_id);
create index decisions_created_at_idx on public.decisions(created_at desc);
