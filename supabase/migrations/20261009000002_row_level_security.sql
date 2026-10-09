-- PathForge AI — row-level security
--
-- Access model
--   * Catalog tables: readable by everyone (anon + authenticated), never writable from clients.
--   * questions: server-only. The table holds answer keys, so clients get no policy at all;
--     the FastAPI backend serves questions without answers.
--   * profiles / resource_progress: learners read and write only their own rows.
--   * assessments, responses, topic_mastery, adaptation_events: learners can READ their own
--     rows; writes happen only in the backend (which connects with a privileged role) so that
--     scores and model predictions cannot be forged from the browser.

-- Catalog -------------------------------------------------------------------
alter table public.topics               enable row level security;
alter table public.topic_prerequisites  enable row level security;
alter table public.careers              enable row level security;
alter table public.career_topics        enable row level security;
alter table public.resources            enable row level security;
alter table public.questions            enable row level security;

create policy "catalog topics are public"        on public.topics              for select to anon, authenticated using (true);
create policy "catalog prerequisites are public" on public.topic_prerequisites for select to anon, authenticated using (true);
create policy "catalog careers are public"       on public.careers             for select to anon, authenticated using (true);
create policy "catalog career topics are public" on public.career_topics       for select to anon, authenticated using (true);
create policy "catalog resources are public"     on public.resources           for select to anon, authenticated using (true);
-- (no policy on questions: denied for anon/authenticated)

revoke insert, update, delete, truncate on
  public.topics, public.topic_prerequisites, public.careers, public.career_topics, public.resources
  from anon, authenticated;
revoke all on public.questions from anon, authenticated;

-- Profiles ------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "learners read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "learners create own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "learners update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke all on public.profiles from anon;

-- Assessment history & model estimates (read-only for learners) -------------
alter table public.assessments           enable row level security;
alter table public.assessment_responses  enable row level security;
alter table public.topic_mastery         enable row level security;
alter table public.adaptation_events     enable row level security;

create policy "learners read own assessments" on public.assessments
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "learners read own responses" on public.assessment_responses
  for select to authenticated using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_responses.assessment_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "learners read own mastery" on public.topic_mastery
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "learners read own adaptation events" on public.adaptation_events
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete, truncate on
  public.assessments, public.assessment_responses, public.topic_mastery, public.adaptation_events
  from anon, authenticated;
revoke select on
  public.assessments, public.assessment_responses, public.topic_mastery, public.adaptation_events
  from anon;

-- Resource progress (full ownership) -----------------------------------------
alter table public.resource_progress enable row level security;

create policy "learners read own progress" on public.resource_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "learners add own progress" on public.resource_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "learners update own progress" on public.resource_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "learners delete own progress" on public.resource_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.resource_progress from anon;
