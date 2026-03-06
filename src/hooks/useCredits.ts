import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const PRO_MODELS = ["google/gemini-2.5-pro"];
const FREE_MODELS = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];

export function isProModel(model: string) {
  return PRO_MODELS.includes(model);
}

export function isProFeature(feature: string) {
  return feature === "image_generation" || feature === "pro_model";
}

export function useCredits(userId: string | undefined) {
  const [credits, setCredits] = useState<number>(25);
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("get_or_reset_credits", { p_user_id: userId });
    if (!error && data !== null) setCredits(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const consumeCredit = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const { data, error } = await supabase.rpc("consume_credit", { p_user_id: userId });
    if (error) return false;
    if (data === 0 && credits <= 0) return false;
    setCredits(data ?? 0);
    return true;
  }, [userId, credits]);

  return { credits, loading, consumeCredit, refreshCredits: fetchCredits };
}
