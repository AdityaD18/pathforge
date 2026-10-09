-- Assessments can be stored but excluded from mastery when the attempt carries no
-- usable evidence (e.g. most answers given faster than anyone could read the question).

alter table public.assessments
  add column counted boolean not null default true,
  add column excluded_reason text check (char_length(excluded_reason) <= 300);

alter table public.assessments
  add constraint assessments_excluded_reason_when_not_counted
  check (counted or excluded_reason is not null);

create index assessments_user_counted_idx on public.assessments (user_id, submitted_at)
  where status = 'submitted' and counted;
