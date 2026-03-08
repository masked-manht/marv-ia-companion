
CREATE OR REPLACE FUNCTION public.purge_old_deleted_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete messages of conversations deleted more than 30 days ago
  DELETE FROM public.messages
  WHERE conversation_id IN (
    SELECT id FROM public.conversations
    WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days'
  );
  
  -- Delete the conversations themselves
  DELETE FROM public.conversations
  WHERE deleted_at IS NOT NULL
  AND deleted_at < now() - interval '30 days';
END;
$$;
