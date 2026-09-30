-- 회독 플래너 동기화용 Supabase 설정
-- Supabase 대시보드 › SQL Editor › New query 에 전체를 붙여 넣고 Run 을 한 번 누르면 된다.
-- 여러 번 실행해도 괜찮다.
--
-- 구조: 앱의 모든 기록을 records 표 하나에 둔다.
--   tbl  = 앱 안의 표 이름 (subjects / tasks / exams / semesters / meta / attachments)
--   id   = 레코드 id,  data = 레코드 내용(JSON)
--   client_updated_at = 기기에서 고친 시각(ms). 같은 레코드는 이 값이 더 큰 쪽이 이긴다.
--   rev  = 서버에서 바뀐 순서. 기기는 "마지막으로 받은 rev 이후"만 받아 간다.
-- 규칙: 로그인한 본인 기록만 읽고 쓸 수 있다 (RLS).

create sequence if not exists public.records_rev_seq;

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tbl text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  client_updated_at bigint not null default 0,
  rev bigint not null default nextval('public.records_rev_seq'),
  updated_at timestamptz not null default now(),
  primary key (user_id, tbl, id)
);

create index if not exists records_user_rev on public.records (user_id, rev);

-- 로그인한 사용자만 이 표를 쓸 수 있게 (로그인 안 한 요청은 막는다)
revoke all on public.records from anon;
grant select, insert, update on public.records to authenticated;
grant usage, select on sequence public.records_rev_seq to authenticated;

alter table public.records enable row level security;

drop policy if exists "records: 본인 것만 읽기" on public.records;
create policy "records: 본인 것만 읽기" on public.records
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "records: 본인 것만 쓰기" on public.records;
create policy "records: 본인 것만 쓰기" on public.records
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "records: 본인 것만 고치기" on public.records;
create policy "records: 본인 것만 고치기" on public.records
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 한꺼번에 올리기: 같은 레코드가 이미 있으면 client_updated_at이 더 클 때만 바꾼다.
create or replace function public.sync_push(items jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  it jsonb;
  n integer := 0;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  for it in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb)) loop
    insert into public.records as r (user_id, tbl, id, data, deleted, client_updated_at, rev, updated_at)
    values (
      uid,
      it ->> 'tbl',
      it ->> 'id',
      coalesce(it -> 'data', '{}'::jsonb),
      coalesce((it ->> 'deleted')::boolean, false),
      coalesce((it ->> 'client_updated_at')::bigint, 0),
      nextval('public.records_rev_seq'),
      now()
    )
    on conflict (user_id, tbl, id) do update
      set data = excluded.data,
          deleted = excluded.deleted,
          client_updated_at = excluded.client_updated_at,
          rev = excluded.rev,
          updated_at = now()
      where r.client_updated_at < excluded.client_updated_at;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;

-- 사진 보관함: 본인 폴더(사용자 id)만 쓸 수 있는 비공개 버킷
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments: 본인 폴더 읽기" on storage.objects;
create policy "attachments: 본인 폴더 읽기" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments: 본인 폴더 올리기" on storage.objects;
create policy "attachments: 본인 폴더 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments: 본인 폴더 바꾸기" on storage.objects;
create policy "attachments: 본인 폴더 바꾸기" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments: 본인 폴더 지우기" on storage.objects;
create policy "attachments: 본인 폴더 지우기" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
