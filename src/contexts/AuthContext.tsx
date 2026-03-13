import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profileComplete: boolean;
  checkProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profileComplete: false,
  checkProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

  const checkProfile = async (uid?: string) => {
    const id = uid || user?.id;
    if (!id) { setProfileComplete(false); return; }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, date_of_birth")
        .eq("user_id", id)
        .maybeSingle();
      setProfileComplete(!!(data?.display_name && data?.date_of_birth));
    } catch {
      setProfileComplete(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        // Defer profile check to avoid Supabase client deadlock
        setTimeout(() => checkProfile(session.user.id), 0);
      } else {
        setProfileComplete(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfileComplete(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profileComplete, checkProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
