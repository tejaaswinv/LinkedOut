create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create policy "reviews public approved" on public.reviews for select to anon, authenticated using (moderation_status='approved' or auth.uid()=user_id);
grant select (id,company_id,pseudonym,employment_verified,role_title,department,location,employment_status,tenure_label,body,tags,work_life_balance,management,office_politics,compensation,moderation_status,published_at,created_at) on public.reviews to anon, authenticated;
create policy "votes public aggregate source" on public.review_votes for select to anon, authenticated using (true);
grant select (review_id,value) on public.review_votes to anon, authenticated;
