-- Course platforms and appearance preferences.

-- Resources: whether a course costs money, and who teaches it when the provider is a platform
-- (e.g. provider 'Udemy', instructor 'Jose Portilla').
alter table public.resources
  add column if not exists cost text not null default 'free',
  add column if not exists instructor text;
alter table public.resources drop constraint if exists resources_cost_check;
alter table public.resources add constraint resources_cost_check check (cost in ('free', 'freemium', 'paid'));

-- Profiles: the learner's chosen theme ('system' follows the device) and an optional custom accent.
alter table public.profiles
  add column if not exists theme text not null default 'system',
  add column if not exists theme_accent text;
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check check (theme ~ '^[a-z][a-z0-9-]{1,31}$');
alter table public.profiles drop constraint if exists profiles_theme_accent_check;
alter table public.profiles add constraint profiles_theme_accent_check check (theme_accent is null or theme_accent ~ '^#[0-9a-f]{6}$');
