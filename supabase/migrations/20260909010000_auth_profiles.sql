-- Profile creation belongs to the Auth transaction. Never trust metadata as authorization.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    case when jsonb_typeof(new.raw_user_meta_data -> 'display_name') = 'string'
      then nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 100), '')
      else null end
  ) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Preserve any existing Foundation profiles while covering pre-existing Auth accounts.
insert into public.profiles (id, display_name)
select id,
  case when jsonb_typeof(raw_user_meta_data -> 'display_name') = 'string'
    then nullif(left(trim(raw_user_meta_data ->> 'display_name'), 100), '')
    else null end
from auth.users
on conflict (id) do nothing;
