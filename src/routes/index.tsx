import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Cookie, Package, ShoppingBag, Wallet, LayoutDashboard, ArrowRight, ClipboardList, LogOut, BookOpen } from "lucide-react";
import { InventoryManager } from "@/components/inventory-manager";
import { ProductManager } from "@/components/product-manager";
import { SalesFinanceManager } from "@/components/sales-finance-manager";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/lib/use-auth-session";
import { BusinessProvider } from "@/lib/business-store";
import { PackagingManager } from "@/components/packaging-manager";
import { SupplierManager } from "@/components/supplier-manager";
import { RecipeManager } from "@/components/recipe-manager";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ana Bolachas Artesanais | Painel da produção" },
      { name: "description", content: "Acompanhe estoque, receitas, produção, vendas e finanças da Ana Bolachas Artesanais." },
      { property: "og:title", content: "Ana Bolachas Artesanais | Painel da produção" },
      { property: "og:description", content: "Acompanhe estoque, receitas, produção, vendas e finanças da Ana Bolachas Artesanais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Area = "embalagens" | "fornecedores" | "visao-geral" | "estoque" | "produtos" | "receitas" | "vendas" | "financeiro";

const areas: { id: Area; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "visao-geral", label: "Visão geral", icon: LayoutDashboard },
  { id: "embalagens", label: "Embalagens", icon: Package },
  { id: "fornecedores", label: "Fornecedores", icon: ClipboardList },
  { id: "estoque", label: "Estoque", icon: Package },
  { id: "produtos", label: "Produtos", icon: Cookie },
  { id: "receitas", label: "Receitas / Fichas Técnicas", icon: BookOpen },
  { id: "vendas", label: "Vendas", icon: ShoppingBag },
  { id: "financeiro", label: "Financeiro", icon: Wallet },
];

const areaDetails: Record<Area, { title: string; description: string }> = {
  "visao-geral": {
    title: "Visão geral",
    description: "Um espaço para acompanhar a rotina e os números da sua produção.",
  },
  embalagens: { title: "Embalagens", description: "Consulte materiais de apresentação, medidas e custos por unidade." },
  fornecedores: { title: "Fornecedores", description: "Consulte e mantenha os contatos dos seus fornecedores." },
  estoque: {
    title: "Estoque de matérias-primas",
    description: "Organize ingredientes, quantidades disponíveis e movimentações do estoque.",
  },
  produtos: {
    title: "Produtos e receitas",
    description: "Cadastre suas bolachas e associe os ingredientes usados em cada receita.",
  },
  receitas: {
    title: "Receitas / Fichas Técnicas",
    description: "Consulte e mantenha as fichas de preparo das suas receitas.",
  },
  vendas: {
    title: "Vendas",
    description: "Registre pedidos e acompanhe a saída dos seus produtos.",
  },
  financeiro: {
    title: "Controle financeiro",
    description: "Acompanhe custos, precificação, faturamento e lucro em um só lugar.",
  },
};

function Index() {
  const { session, loading } = useAuthSession();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbf8f3] px-5">
        <p className="text-sm text-[#897d72]">Verificando sua sessão…</p>
      </main>
    );
  }

  if (!session) return <Navigate to="/login" />;

  return <Dashboard key={session.user.id} userId={session.user.id} email={session.user.email ?? ""} />;
}

