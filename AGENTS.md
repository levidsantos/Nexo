# Nexo — contexto e orientações para agentes de código

## Objetivo
Nexo é um organizador financeiro pessoal, desenvolvido como projeto de estudo e para uso prático. O objetivo é consolidar fundamentos de HTML, CSS e JavaScript antes de integrar um backend Java/Spring Boot com banco de dados SQL.

## Fonte de verdade
Este documento descreve decisões e o estado conhecido do projeto, mas pode estar desatualizado. **Inspecione os arquivos reais antes de tirar conclusões.** Quando houver divergência, informe-a. Não presuma que recursos planejados já foram implementados.

## Tecnologias e estrutura conhecida
- Frontend: HTML, CSS e JavaScript puro, sem framework.
- Gráficos: Chart.js 4.5.1, carregado por CDN com versão fixa, antes do script da aplicação; sem ferramentas de build.
- Persistência atual: `localStorage`, nas coleções separadas `contas`, `transacoes` e `investimentos`; os vínculos são verificados depois da leitura das coleções.
- Arquivos principais conhecidos: `frontend/index.html`, `frontend/css/style.css` e `frontend/js/script.js`. Confirme a estrutura real.
- Versionamento: Git/GitHub. O redesign base está na branch `experiment/nexo-ui-redesign`; confirmar a branch atual antes de atuar e não trocá-la sem autorização.
- Backend futuro: Java, Spring Boot e SQL; não introduzir backend nesta fase sem solicitação.

## Estado conhecido da implementação
As funcionalidades abaixo foram verificadas no frontend. **Decisões de produto** registra as regras que devem ser preservadas; os recursos pendentes estão em **Limites de escopo e pendências**.

### Estrutura visual e navegação
- As cinco páginas (Resumo, Transações, Contas, Análises e Investimentos) são seções `.pagina` no mesmo HTML. `navegarPara()` alterna a classe `ativa` usando links com `data-pagina`, sem recarregar o documento; não há roteador nem gerenciamento próprio do histórico do navegador.
- A mesma navegação aparece como sidebar no desktop e barra inferior fixa até 850 px, com reserva de espaço no conteúdo e suporte às áreas seguras do dispositivo. O destino ativo usa `aria-current="page"`.
- Trocar efetivamente de seção limpa a seleção, posiciona a janela no topo e foca o `h1` com `tabindex="-1"`. Reativar a seção atual não executa esses efeitos; filtros e paginação permanecem entre seções.
- A base visual clara com detalhes roxos está ativa por `body.nexo-app`. O CSS mantém os tokens de `:root`, os tokens semânticos `--nexo-*` no escopo `.nexo-app` e regras específicas por página sobre os estilos anteriores; preservar o escopo e a cascata ao alterar estilos compartilhados. Os tokens `--nexo-fundo`, `--nexo-superficie`, `--nexo-texto`, `--nexo-texto-secundario`, `--nexo-borda`, `--nexo-primaria` e `--nexo-primaria-hover` representam funções distintas; não unificá-los com outros tokens apenas por semelhança de valor.
- Cabeçalhos, cards, indicadores, controles, barras de seleção, modais e toasts reutilizam padrões existentes. As listagens de Transações e do Resumo se adaptam a registros compactos até 850 px, mantendo nome e valor visíveis sem exigir rolagem horizontal. Os modais têm áreas internas roláveis e ações separadas.

### Resumo
- Os cards **Receitas registradas** e **Despesas registradas** mostram os totais históricos, inclusive transações futuras, somente dos tipos receita e despesa. A acumulação usa centavos seguros; estouro de limite torna o resultado indisponível. O card **Saldo disponível** usa os saldos atuais das contas marcadas para inclusão, até hoje; os textos de ajuda explicitam essa diferença.
- Transações recentes limitadas a cinco registros em todas as larguras: tabela no desktop e registros compactos no mobile, com nome, valor, data e contexto complementar por tipo de movimentação.
- Botões para adicionar receita e despesa; modal com validações.
- Lista compacta de até três contas com nomes e saldos atuais, com acesso à página Contas. Sem contas, há um botão para cadastrar a primeira usando o modal existente; dados indisponíveis têm mensagem própria.
- Card **Histórico financeiro** com gráfico compacto de linhas de receitas e despesas, sempre no período mais recente, sem controles próprios e com link **Ver análises**.

