-- Allow owners to read all content reports for moderation
CREATE POLICY "Owners can view all reports"
ON public.content_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Allow owners to read all profiles count
CREATE POLICY "Owners can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));