function Dashboard({ email, userId }: { email: string; userId: string }) {
  const [activeArea, setActiveArea] = useState<Area>("visao-geral");
  const [requestedRecipeId, setRequestedRecipeId] = useState<string>();
  const [authError, setAuthError] = useState("");
  const currentArea = areaDetails[activeArea];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" onClick={() => setActiveArea("visao-geral")}>
          <span className="brand-mark"><Cookie size={23} strokeWidth={1.8} /></span>
          <span className="brand-copy">
            <strong>Ana Bolachas</strong>
            <span>ARTESANAIS</span>
          </span>
        </a>

        <div className="nav-caption">PAINEL</div>
        <nav className="main-nav" aria-label="Navegação principal">
          {areas.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-link${activeArea === id ? " is-active" : ""}`}
              onClick={() => { setRequestedRecipeId(undefined); setActiveArea(id); }}
              aria-current={activeArea === id ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {activeArea === id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <span className="note-icon"><Cookie size={17} /></span>
          <p>Feito com carinho, organizado com cuidado.</p>
        </div>
        <div className="sidebar-footer">ANA BOLACHAS ARTESANAIS</div>
      </aside>

      <main className="main-area" id="inicio">
        <header className="topbar">
          <div className="breadcrumb">Ana Bolachas <span>/</span> {currentArea.title}</div>
          <div className="flex items-center gap-3">
            <div className="topbar-tag"><span className="status-dot" /> Painel da produção</div>
            {email && <span className="hidden text-xs text-[#897d72] sm:inline">{email}</span>}
            <button
              type="button"
              onClick={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) setAuthError("Não foi possível sair da conta. Tente novamente.");
              }}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#e5dcd2] px-3 text-xs font-semibold text-[#786c62] hover:bg-[#faf6f0]"
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        </header>

        <div className="page-content">
          {authError && <p role="alert" className="mb-4 rounded-lg border border-[#efd9d0] bg-[#fcf1ed] px-4 py-3 text-sm text-[#96543f]">{authError}</p>}
          <section className="welcome-block">
            <div>
              <span className="eyebrow">BEM-VINDA AO SEU PAINEL</span>
              <h1>{activeArea === "visao-geral" ? "Sua produção, em boas mãos." : currentArea.title}</h1>
              <p>{activeArea === "visao-geral" ? "Tudo pronto para organizar o dia a dia da Ana Bolachas Artesanais." : currentArea.description}</p>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <span className="art-sun" />
              <Cookie size={69} strokeWidth={1.15} />
              <span className="art-sparkle sparkle-one">✳</span>
              <span className="art-sparkle sparkle-two">✦</span>
            </div>
          </section>

          <div hidden={activeArea === "embalagens" || activeArea === "receitas" || activeArea === "fornecedores"}>
          <BusinessProvider>{activeArea === "embalagens" || activeArea === "receitas" || activeArea === "fornecedores" ? null : activeArea === "estoque" ? (
            <InventoryManager userId={userId} />
          ) : activeArea === "produtos" ? (
            <ProductManager userId={userId} onViewRecipe={(id) => { setRequestedRecipeId(id); setActiveArea("receitas"); }} />
          ) : activeArea === "vendas" ? (
            <SalesFinanceManager mode="vendas" userId={userId} />
          ) : activeArea === "financeiro" ? (
            <SalesFinanceManager mode="financeiro" userId={userId} />
          ) : activeArea === "visao-geral" ? (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">ACOMPANHAMENTO</span>
                  <h2>Comece por aqui</h2>
                </div>
                <span className="data-label"><span className="status-dot" /> Seus registros aparecerão aqui</span>
              </div>

              <section className="summary-grid" aria-label="Áreas do sistema">
                {[
                  { id: "estoque" as Area, number: "01", title: "Matérias-primas", text: "Cadastre ingredientes e acompanhe o que tem na despensa.", icon: Package, tone: "peach" },
                  { id: "produtos" as Area, number: "02", title: "Produtos e receitas", text: "Monte suas receitas e conheça o custo de cada produto.", icon: Cookie, tone: "sage" },
                  { id: "vendas" as Area, number: "03", title: "Vendas", text: "Registre pedidos e mantenha as vendas organizadas.", icon: ShoppingBag, tone: "lavender" },
                  { id: "financeiro" as Area, number: "04", title: "Financeiro", text: "Tenha uma visão clara de custos, preços e resultados.", icon: Wallet, tone: "butter" },
                ].map(({ id, number, title, text, icon: Icon, tone }) => (
                  <button className="summary-card" type="button" key={id} onClick={() => setActiveArea(id)}>
                    <span className={`card-icon ${tone}`}><Icon size={20} strokeWidth={1.8} /></span>
                    <span className="card-number">{number}</span>
                    <strong>{title}</strong>
                    <span className="card-description">{text}</span>
                    <span className="card-link">Acessar área <ArrowRight size={15} /></span>
                  </button>
                ))}
              </section>

              <section className="getting-started">
                <div className="getting-icon"><ClipboardList size={21} /></div>
                <div className="getting-copy">
                  <span className="eyebrow">PRIMEIRO PASSO</span>
                  <h2>Cadastre suas matérias-primas</h2>
                  <p>Comece pelo estoque de ingredientes. Depois, você poderá montar receitas e calcular o custo dos seus produtos.</p>
                </div>
                <button className="primary-action" type="button" onClick={() => setActiveArea("estoque")}>
                  Ir para estoque <ArrowRight size={16} />
                </button>
              </section>
            </>
          ) : (
            <section className="empty-panel">
              <span className="empty-icon"><ClipboardList size={27} strokeWidth={1.6} /></span>
              <span className="eyebrow">ÁREA PRONTA PARA ORGANIZAR</span>
              <h2>{currentArea.title}</h2>
              <p>{currentArea.description}</p>
              <div className="empty-divider" />
              <span className="empty-hint">Quando você começar a cadastrar informações, elas aparecerão aqui.</span>
              {activeArea !== "estoque" && (
                <button className="text-action" type="button" onClick={() => setActiveArea("estoque")}>
                  Começar pelo estoque <ArrowRight size={15} />
                </button>
              )}
            </section>
          )}</BusinessProvider>
          </div>
          {activeArea === "embalagens" && <PackagingManager userId={userId} />}
          {activeArea === "fornecedores" && <SupplierManager userId={userId} />}
          {activeArea === "receitas" && <RecipeManager key={requestedRecipeId ?? "list"} userId={userId} initialRecipeId={requestedRecipeId} />}

          <footer className="page-footer">Um painel feito para acompanhar cada fornada. <span>♡</span></footer>
        </div>
      </main>
    </div>
  );
}