### Análises
- Página integrada à sidebar e à navegação existente por `data-pagina="analises"`.
- **Histórico financeiro**: gráfico completo de linhas com legenda, eixo monetário em reais e tooltips em BRL. `prepararHistoricoMensal()` agrega por ano/mês em centavos; `obterHistoricoMensal()` utiliza a coleção completa e respeita bloqueios e vínculos.
- O histórico exclui transações futuras, inclusive posteriores ao dia atual dentro do mesmo mês. Análises oferece janelas completas de 3, 6 ou 12 meses (padrão: 6) e seleção direta do mês final, entre o primeiro mês com movimentos elegíveis e o mês local atual. A janela inclui meses zerados, inclusive antes da primeira movimentação; sem histórico elegível, permanece o estado vazio. O Resumo mantém seis meses recentes, independente dos controles de Análises.
- **Distribuição de despesas**: gráfico de rosca com total destacado, legenda textual de nomes, valores em reais e percentuais com uma casa decimal, além de tooltips. Fatias com total zero não são renderizadas.
- Filtro independente do histórico: mês atual (padrão), mês anterior ou intervalo personalizado inclusivo por mês/ano (`YYYY-MM`, campos `month`). Validar a ordem dos meses e impedir períodos inteiramente futuros; períodos parcialmente futuros consideram somente despesas até hoje.
- `definirPeriodoDespesas()`, `prepararDistribuicaoDespesas()` e `obterDistribuicaoDespesas()` centralizam período, agregação em centavos e validação. Percentuais permanecem sem arredondamento na camada de dados; a apresentação arredondada pode não somar exatamente 100%.
- `CLASSIFICACOES_DESPESAS` fixa os identificadores persistidos e suas cores: `Essencial` → Necessidades (`#289568`); `Desnecessario` → Desnecessários (`#DC5252`); `Imprevisto` → Imprevistos (`#E4B044`); `Investimento` → Investimentos (`#E58A45`); `Desejo` → Desejos (`#9164CB`). Não renomear os identificadores armazenados.
- Despesas elegíveis sem classificação ou com classificação desconhecida tornam a distribuição indisponível, sem descarte silencioso. Isso não altera a validação geral das transações nem impede a apresentação do histórico válido.
- As análises usam transações completas, sem depender de busca, seleção ou paginação e sem aplicar a referência de saldo das contas. Resultados são derivados, não persistidos, e os registros originais não são modificados; valores e totais fora dos limites seguros em centavos retornam erro.
- Estados vazios, períodos inválidos, dados indisponíveis e falha do Chart.js têm mensagens próprias; gráficos antigos são removidos quando deixam de ser válidos. Na distribuição, total e legenda válidos continuam disponíveis se apenas a biblioteca falhar; erros de dados não são apresentados como zeros.
- Gráficos são atualizados após criação, edição e exclusão de transações persistidas, na inicialização, ao navegar às páginas relevantes, em `pageshow` e ao retornar à aba. A duração e o mês final do histórico são mantidos enquanto válidos, ajustando o mês aos limites disponíveis. O filtro da distribuição permanece entre seções, sem persistência no `localStorage`; alterá-lo não atualiza o histórico.
- Canvases possuem nomes e descrições acessíveis; o histórico tem alternativa textual dos valores e a distribuição tem legenda visível. Controles usam elementos nativos, mensagens por campo e `aria-invalid`. Há ajustes responsivos nos cards, gráficos e filtros, além da navegação inferior mobile.

### Transações
- CRUD dos tipos `receita`, `despesa`, `aporte` e `resgate`, com IDs UUID gerados na criação e persistência local. Receitas/despesas compartilham um modal; aportes/resgates usam o modal próprio de movimentações.
- Seleção de registros, barra contextual, edição de um registro e exclusão com confirmação.
- Página de listagem completa com seis registros por página até 850 px e oito acima desse breakpoint; a mudança de largura recalcula uma página válida e limpa a seleção quando Transações está ativa. Busca pelo nome armazenado e pelo nome atual do investimento vinculado, com filtros combináveis por tipo, categoria, classificação e datas. Classificação específica retorna somente despesas correspondentes; Limpar filtros restaura todos os controles.
- O checkbox **Selecionar transações desta página** atua apenas nos registros renderizados, com estado parcial; filtros e mudanças de página limpam a seleção. A seleção individual permanece sincronizada entre as duas tabelas.
- Navegação entre páginas via `data-pagina`, com destaque da página ativa.
- As duas tabelas devem permanecer sincronizadas após operações.
- O formulário exige uma conta cadastrada e lista as contas reais. As transações usam `contaId`; os nomes exibidos são resolvidos pelo ID, preservando vínculos após renomear contas.
- Novas despesas e edições exigem classificação válida no formulário e na persistência. Despesas antigas sem classificação válida podem ser lidas e preservadas integralmente inalteradas em operações não relacionadas; editá-las exige corrigir o campo. Selecionar uma classificação válida limpa seu erro e `aria-invalid`, sem dispensar a validação no envio.

