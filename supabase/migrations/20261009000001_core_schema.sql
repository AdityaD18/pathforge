-- PathForge AI — core schema
-- Catalog tables (careers, topics, prerequisites, resources, questions) are
-- reference data seeded from backend/ml/catalog_data via supabase/seed.sql.
-- Learner tables are keyed by auth.users(id).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------------
create type public.question_difficulty as enum ('easy', 'medium', 'hard');
create type public.resource_level as enum ('beginner', 'intermediate', 'advanced');
create type public.resource_format as enum ('video', 'article', 'course', 'interactive', 'book', 'documentation');
create type public.proficiency_level as enum ('beginner', 'intermediate', 'advanced');
create type public.assessment_status as enum ('in_progress', 'submitted');
create type public.progress_status as enum ('saved', 'in_progress', 'completed');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.topics (
  id           text primary key check (id ~ '^[a-z0-9-]+$'),
  name         text not null,
  domain       text not null,
  description  text not null,
  est_hours    integer not null check (est_hours between 1 and 500),
  created_at   timestamptz not null default now()
);

create table public.topic_prerequisites (
  topic_id         text not null references public.topics (id) on delete cascade,
  prerequisite_id  text not null references public.topics (id) on delete cascade,
  primary key (topic_id, prerequisite_id),
  check (topic_id <> prerequisite_id)
);
create index topic_prerequisites_prereq_idx on public.topic_prerequisites (prerequisite_id);

create table public.careers (
  id           text primary key check (id ~ '^[a-z0-9-]+$'),
  title        text not null,
  icon         text not null,
  description  text not null,
  created_at   timestamptz not null default now()
);

create table public.career_topics (
  career_id  text not null references public.careers (id) on delete cascade,
  topic_id   text not null references public.topics (id) on delete cascade,
  weight     smallint not null check (weight between 1 and 3),
  primary key (career_id, topic_id)
);
create index career_topics_topic_idx on public.career_topics (topic_id);

create table public.resources (
  id           text primary key,
  topic_id     text not null references public.topics (id) on delete cascade,
  title        text not null,
  provider     text not null,
  url          text not null check (url ~ '^https://'),
  format       public.resource_format not null,
  difficulty   public.resource_level not null,
  est_minutes  integer not null check (est_minutes > 0),
  description  text not null,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index resources_topic_idx on public.resources (topic_id);

-- Answer keys live here; RLS (next migration) keeps this table server-only.
create table public.questions (
  id                text primary key,
  topic_id          text not null references public.topics (id) on delete cascade,
  difficulty        public.question_difficulty not null,
  prompt            text not null,
  options           jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index     smallint not null check (correct_index between 0 and 3),
  explanation       text not null,
  expected_seconds  integer not null check (expected_seconds > 0),
  created_at        timestamptz not null default now()
);
create index questions_topic_difficulty_idx on public.questions (topic_id, difficulty);

-- ---------------------------------------------------------------------------
-- Learner data
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text check (char_length(display_name) <= 80),
  target_career_id   text references public.careers (id) on delete set null,
  weekly_hours       smallint not null default 6 check (weekly_hours between 1 and 60),
  preferred_formats  public.resource_format[] not null default '{}',
  preferred_level    public.resource_level,
  learning_goal      text check (char_length(learning_goal) <= 500),
  onboarded_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index profiles_career_idx on public.profiles (target_career_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.assessments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  topic_id          text not null references public.topics (id) on delete restrict,
  status            public.assessment_status not null default 'in_progress',
  question_ids      text[] not null check (cardinality(question_ids) between 1 and 20),
  -- Filled in on submission by the backend's inference module.
  predicted_level   public.proficiency_level,
  mastery_score     numeric(5, 4) check (mastery_score between 0 and 1),
  probabilities     jsonb,
  features          jsonb,
  accuracy          numeric(5, 4) check (accuracy between 0 and 1),
  model_version     text,
  started_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((status = 'submitted') = (submitted_at is not null))
);
create index assessments_user_created_idx on public.assessments (user_id, created_at desc);
create index assessments_user_topic_idx on public.assessments (user_id, topic_id, submitted_at desc);
create trigger assessments_updated_at before update on public.assessments
  for each row execute function public.set_updated_at();

create table public.assessment_responses (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.assessments (id) on delete cascade,
  question_id     text not null references public.questions (id) on delete restrict,
  selected_index  smallint not null check (selected_index between 0 and 3),
  is_correct      boolean not null,
  confidence      smallint not null check (confidence between 1 and 3),  -- 1 guess, 2 unsure, 3 sure
  time_ms         integer not null check (time_ms between 0 and 3600000),
  created_at      timestamptz not null default now(),
  unique (assessment_id, question_id)
);
create index assessment_responses_question_idx on public.assessment_responses (question_id);

-- Latest model estimate per learner and topic (history lives in assessments).
create table public.topic_mastery (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  topic_id        text not null references public.topics (id) on delete cascade,
  level           public.proficiency_level not null,
  mastery_score   numeric(5, 4) not null check (mastery_score between 0 and 1),
  confidence      numeric(5, 4) not null check (confidence between 0 and 1),
  probabilities   jsonb not null,
  accuracy        numeric(5, 4) not null check (accuracy between 0 and 1),
  assessment_id   uuid not null references public.assessments (id) on delete cascade,
  model_version   text not null,
  updated_at      timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index topic_mastery_assessment_idx on public.topic_mastery (assessment_id);
create trigger topic_mastery_updated_at before update on public.topic_mastery
  for each row execute function public.set_updated_at();

create table public.resource_progress (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  resource_id  text not null references public.resources (id) on delete cascade,
  status       public.progress_status not null default 'saved',
  rating       smallint check (rating between 1 and 5),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, resource_id),
  check ((status = 'completed') = (completed_at is not null))
);
create index resource_progress_resource_idx on public.resource_progress (resource_id);
create trigger resource_progress_updated_at before update on public.resource_progress
  for each row execute function public.set_updated_at();

-- What changed in the learner's plan after each adaptive update.
create table public.adaptation_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  trigger        text not null check (trigger in ('assessment', 'profile', 'progress')),
  assessment_id  uuid references public.assessments (id) on delete cascade,
  summary        text not null,
  changes        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index adaptation_events_user_created_idx on public.adaptation_events (user_id, created_at desc);
create index adaptation_events_assessment_idx on public.adaptation_events (assessment_id);

-- ---------------------------------------------------------------------------
-- Create a profile row automatically for every new auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
