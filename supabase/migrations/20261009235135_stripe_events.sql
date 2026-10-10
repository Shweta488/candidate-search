-- Stripe events, applied once and in order (LLD 2.2, 5.4).
--
-- Every verified event is recorded by id, so a repeat delivery changes nothing. A
-- subscription only moves forward: an event older than the one already applied, by
-- (event.created, event id), is recorded as stale and leaves the subscription alone.

create table private.stripe_events (
  id text primary key, -- Stripe event id, the dedupe key
  type text not null,
  created bigint not null, -- event.created, which decides order
  outcome text not null check (outcome in ('applied', 'stale', 'ignored')),
  received_at timestamptz not null default now()
);

alter table private.stripe_events enable row level security; -- no policies: server only
grant all on private.stripe_events to service_role;

-- p_subscription_id, p_company_code and p_status are null for event types we don't use.
-- Returns 'applied', 'duplicate', 'stale' or 'ignored'.
create function private.apply_stripe_event(
  p_event_id text,
  p_type text,
  p_created bigint,
  p_subscription_id text,
  p_company_code text,
  p_status text
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_outcome text;
begin
  -- 1. Record the event. A second delivery of the same id inserts nothing.
  insert into private.stripe_events (id, type, created, outcome)
  values (p_event_id, p_type, p_created, 'ignored')
  on conflict (id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  -- 2. Not a subscription event, or for a company we don't have: keep it as ignored.
  if p_subscription_id is null then
    return 'ignored';
  end if;
  select id into v_company_id from private.companies where code = p_company_code;
  if v_company_id is null then
    return 'ignored';
  end if;

  -- 3. Write the subscription only if this event is newer. Two events in the same second
  -- are ordered by event id, so the result doesn't depend on which arrives first.
  insert into private.subscriptions (id, company_id, status, last_event_created, last_event_id)
  values (p_subscription_id, v_company_id, p_status, p_created, p_event_id)
  on conflict (id) do update
    set status = excluded.status,
        last_event_created = excluded.last_event_created,
        last_event_id = excluded.last_event_id,
        updated_at = now()
    where (private.subscriptions.last_event_created, private.subscriptions.last_event_id)
        < (excluded.last_event_created, excluded.last_event_id);
  v_outcome := case when found then 'applied' else 'stale' end;

  -- 4. Keep the outcome with the event.
  update private.stripe_events set outcome = v_outcome where id = p_event_id;
  return v_outcome;
end;
$$;

revoke execute on function private.apply_stripe_event(text, text, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function private.apply_stripe_event(text, text, bigint, text, text, text)
  to service_role;
