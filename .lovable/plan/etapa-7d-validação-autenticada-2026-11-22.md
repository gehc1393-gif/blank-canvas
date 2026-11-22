# Etapa 7D — Validação autenticada

## Limitação encontrada
Este projeto usa um Supabase próprio (externo). Nesse caso o Lovable não consegue me entregar uma sessão já conectada, e eu não posso pedir nem usar senhas. Sem uma conta de testes, os testes 1 a 5 com login não podem ser feitos por mim.

## Proposta
1. **Criar uma conta de testes pela própria tela de cadastro do app** (e-mail descartável, ex.: `teste-7d+<data>@exemplo.com`, senha aleatória gerada e nunca exibida). Só funciona se o Supabase não exigir confirmação por e-mail; se exigir, paro e informo.
2. Com essa conta, rodar no navegador automatizado (computador 1280px e celular 390px):
   - Teste 1: login, painel, nome/e-mail correto, sair.
   - Teste 2: criar ficha "TESTE-7D", incluir ingredientes, salvar, consultar, editar, recarregar.
   - Teste 3: Farinha 500 g a R$ 8/kg, Manteiga 250 g a R$ 44/kg, Açúcar 220 g a R$ 8/kg, rendimento 20 — esperado R$ 16,76 e R$ 0,838/unidade.
   - Teste 4: produto de teste vinculado, apresentação de 10 unidades — esperado R$ 8,38; recarregar e conferir vínculo.
   - Teste 5: conferir chamadas ao Supabase, ausência de duplicações e, por consulta somente leitura, que a conta de teste não enxerga dados de outras contas.
3. Registrar os identificadores criados e entregar o relatório no formato pedido, com conclusão sobre a Etapa 8 (sem implementá-la).

## Limpeza (ponto que precisa da sua decisão)
- As fichas técnicas **não podem ser apagadas** pelas regras atuais (só inativadas), e o histórico de versões é permanente. Sem migração nem acesso administrativo, os dados de teste ficariam **inativados** dentro da conta de testes isolada — nunca na sua conta real.
- A conta de testes em si só pode ser removida por você no painel do Supabase (Authentication → Users).

## O que não será feito
Nenhuma alteração de código, migração, uso de chave administrativa ou mexida em registros reais.
