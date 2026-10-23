# Nexo — contexto e orientações para agentes de código

## Objetivo
Nexo é um organizador financeiro pessoal, desenvolvido como projeto de estudo e para uso prático. O objetivo é consolidar fundamentos de HTML, CSS e JavaScript antes de integrar um backend Java/Spring Boot com banco de dados SQL.

## Fonte de verdade
Este documento descreve decisões e o estado conhecido do projeto, mas pode estar desatualizado. **Inspecione os arquivos reais antes de tirar conclusões.** Quando houver divergência, informe-a. Não presuma que recursos planejados já foram implementados.

## Tecnologias e estrutura conhecida
- Frontend: HTML, CSS e JavaScript puro, sem framework.
- Persistência atual: `localStorage`.
- Arquivos principais conhecidos: `frontend/index.html`, `frontend/css/style.css` e `frontend/js/script.js`. Confirme a estrutura real.
- Versionamento: Git/GitHub. A branch de trabalho do frontend é `frontend`.
- Backend futuro: Java, Spring Boot e SQL; não introduzir backend nesta fase sem solicitação.

## Estado conhecido da implementação
As funcionalidades abaixo foram verificadas no frontend. **Decisões de produto** registra as regras que devem ser preservadas; os recursos pendentes estão em **Limites de escopo e pendências**.

### Resumo
- Os cards de receitas e despesas mostram os totais históricos de transações. O card **Saldo disponível** usa os saldos atuais das contas marcadas para inclusão.
- Tabela de transações recentes, limitada a cinco registros.
- Botões para adicionar receita e despesa; modal com validações.
- Lista compacta de até três contas com nomes e saldos atuais, com acesso à página Contas. Sem contas, há um botão para cadastrar a primeira usando o modal existente; dados indisponíveis têm mensagem própria.
- Histórico/Projeção de Transações ainda não possui gráfico funcional.

### Transações
- CRUD de receitas e despesas com IDs UUID e persistência local.
- Modal compartilhado para criação/edição; campos condicionais conforme o tipo.
- Seleção de registros, barra contextual, edição de um registro e exclusão com confirmação.
- Página de listagem completa, busca por nome, filtros por tipo, categoria e datas, e paginação.
- Navegação entre páginas via `data-pagina`, com destaque da página ativa.
- As duas tabelas devem permanecer sincronizadas após operações.
- O formulário exige uma conta cadastrada e lista as contas reais. As transações usam `contaId`; os nomes exibidos são resolvidos pelo ID, preservando vínculos após renomear contas.

### Contas
- Cadastro e edição compartilham o modal com nome, tipo, instituição opcional, `saldoInicial` não negativo, `dataReferencia` válida e `incluirNoSaldoDisponivel` booleano. A edição preserva o ID UUID original.
- Tipos suportados: conta corrente (`corrente`), poupança (`poupanca`), reserva (`reserva`) e carteira física (`carteira`).
- Exclusão com confirmação própria, permitida somente sem transações vinculadas ao ID. Vínculos históricos ou futuros também bloqueiam a exclusão; dados de transações indisponíveis impedem confirmar a ausência de vínculos. A regra é verificada ao abrir e ao confirmar a exclusão.
- A página mostra o saldo atual individual e o **Saldo total** de todas as contas, mantendo ações de edição e exclusão. Cartões e crédito disponível foram removidos da interface.
- Contas e transações são coleções separadas no `localStorage`, com validação dos registros e dos vínculos após carregar ambas.

### Validação, acessibilidade e persistência
- Formulários com mensagens por campo, foco no primeiro erro e limpeza de erros; modais com semântica de diálogo, controle de foco e `inert` no conteúdo ao fundo.
- Leitura e gravação protegidas do `localStorage`, validação de registros e bloqueio de coleções inválidas, com indicação de dados indisponíveis.
- Notificações toast para feedback geral; preservar mensagens de validação nos campos e estados persistentes nas páginas.
- JSON inválido, coleções que não sejam arrays, registros inválidos ou IDs repetidos bloqueiam a coleção. Vínculos inválidos tornam as transações indisponíveis; não corrigir, excluir ou reassociar registros automaticamente.
- Saldos indisponíveis não devem ser exibidos como zero ou como resultados parciais confiáveis. Falhas de gravação mantêm dados anteriores, campos preenchidos e modais abertos; sucesso só é comunicado após persistir.

## Decisões de produto
- A página **Contas** reúne contas e reservas; cartões de crédito estão fora da versão atual.
- Instituição é um campo opcional; evitar aumentar o escopo sem discutir custos, benefícios e dependências.

