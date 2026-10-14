-- Private feedback data. Only the Edge Function's server key may access these tables.
create table public.feedback_tickets (
  id uuid primary key,
  token_hash text not null check (length(token_hash) = 64),
  payload_hash text not null check (length(payload_hash) = 64),
  category text not null check (category in ('计算结果不符','页面使用问题','功能建议','其他')),
  message text not null check (length(message) between 1 and 3000),
  context text not null default '' check (length(context) <= 12000),
  status text not null default '待处理' check (status in ('待处理','处理中','已解决')),
  reply text not null default '' check (length(reply) <= 3000),
  upload_state text not null default 'pending' check (upload_state in ('pending','ready')),
  attachments jsonb not null default '[]'::jsonb,
  image_bytes integer not null check (image_bytes between 0 and 15728640),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_tickets_created on public.feedback_tickets(created_at desc);
alter table public.feedback_tickets enable row level security;
revoke all on public.feedback_tickets from anon, authenticated;
grant all on public.feedback_tickets to service_role;

-- Serialize reservations so concurrent anonymous uploads cannot exceed the allowance.
create function public.reserve_feedback(p_id uuid,p_token_hash text,p_payload_hash text,p_category text,p_message text,p_context text,p_image_bytes integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.feedback_tickets;
begin
  perform pg_advisory_xact_lock(20261014);
  select * into existing from public.feedback_tickets where id=p_id;
  if found then
    if existing.token_hash <> p_token_hash or existing.payload_hash <> p_payload_hash then
      raise exception 'feedback_conflict';
    end if;
    return jsonb_build_object('state',existing.upload_state);
  end if;
  if (select count(*) from public.feedback_tickets where created_at > now()-interval '24 hours') >= 30 then
    raise exception 'feedback_daily_limit';
  end if;
  if (select coalesce(sum(image_bytes),0) from public.feedback_tickets)+p_image_bytes > 786432000 then
    raise exception 'feedback_storage_limit';
  end if;
  insert into public.feedback_tickets(id,token_hash,payload_hash,category,message,context,image_bytes)
  values(p_id,p_token_hash,p_payload_hash,p_category,p_message,p_context,p_image_bytes);
  return jsonb_build_object('state','pending');
end;
$$;
revoke all on function public.reserve_feedback(uuid,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_feedback(uuid,text,text,text,text,text,integer) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('feedback-images','feedback-images',false,5242880,array['image/png','image/jpeg','image/webp']);
-- No anonymous/authenticated storage policies: screenshots are private by default.
