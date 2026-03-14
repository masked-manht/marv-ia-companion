import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profileComplete: boolean;
  isOwner: boolean;
  checkProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profileComplete: false,
  isOwner: false,
  checkProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

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

  const checkOwnerRole = async (uid: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "owner")
        .maybeSingle();
      setIsOwner(!!data);
    } catch {
      setIsOwner(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => {
          checkProfile(session.user.id);
          checkOwnerRole(session.user.id);
        }, 0);
      } else {
        setProfileComplete(false);
        setIsOwner(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkProfile(session.user.id);
        checkOwnerRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfileComplete(false);
    setIsOwner(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profileComplete, isOwner, checkProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