### Contas e cálculo de saldos
- Saldo inicial e data de referência são editáveis; o saldo inicial representa o dinheiro existente **ao final** dessa data.
- Calcular `saldoAtual = saldoInicial + receitas vinculadas - despesas vinculadas`, considerando somente transações com `data > dataReferencia` e `data <= hoje` (dia atual local).
- Transações anteriores ou iguais à referência permanecem no histórico, mas não alteram o saldo atual. Recalcular após mudanças na conta ou nas transações, sem depender dos filtros ou da paginação.
- O saldo calculado pode ser negativo. Não persistir um `saldoAtual` separado no `localStorage` nem implementar ajustes manuais de saldo separados nesta etapa.
- `calcularSaldos()` centraliza as operações em centavos inteiros, valida limites numéricos seguros e não modifica os objetos recebidos. `obterSaldosContas()` respeita as coleções bloqueadas; `atualizarVisualizacoesSaldos()` compartilha o resultado com Contas e Resumo.
- As visualizações são atualizadas após operações persistidas de contas e transações, na inicialização, em `pageshow` e ao retornar à aba (`visibilitychange`). Não há atualização programada à meia-noite para uma aba continuamente visível; recarregar ou retornar à aplicação recalcula com a data local.

### Saldo disponível e Resumo
- `incluirNoSaldoDisponivel` é configurável independentemente do tipo da conta. No cadastro, a sugestão é marcada para contas comuns e desmarcada para reserva, respeitando a escolha manual; na edição prevalece a opção salva.
- **Saldo disponível** soma somente os saldos das contas marcadas, inclusive negativos. **Saldo total** soma os saldos de todas as contas, independentemente dessa opção.
- Preservar o estado vazio, o cadastro pelo modal existente e a lista compacta com acesso ao gerenciamento, distinguindo ausência de contas de dados indisponíveis.

### Vínculo das transações e exclusão de contas
- Exigir uma conta cadastrada para criar uma transação e manter a associação por `contaId`, nunca pelo nome do banco.
- Permitir datas válidas anteriores ao cadastro da conta e datas futuras. Transações futuras permanecem registradas e só afetam o saldo atual a partir da respectiva data, respeitando a referência da conta.
- Criar, editar ou excluir transações deve atualizar os saldos calculados, incluindo mudanças de conta, valor, tipo ou data. O histórico completo permanece disponível em listagens e relatórios.
- Excluir somente contas sem transações vinculadas. Bloquear a exclusão se houver qualquer vínculo, inclusive histórico, e explicar o motivo; não excluir nem transferir transações automaticamente.

### Limites de escopo e pendências
- Não implementar agendamento, pagamentos antecipados, controle de crédito ou cálculos de faturas, parcelas e limites nesta etapa; a edição normal da data da transação é suficiente.
- Limite de cartão de crédito não é dinheiro disponível na conta e não deve ser somado aos saldos.
- Transferências permanecem fora do escopo desta etapa.
- Não há integração bancária automática nem mecanismo independente de agendamento; datas futuras são registros normais, sujeitos às regras de cálculo acima.
- Responsividade geral e modo escuro continuam pendentes. Existem ajustes responsivos pontuais, mas a navegação lateral ainda comprime o conteúdo em telas pequenas.
- Histórico/Projeção permanece sem gráfico funcional. Não presumir implementações de cartões, faturas, parcelamentos ou cálculo de limites de crédito.

### Segurança da persistência
- Preservar validações, tratamento de erros e toasts. Confirmar a gravação antes de alterar memória ou interface como se a operação tivesse sido concluída; em caso de falha, preservar formulários e modais abertos.
- Os dados fictícios antigos foram removidos manualmente para adoção do modelo atual, sem migração. Isso não autoriza novas limpezas automáticas durante a inicialização nem descarte silencioso de dados inválidos.

## Preferências de desenvolvimento
- O projeto é individual e educativo. Priorizar soluções compreensíveis e progressivas.
- Manter HTML, CSS e JavaScript puro nesta fase.
- Reutilizar padrões existentes quando fizer sentido, sem criar abstrações desnecessárias.
- Preservar nomes, organização e estilo atuais, salvo quando houver uma justificativa clara para mudança.
- Não adicionar dependências, bibliotecas, frameworks ou alterar a arquitetura sem aprovação.
- Não apagar dados do `localStorage` nem executar comandos destrutivos sem autorização explícita; o descarte manual dos dados fictícios antigos não é autorização permanente para novas exclusões.
- Não criar commits, fazer push, merge ou alterar branches sem autorização explícita.
- Antes de qualquer mudança significativa, explicar o objetivo e o impacto.
- Ao propor melhorias, distinguir bugs, riscos, redundâncias, acessibilidade, UX, desempenho e preferências estéticas.

## Primeira tarefa: auditoria somente leitura
O primeiro contato com o repositório deve ser **apenas de análise**. Não editar arquivos, não instalar pacotes e não executar comandos que modifiquem o projeto. Verificar:
1. Estrutura real dos arquivos e fluxo entre páginas.
2. Qualidade e organização de HTML/CSS/JS.
3. Duplicações, código morto, seletores redundantes e oportunidades de reutilização.
4. Bugs, estados inconsistentes e riscos no CRUD, filtros, paginação, seleção, validação e `localStorage`.
5. Acessibilidade, responsividade e consistência visual.
6. Estado real da página Contas e consistência da integração com transações e saldos.
7. Divergências entre este documento e a implementação.

Apresentar achados com **arquivo e localização aproximada**, evidência concreta, gravidade/prioridade e sugestão objetiva. Distinguir fatos verificados de hipóteses. Ao final, propor um plano incremental de melhorias, sem executá-lo até aprovação.