### Motion e estados transitórios
- As cinco páginas usam `entrada-pagina` apenas na carga inicial do Resumo ou ao trocar efetivamente de seção. Grupos entram coordenados com opacidade e deslocamento vertical; Contas e Investimentos escalonam cards existentes em 70 ms, com atraso adicional limitado a 350 ms. Atualizações de dados não devem reiniciar a sequência. Transações anima a superfície por `::before`, sem transformar o ancestral da barra fixa.
- O plugin local `formacaoGraficosAnalises` compartilha a revelação horizontal dos históricos de Resumo/Análises e a formação angular da distribuição, preservando a geometria final. A exposição depende da página ativa, visibilidade da aba e `IntersectionObserver`; a formação acompanha a entrada do card. Retornos permitem repetição após cinco segundos desde o início da última formação, por gráfico e sem persistência. Mudanças de dados/período e redimensionamentos não reiniciam a formação; cancelamentos restauram o desenho completo.
- Os oito modais compartilham entrada de 200 ms e saída de 150 ms. `modal-abrindo` é transitória, não indica toda a permanência aberta; `modal-entrando` prepara o estado inicial e `modal-saindo` mantém o diálogo presente até concluir a saída. Preservar contenção/restauração de foco, `inert`, bloqueio de ações repetidas e cancelamento de transições ao reabrir. A limpeza dos formulários ocorre após o fechamento.
- Os menus de ações atuais são os `details` de Mais ações dos investimentos. `menu-acoes` e `painel-menu-acoes` compartilham entrada de 170 ms e saída de 120 ms; o painel fica inativo durante a saída, sem atrasar Editar/Excluir. Selects e detalhes financeiros não participam desse motion.
- Toasts compartilham entrada de 220 ms, preparada antes do próximo frame, com fade e subida de 4 px; a saída de 150 ms desce 4 px e aguarda antes de remover. Temporizadores/listeners anteriores são cancelados; a vaga na fila é liberada após a remoção. O contêiner mantém posicionamento na viewport inclusive durante o fechamento do modal, e a região de anúncio permanece no diálogo enquanto ele está ativo.
- Somente cliques de paginação disparam a troca animada dos registros: saída horizontal de 100 ms e entrada de 180 ms, com direções inversas ao voltar. A Web Animations API anima células no desktop e registros compactos no mobile; o contêiner externo `.tabela-transacoes` adapta a altura em 250 ms junto da entrada. Cancelamentos, resize e atualizações concorrentes restauram o layout natural, sem altura mínima permanente; a entrada SPA não é reiniciada.
- `prefers-reduced-motion: reduce` apresenta conteúdo e executa abertura/fechamento/troca imediatamente, sem esperas exclusivas de animação. Preservar foco, feedback de estado e os tempos normais de permanência dos toasts. Manter separados os estados de motion e os seletores usados pelo JavaScript; não unificar durações/curvas aprovadas apenas por organização.

### Contas
- Cadastro e edição compartilham o modal com nome, tipo, instituição opcional, `saldoInicial` não negativo, `dataReferencia` válida e não posterior ao dia local atual, e `incluirNoSaldoDisponivel` booleano. A edição preserva o ID UUID original. Referências futuras já armazenadas bloqueiam a coleção, sem alteração automática.
- Tipos suportados: conta corrente (`corrente`), poupança (`poupanca`), reserva (`reserva`) e carteira física (`carteira`).
- Exclusão com confirmação própria, permitida somente sem transações vinculadas ao ID. Vínculos históricos ou futuros também bloqueiam a exclusão; dados de transações indisponíveis impedem confirmar a ausência de vínculos. A regra é verificada ao abrir e ao confirmar a exclusão.
- A página mostra o saldo atual individual e o **Saldo total** de todas as contas, mantendo ações de edição e exclusão. Cartões e crédito disponível foram removidos da interface.
- Contas e transações são coleções separadas no `localStorage`, com validação dos registros e dos vínculos após carregar ambas.

