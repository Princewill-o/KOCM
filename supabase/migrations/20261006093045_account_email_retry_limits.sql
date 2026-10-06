-- Bound each batch to the hosted runtime and avoid exhausting retries on repeated clicks.
create or replace function public.claim_account_emails()
returns setof private.account_email_deliveries language sql security definer set search_path='' as $$
 update private.account_email_deliveries d set status='sending',attempts=d.attempts+1,claimed_at=now(),last_error=null
 where d.id in (select q.id from private.account_email_deliveries q join public.profiles p on p.id=q.user_id
  where p.status='rejected' and p.email=q.recipient and q.attempts<5
   and ((q.status='pending' or (q.status='failed' and q.claimed_at<now()-interval '1 minute')) or (q.status='sending' and q.claimed_at<now()-interval '10 minutes'))
  order by q.created_at limit 3 for update of q skip locked)
 returning d.*
$$;
