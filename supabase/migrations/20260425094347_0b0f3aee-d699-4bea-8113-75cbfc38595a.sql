CREATE POLICY "Update own membership"
ON public.chat_members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.chat_members REPLICA IDENTITY FULL;