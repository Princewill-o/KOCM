-- Retain an assigned campus identity after closure, without reactivating reports.
create policy "Assigned users retain campus identity" on public.campuses for select to authenticated
using ((select private.my_role()) in ('campus','cluster') and private.can_access_campus(id));
