import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

type AuthSessionState = {
  session: Session | null;
  loading: boolean;
  error: string | null;
};

export function useAuthSession() {
  const [state, setState] = useState<AuthSessionState>({
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    let authEvents = 0;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      authEvents += 1;
      if (active) setState({ session, loading: false, error: null });
    });
    const initialAuthEvents = authEvents;

    void supabase.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (!active || authEvents !== initialAuthEvents) return;
        setState({
          session: sessionData.session,
          loading: false,
          error: error ? "Não foi possível verificar sua sessão. Tente novamente." : null,
        });
      })
      .catch(() => {
        if (!active || authEvents !== initialAuthEvents) return;
        setState({
          session: null,
          loading: false,
          error: "Não foi possível verificar sua sessão. Tente novamente.",
        });
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
