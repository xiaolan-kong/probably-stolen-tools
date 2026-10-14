-- Aggregate PV only: no visitor identifier, IP, referrer, URL or calculator data.
create table public.page_views_daily (
  day date not null,
  page text not null check (page in ('calculator', 'feedback')),
  views bigint not null default 0 check (views >= 0),
  primary key (day, page)
);
alter table public.page_views_daily enable row level security;
revoke all on public.page_views_daily from anon, authenticated;
grant all on public.page_views_daily to service_role;

create function public.record_page_view(p_page text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_page not in ('calculator', 'feedback') or p_page is null then
    raise exception 'invalid_page';
  end if;
  insert into public.page_views_daily(day, page, views)
  values ((now() at time zone 'Asia/Shanghai')::date, p_page, 1)
  on conflict (day, page) do update set views = public.page_views_daily.views + 1;
end;
$$;
revoke all on function public.record_page_view(text) from public, anon, authenticated;
grant execute on function public.record_page_view(text) to service_role;
