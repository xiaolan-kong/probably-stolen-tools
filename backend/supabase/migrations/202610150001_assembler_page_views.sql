-- Extend page categories without resetting existing daily counts or permissions.
begin;
alter table public.page_views_daily drop constraint page_views_daily_page_check;
alter table public.page_views_daily add constraint page_views_daily_page_check
  check (page in ('calculator', 'assembler', 'feedback'));

create or replace function public.record_page_view(p_page text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_page not in ('calculator', 'assembler', 'feedback') or p_page is null then
    raise exception 'invalid_page';
  end if;
  insert into public.page_views_daily(day, page, views)
  values ((now() at time zone 'Asia/Shanghai')::date, p_page, 1)
  on conflict (day, page) do update set views = public.page_views_daily.views + 1;
end;
$$;
revoke all on function public.record_page_view(text) from public, anon, authenticated;
grant execute on function public.record_page_view(text) to service_role;

commit;
