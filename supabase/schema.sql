create extension if not exists "pgcrypto";

create table if not exists public.student_topics (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  grade text not null,
  subject text not null,
  initial_topic text not null,
  final_report_md text not null,
  created_at timestamptz not null default now()
);

create index if not exists student_topics_created_at_idx
  on public.student_topics (created_at desc);

alter table public.student_topics enable row level security;

-- 브라우저는 이 테이블에 직접 접근하지 않습니다.
-- 서버 API가 SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY로 저장과 조회를 담당합니다.
