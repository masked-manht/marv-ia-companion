
-- Allow users to delete their own profiles (for account deletion)
CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete their own reports (for account deletion)
CREATE POLICY "Users can delete their own reports"
ON public.content_reports FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete their own credits (for account deletion)
CREATE POLICY "Users can delete their own credits"
ON public.user_credits FOR DELETE TO authenticated
USING (auth.uid() = user_id);