### Investimentos
- Cadastro, edição e exclusão protegida, com nome e tipo obrigatórios (sugestões e entrada livre), instituição e observações opcionais, `capitalInicial` e `valorInformado` não negativos, inclusive zero. O valor informado pode ser inferior ao capital; observações têm limite de 500 caracteres.
- `dataReferenciaCapital` e `dataReferenciaValor` são independentes, válidas e não posteriores a hoje. Representam bases ao final de cada data; `atualizadoEm` registra a última atualização manual do valor em ISO. Retroceder a referência do valor na edição ou atualização manual exige confirmação explícita, substitui a avaliação anterior e reaplica movimentos posteriores; não há histórico de avaliações manuais.
- Aportes e resgates são registros únicos em `transacoes`, associados por `contaId` e `investimentoId`, exibidos na listagem central e no histórico dos investimentos. Aporte reduz a conta e aumenta o investimento. Resgate aumenta a conta pelo `valor` recebido, reduz o capital por `capitalRetirado` e a posição por `valorRetiradoInvestimento` (se omitido no formulário, assume o recebido). Esses valores são positivos e podem ser distintos.
- `calcularCapitaisAplicados()` deriva o capital a partir da base e dos aportes/resgates posteriores à referência do capital; apresenta a posição até hoje e valida também os fechamentos diários futuros para impedir capital negativo ou fora dos limites seguros.
- `calcularValoresInvestimentos()` deriva o valor estimado do último `valorInformado`, somando aportes e subtraindo baixas da posição posteriores à referência do valor e até hoje. Não há cotação, juros ou rentabilidade automáticos; estimativas negativas ou fora do limite ficam indisponíveis, sem ajuste silencioso.
- A página apresenta totais de capital e valor estimado, cards com valores individuais, referências, atualização manual, observações e ações, além do histórico de aportes/resgates (inclusive históricos e futuros). Valores derivados não são persistidos nem integram diretamente o Saldo disponível das contas.
- Excluir investimento exige ausência de aportes/resgates vinculados, inclusive históricos/futuros, e transações disponíveis; a condição é verificada ao solicitar e confirmar. Renomear resolve a apresentação e a busca pelo ID, sem regravar nomes nas transações.
- A despesa de classificação `Investimento` continua sendo despesa: não cria investimento/aporte nem é convertida automaticamente. Aportes/resgates ficam fora dos totais de receitas/despesas e dos gráficos atuais.

### Validação, acessibilidade e persistência
- Formulários com mensagens por campo, foco no primeiro erro e limpeza de erros; modais com semântica de diálogo, controle de foco e `inert` no conteúdo ao fundo.
- Formulários usam `novalidate` e validam explicitamente campos e restrições nativas. Os diálogos controlam Tab e restauram o foco ao fechar. Fundo/Escape não descartam formulários; confirmações de exclusão podem ser canceladas por esses meios. Preservar os padrões de fechamento e a rolagem interna.
- Valores monetários devem ser finitos, ter no máximo duas casas decimais e conversão segura para centavos inteiros, inclusive após serialização como número. `converterParaCentavos()` centraliza essa regra, sem arredondamento silencioso; registros e formulários compartilham a validação. Mensagens dos campos orientam valores em reais com até duas casas decimais, respeitando positivos ou não negativos conforme o campo.
- Leitura e gravação protegidas do `localStorage`, validação de registros e bloqueio de coleções inválidas, com indicação de dados indisponíveis.
- Notificações toast para feedback geral; preservar mensagens de validação nos campos e estados persistentes nas páginas.
- Toasts de sucesso/informação expiram em aproximadamente quatro segundos; erros permanecem até fechar. Há botão de fechamento, prevenção de duplicados, fila e limite de três visíveis, anúncios acessíveis e posicionamento fixo inclusive dentro dos modais.
- JSON inválido, coleções que não sejam arrays, registros inválidos ou IDs repetidos bloqueiam a coleção. Vínculos inválidos tornam as transações indisponíveis; não corrigir, excluir ou reassociar registros automaticamente.
- Saldos indisponíveis não devem ser exibidos como zero ou como resultados parciais confiáveis. Falhas de gravação mantêm dados anteriores, campos preenchidos e modais abertos; sucesso só é comunicado após persistir.

## Decisões de produto
- A página **Contas** reúne contas e reservas; cartões de crédito estão fora da versão atual.
- Instituição é um campo opcional; evitar aumentar o escopo sem discutir custos, benefícios e dependências.

### Contas e cálculo de saldos
- Saldo inicial e data de referência são editáveis; o saldo inicial representa o dinheiro existente **ao final** dessa data.
- Calcular `saldoAtual = saldoInicial + receitas + resgates recebidos - despesas - aportes`, vinculados à conta e considerando somente transações com `data > dataReferencia` e `data <= hoje` (dia atual local). Cadastrar capital/valor inicial de investimento não desconta novamente da conta.
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
- O redesign das cinco páginas possui adaptação responsiva, registros compactos e navegação inferior mobile. Transações possui barra contextual de seleção acima da navegação, exibida somente com seleção e barra superior fora de vista, sem aparecer sobre modais. Modo escuro não foi implementado.
- Não há projeções financeiras: os gráficos mostram somente o histórico até a data local atual. Não presumir implementações de cartões, faturas, parcelamentos ou cálculo de limites de crédito.
- Modularização de CSS/JS e consolidações amplas da cascata ficam para etapa posterior. Preservar os refinamentos existentes de valores no Resumo mobile, ações e referências de Investimentos, barra contextual, gráficos e motion; não tratá-los como funcionalidades ainda ausentes.

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
