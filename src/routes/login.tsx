import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Cookie } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/lib/use-auth-session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar | Ana Bolachas Artesanais" },
      { name: "description", content: "Acesse o painel de gestão da Ana Bolachas Artesanais." },
      { property: "og:title", content: "Entrar | Ana Bolachas Artesanais" },
      { property: "og:description", content: "Acesse sua conta e seus registros da Ana Bolachas Artesanais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

type AuthMode = "entrar" | "cadastro";

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading, error: sessionError } = useAuthSession();
  const [mode, setMode] = useState<AuthMode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "entrar") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError("Não foi possível entrar. Confira o e-mail e a senha e tente novamente.");
        } else {
          await navigate({ to: "/" });
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) {
          setError("Não foi possível criar a conta. Confira os dados e tente novamente.");
        } else if (data.session) {
          await navigate({ to: "/" });
        } else {
          setMessage("Cadastro recebido. Confira seu e-mail para confirmar a conta antes de entrar.");
        }
      }
    } catch {
      setError("O serviço de autenticação não respondeu. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbf8f3] px-5">
        <p className="text-sm text-[#897d72]">Verificando sua sessão…</p>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#fbf8f3] px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[#eee7de] bg-[#fffdfa] p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f4e8d9] text-[#80593e]">
            <Cookie size={23} />
          </span>
          <div>
            <p className="font-serif text-lg font-semibold text-[#4a3c33]">Ana Bolachas</p>
            <p className="text-[10px] font-bold tracking-[2px] text-[#a28c78]">ARTESANAIS</p>
          </div>
        </div>

        <h1 className="font-serif text-2xl font-medium text-[#4a3c33]">
          {mode === "entrar" ? "Acesse seu painel" : "Crie sua conta"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#897d72]">
          {mode === "entrar"
            ? "Entre com seu e-mail e senha para continuar."
            : "Cadastre seu e-mail e uma senha para começar."}
        </p>

        {(sessionError || error) && (
          <p role="alert" className="mt-5 rounded-lg border border-[#efd9d0] bg-[#fcf1ed] px-3 py-2.5 text-sm text-[#96543f]">
            {error || sessionError}
          </p>
        )}
        {message && (
          <p role="status" className="mt-5 rounded-lg border border-[#e5e9dc] bg-[#f3f6ee] px-3 py-2.5 text-sm text-[#5f7257]">
            {message}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs font-medium text-[#786c62]">
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]"
            />
          </label>
          <label className="block text-xs font-medium text-[#786c62]">
            Senha
            <input
              required
              type="password"
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]"
            />
            {mode === "cadastro" && <span className="mt-1 block text-[11px] text-[#a19488]">Use pelo menos 6 caracteres.</span>}
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#815a40] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#69462f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#897d72]">
          {mode === "entrar" ? "Ainda não tem uma conta?" : "Já tem uma conta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "entrar" ? "cadastro" : "entrar");
              setError("");
              setMessage("");
            }}
            className="font-semibold text-[#80583e] underline-offset-4 hover:underline"
          >
            {mode === "entrar" ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </section>
    </main>
  );
}
