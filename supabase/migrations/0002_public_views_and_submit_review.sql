grant select on public.company_public_stats to anon, authenticated;

create or replace view public.public_reviews with (security_invoker=true) as
select id,company_id,pseudonym,employment_verified,role_title,department,location,employment_status,tenure_label,body,tags,work_life_balance,management,office_politics,compensation,published_at,created_at
from public.reviews where moderation_status='approved';
grant select on public.public_reviews to anon, authenticated;

create or replace view public.review_vote_totals with (security_invoker=true) as
select review_id,coalesce(sum(value),0)::int as vote_score
from public.review_votes group by review_id;
grant select on public.review_vote_totals to anon, authenticated;

create or replace function public.submit_review(
  p_company_slug text,p_role_title text,p_department text,p_location text,p_employment_status text,p_tenure_label text,p_body text,p_tags text[],p_work_life_balance smallint,p_management smallint,p_office_politics smallint,p_compensation smallint
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_company_id uuid; v_username text; v_verification_id uuid; v_review_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(coalesce(p_body,'')))<30 or char_length(p_body)>6000 then raise exception 'Review must be 30-6000 characters'; end if;
  if p_employment_status not in ('current','former') then raise exception 'Invalid employment status'; end if;
  if p_work_life_balance not between 1 and 5 or p_management not between 1 and 5 or p_office_politics not between 1 and 5 or p_compensation not between 1 and 5 then raise exception 'Ratings must be 1-5'; end if;
  select id into v_company_id from public.companies where slug=p_company_slug;
  if v_company_id is null then raise exception 'Company not found'; end if;
  select username into v_username from public.profiles where id=v_uid;
  select id into v_verification_id from public.employment_verifications where user_id=v_uid and company_id=v_company_id and status='verified' order by verified_at desc nulls last limit 1;
  insert into public.reviews(user_id,company_id,verification_id,pseudonym,employment_verified,role_title,department,location,employment_status,tenure_label,body,tags,work_life_balance,management,office_politics,compensation,moderation_status,moderation_source)
  values(v_uid,v_company_id,v_verification_id,coalesce(v_username,'@user_'||substr(v_uid::text,1,8)),v_verification_id is not null,left(trim(p_role_title),120),nullif(left(trim(coalesce(p_department,'')),120),''),left(trim(p_location),120),p_employment_status,nullif(left(trim(coalesce(p_tenure_label,'')),60),''),trim(p_body),coalesce(p_tags,'{}'::text[]),p_work_life_balance,p_management,p_office_politics,p_compensation,'pending','rpc') returning id into v_review_id;
  return v_review_id;
end; $$;
revoke execute on function public.submit_review(text,text,text,text,text,text,text,text[],smallint,smallint,smallint,smallint) from public, anon;
grant execute on function public.submit_review(text,text,text,text,text,text,text,text[],smallint,smallint,smallint,smallint) to authenticated;
