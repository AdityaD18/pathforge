-- Fixes from the Supabase database advisor.

-- Pin the search path of the updated_at trigger function (lint 0011).
alter function public.set_updated_at() set search_path = '';

-- handle_new_user is a trigger function for auth.users; it must never be callable through the
-- REST API (/rest/v1/rpc/handle_new_user). Triggers still fire: they don't need EXECUTE.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Covering indexes for foreign keys whose existing composite indexes start with user_id (lint 0001).
create index if not exists assessments_topic_idx on public.assessments (topic_id);
create index if not exists topic_mastery_topic_idx on public.topic_mastery (topic_id);
