
-- Daily credits table
CREATE TABLE public.user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credits_remaining integer NOT NULL DEFAULT 25,
  last_reset_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint on user_id
ALTER TABLE public.user_credits ADD CONSTRAINT user_credits_user_id_unique UNIQUE (user_id);

-- Enable RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own credits" ON public.user_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own credits" ON public.user_credits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own credits" ON public.user_credits FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Function to get or create credits with daily reset
CREATE OR REPLACE FUNCTION public.get_or_reset_credits(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
  last_reset timestamp with time zone;
BEGIN
  SELECT credits_remaining, last_reset_at INTO current_credits, last_reset
  FROM public.user_credits WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, credits_remaining, last_reset_at)
    VALUES (p_user_id, 25, now());
    RETURN 25;
  END IF;
  
  -- Reset if last reset was before today (UTC)
  IF last_reset::date < now()::date THEN
    UPDATE public.user_credits 
    SET credits_remaining = 25, last_reset_at = now()
    WHERE user_id = p_user_id;
    RETURN 25;
  END IF;
  
  RETURN current_credits;
END;
$$;

-- Function to consume a credit
CREATE OR REPLACE FUNCTION public.consume_credit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
BEGIN
  -- First ensure reset
  PERFORM public.get_or_reset_credits(p_user_id);
  
  SELECT credits_remaining INTO current_credits
  FROM public.user_credits WHERE user_id = p_user_id;
  
  IF current_credits <= 0 THEN
    RETURN 0;
  END IF;
  
  UPDATE public.user_credits 
  SET credits_remaining = credits_remaining - 1
  WHERE user_id = p_user_id;
  
  RETURN current_credits - 1;
END;
$$;
