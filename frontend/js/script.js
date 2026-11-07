import { criarAnalises } from "./funcionalidades/analises.js";
import { criarOperacoesInvestimentos } from "./funcionalidades/operacoes-investimentos.js";
import { criarApresentacaoInvestimentos } from "./funcionalidades/investimentos.js";
import { criarOperacoesTransacoes } from "./funcionalidades/operacoes-transacoes.js";
import { criarListagensTransacoes } from "./funcionalidades/transacoes.js";
import { criarContas } from "./funcionalidades/contas.js";
import { criarResumo } from "./funcionalidades/resumo.js";
import { criarModais } from "./ui/modais.js";
import { criarNotificacoes } from "./ui/notificacoes.js";
import { obterDataLocal, converterParaCentavos, formatarCentavos, formatadorMoeda } from "./dominio/valores-datas.js";
import { criarEstadoDisponibilidade } from "./dados/estado.js";
import {
    textoPreenchido, ehMovimentacaoInvestimento, validarVinculosTransacoes,
    validarTransacao, validarConta, validarColecao,
    valorMonetarioValido, validarInvestimento,
    CLASSIFICACOES_DESPESAS
} from "./dominio/validacoes.js";
import {
    saldosIndisponiveis, capitaisIndisponiveis, calcularCapitaisAplicados,
    verificarIntegridadeTransacoes, valoresInvestimentosIndisponiveis, calcularValoresInvestimentos,
    calcularSaldos, historicoMensalIndisponivel,
    prepararHistoricoMensal, distribuicaoDespesasIndisponivel, definirPeriodoDespesas,
    prepararDistribuicaoDespesas, calcularTotaisResumo
} from "./dominio/calculos.js";

const addReceita = document.getElementById("add_receita");
const addDespesa = document.getElementById("add_despesa");
const botoesFechar = document.querySelectorAll("#modal-overlay .close-modal, #modal-overlay .cancel-modal");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.querySelector(".modal-title");
const campoClassificacao = document.querySelector(".campo-classificacao");
const campoPagamento = document.querySelector(".campo-pagamento");
const formTransacao = document.querySelector(".form-transacao");
const campoNome = document.getElementById("nome");
const campoValor = document.getElementById("valor");
const campoCategoria = document.getElementById("categoria");
const selectClassificacao = document.getElementById("classificacao");
const selectPagamento = document.getElementById("pagamento");
const campoConta = document.getElementById("conta");
const campoData = document.getElementById("data");
// Inicializar antes da leitura: erros de carregamento também geram notificações.
const areaNotificacoes = document.getElementById("notificacoes");
const listaNotificacoes = document.getElementById("lista-notificacoes");
const anuncioNotificacoes = document.getElementById("anuncio-notificacoes");
const notificacoes = criarNotificacoes({
    areaNotificacoes, listaNotificacoes, anuncioNotificacoes,
    movimentoReduzido: window.matchMedia("(prefers-reduced-motion: reduce)"),
    podeReceberFoco,
    obterFocoAlternativo: () => modais.obterModalAtivo() ? modais.obterModalAtivo().querySelector("button, input") : addReceita,
    antesDeExibir: () => {
        // O overlay está desaparecendo; seu fade não deve esconder o novo toast.
        if (areaNotificacoes.parentElement?.classList.contains("modal-saindo")) {
            document.body.appendChild(areaNotificacoes);
        }
    }
});
const disponibilidadeColecoes = criarEstadoDisponibilidade();
carregarColecao("transacoes", validarTransacao);
carregarColecao("contas", validarConta);
carregarColecao("investimentos", validarInvestimento);
verificarVinculosCarregados();
const listaTransacoes = document.getElementById("lista-transacoes");
const listaTransacoesCompleta = document.getElementById("lista-transacoes-completa");
const valorRecebido = document.getElementById("valor-recebido");
const valorDespesas = document.getElementById("valor-despesas");
const valorSaldo = document.getElementById("valor-saldo");
const resumo = criarResumo({
    valorRecebido, valorDespesas, valorSaldo,
    listaContas: document.getElementById("contas-resumo"),
    abrirCadastroConta: () => abrirModalConta()
});
const modalExclusao = document.getElementById("modal-exclusao");
const mensagemExclusao = document.getElementById("mensagem-exclusao");
const botaoCancelarExclusao = document.getElementById("cancelar-exclusao");
const botaoConfirmarExclusao = document.getElementById("confirmar-exclusao");
const botaoSalvarTransacao = formTransacao.querySelector('button[type="submit"]');
const linksNavegacao = document.querySelectorAll("[data-pagina]");
const paginas = document.querySelectorAll(".pagina")
const campoPesquisa = document.getElementById("pesquisa-transacoes");
const larguraMobileTransacoes = window.matchMedia("(max-width: 850px)");
const navegacaoPrincipal = document.querySelector(".sidebar nav");
const botaoNovaConta = document.getElementById("btn-nova-conta");
const modalConta = document.getElementById("modal-conta");
const botaoFecharConta = document.getElementById("fechar-modal-conta");
const botaoCancelarConta = document.getElementById("cancelar-modal-conta");
const formConta = document.getElementById("form-conta");
const campoNomeConta = document.getElementById("nome-conta");
const campoTipoConta = document.getElementById("tipo-conta");
const campoInstituicaoConta = document.getElementById("instituicao-conta");
const campoSaldoInicial = document.getElementById("saldo-inicial-conta");
const campoDataReferencia = document.getElementById("data-referencia-conta");
const campoIncluirNoSaldoDisponivel = document.getElementById("incluir-saldo-disponivel");
const tituloModalConta = document.getElementById("titulo-modal-conta");
const botaoSalvarConta = document.getElementById("salvar-conta");
const modalExclusaoConta = document.getElementById("modal-exclusao-conta");
const mensagemExclusaoConta = document.getElementById("mensagem-exclusao-conta");
const botaoCancelarExclusaoConta = document.getElementById("cancelar-exclusao-conta");
const botaoConfirmarExclusaoConta = document.getElementById("confirmar-exclusao-conta");
const listaContas = document.getElementById("lista-contas");
const saldoTotalContas = document.getElementById("saldo-total-contas");
const modais = criarModais({
    document, movimentoReduzido: window.matchMedia("(prefers-reduced-motion: reduce)"),
    podeReceberFoco,
    obterFocoAlternativo: () => document.getElementById("pagina-transacoes").classList.contains("ativa") ? campoPesquisa
        : document.getElementById("pagina-contas").classList.contains("ativa") ? botaoNovaConta
        : document.getElementById("pagina-investimentos").classList.contains("ativa") ? document.getElementById("novo-investimento")
        : addReceita,
    focarRetorno: (destino) => destino.focus({ preventScroll: Boolean(destino.closest("#lista-investimentos")) }),
    prepararNotificacoes: (modal) => modal.querySelector('[role="dialog"]').appendChild(areaNotificacoes),
    posicionarNotificacoesModal,
    concluirNotificacoes: () => {
        areaNotificacoes.appendChild(anuncioNotificacoes);
        if (areaNotificacoes.parentElement !== document.body) document.body.appendChild(areaNotificacoes);
    },
    aoEscape: (modal) => {
        if (!modalExclusao.classList.contains("hidden")) fecharModal(modalExclusao);
        if (modal === modalExclusaoConta) fecharModalExclusaoConta();
        if (modal === document.getElementById("modal-exclusao-investimento")) fecharExclusaoInvestimento();
    }
});

const funcionalidadeContas = criarContas({
    elementos: {
        botaoNovaConta, modalConta, botaoFecharConta, botaoCancelarConta,
        formConta, campoNomeConta, campoTipoConta, campoInstituicaoConta,
        campoSaldoInicial, campoDataReferencia, campoIncluirNoSaldoDisponivel, tituloModalConta,
        botaoSalvarConta, modalExclusaoConta, mensagemExclusaoConta, botaoCancelarExclusaoConta,
        botaoConfirmarExclusaoConta, listaContas
    },
    estado: disponibilidadeColecoes,
    confirmarContas: (candidatas) => persistirColecao("contas", candidatas),
    modais: { abrirModal, fecharModal }, mostrarToast,
    aoConfirmarAlteracao: (operacao) => {
        atualizarOpcoesContas();
        atualizarVisualizacoesSaldos();
        if (operacao === "salvar") {
            // Nomes atuais por ID, sem modificar os vínculos ou a seleção.
            renderizarTransacoes(listaTransacoes, 5);
            atualizarTabelaCompleta();
        }
    }
});

const listagensTransacoes = criarListagensTransacoes({
    elementos: {
        listaTransacoes: document.getElementById("lista-transacoes"),
        listaTransacoesCompleta: document.getElementById("lista-transacoes-completa"),
        areaAcoes: document.getElementById("area-acoes"),
        quantidadeSelecionadas: document.getElementById("transacoes-selecionadas"),
        botaoEditar: document.getElementById("btn-editar"),
        botaoExcluir: document.getElementById("btn-excluir"),
        areaAcoesCompleta: document.getElementById("area-acoes-completa"),
        quantidadeSelecionadasCompleta: document.getElementById("transacoes-selecionadas-completa"),
        botaoEditarCompleta: document.getElementById("btn-editar-completa"),
        botaoExcluirCompleta: document.getElementById("btn-excluir-completa"),
        campoPesquisa: document.getElementById("pesquisa-transacoes"),
        filtroTipo: document.getElementById("filtro-tipo"),
        filtroCategoria: document.getElementById("filtro-categoria"),
        filtroClassificacao: document.getElementById("filtro-classificacao"),
        filtroDataInicial: document.getElementById("data-inicial"),
        filtroDataFinal: document.getElementById("data-final"),
        erroFiltroDatas: document.getElementById("erro-filtro-datas"),
        botaoLimparFiltros: document.getElementById("limpar-filtros"),
        paginaTransacoes: document.getElementById("pagina-transacoes"),
        barraAcoesCompleta: document.getElementById("barra-acoes-completa"),
        barraContextual: document.getElementById("barra-contextual-transacoes"),
        quantidadeContextual: document.getElementById("quantidade-contextual-transacoes"),
        infoPaginacao: document.getElementById("info-paginacao"),
        botaoPaginaAnterior: document.getElementById("pagina-anterior"),
        botaoProximaPagina: document.getElementById("proxima-pagina"),
        navegacaoPrincipal
    },
    consultas: {
        consultarTransacoes: () => disponibilidadeColecoes.consultarTransacoes(),
        consultarContas: () => disponibilidadeColecoes.consultarContas(),
        consultarInvestimentos: () => disponibilidadeColecoes.consultarInvestimentos(),
        colecaoEstaBloqueada: (chave) => disponibilidadeColecoes.colecaoEstaBloqueada(chave)
    },
    ambiente: { window, document }, larguraMobileTransacoes, modais,
    aoEditar: solicitarEdicaoTransacaoSelecionada,
    aoExcluir: solicitarExclusaoTransacoesSelecionadas
});

const operacoesTransacoes = criarOperacoesTransacoes({
    elementos: {
        addReceita, addDespesa, botoesFechar, modalOverlay,
        modalTitle, campoClassificacao, campoPagamento, formTransacao,
        campoNome, campoValor, campoCategoria, selectClassificacao,
        selectPagamento, campoConta, campoData, botaoSalvarTransacao,
        modalExclusao, mensagemExclusao, botaoCancelarExclusao, botaoConfirmarExclusao
    },
    consultas: {
        consultarTransacoes: () => disponibilidadeColecoes.consultarTransacoes(),
        consultarContas: () => disponibilidadeColecoes.consultarContas(),
        colecaoEstaBloqueada: (chave) => disponibilidadeColecoes.colecaoEstaBloqueada(chave)
    },
    confirmarTransacoes: (candidatas) => persistirColecao("transacoes", candidatas),
    validarContaTransacao,
    consultarSelecao: () => listagensTransacoes.consultarSelecao(),
    modais: { abrirModal, fecharModal }, mostrarToast,
    aposPersistir: () => {
        listagensTransacoes.definirSelecao([]);
        renderizarTransacoes(listaTransacoes, 5);
        atualizarCategorias();
        atualizarTabelaCompleta();
        atualizarResumo();
        atualizarBarraAcoes();
    },
    // Na exclusão, a atualização de Investimentos continua após solicitar o fechamento.
    aposFecharExclusao: () => renderizarInvestimentos()
});

operacoesTransacoes.inicializar();

// funcoes reutilizaveis
function mostrarToast(mensagem, tipo = "informacao") {
    notificacoes.mostrarToast(mensagem, tipo);
}

function validarContaTransacao(contaId) {
    return !disponibilidadeColecoes.colecaoEstaBloqueada("contas") && textoPreenchido(contaId)
        && disponibilidadeColecoes.consultarContas().some((conta) => conta.id === contaId);
}

function verificarVinculosCarregados() {
    if (disponibilidadeColecoes.colecaoEstaBloqueada("transacoes")) return;
    const integridade = disponibilidadeColecoes.verificarTransacoesCarregadas();
    if (!integridade.disponivel) {
        mostrarToast("Transações indisponíveis: não foi possível confirmar os vínculos ou a integridade do capital. "
            + integridade.motivo + " "
            + "Os dados armazenados foram preservados e as gravações de transações estão bloqueadas nesta sessão.", "erro");
    }
}

// Uso explícito pela futura interface. Nunca normaliza ou regrava registros carregados.
function prepararMovimentacaoInvestimento(registro) {
    return registro.tipo === "resgate"
        ? { ...registro, valorRetiradoInvestimento: registro.valorRetiradoInvestimento ?? registro.valor }
        : { ...registro };
}

function obterCapitaisAplicados(hoje = obterDataLocal()) {
    if (["investimentos", "transacoes", "contas"].some((chave) => disponibilidadeColecoes.colecaoEstaBloqueada(chave))) {
        return capitaisIndisponiveis("Dados necessários ao cálculo de capital indisponíveis nesta sessão.");
    }
    const integridade = verificarIntegridadeTransacoes(disponibilidadeColecoes.consultarTransacoes(), disponibilidadeColecoes.consultarContas(), disponibilidadeColecoes.consultarInvestimentos());
    if (!integridade.disponivel) return capitaisIndisponiveis(integridade.motivo);
    return calcularCapitaisAplicados(disponibilidadeColecoes.consultarInvestimentos(), disponibilidadeColecoes.consultarTransacoes(), hoje);
}

function obterAcompanhamentoInvestimentos(hoje = obterDataLocal()) {
    const capitais = obterCapitaisAplicados(hoje);
    if (!capitais.disponivel) return { capitais, valores: valoresInvestimentosIndisponiveis(capitais.motivo), totalCapitalCentavos: null };
    let totalCapitalCentavos = 0;
    for (const capital of capitais.capitaisPorInvestimentoCentavos.values()) {
        totalCapitalCentavos += capital;
        if (!Number.isSafeInteger(totalCapitalCentavos)) { totalCapitalCentavos = null; break; }
    }
    return { capitais, totalCapitalCentavos, valores: calcularValoresInvestimentos(disponibilidadeColecoes.consultarInvestimentos(), disponibilidadeColecoes.consultarTransacoes(), hoje) };
}

// Ponto de entrada da aplicação: nunca calcular sobre os arrays vazios de fallback
// usados quando uma coleção não pôde ser carregada ou seus vínculos são inválidos.
function obterSaldosContas(hoje = obterDataLocal()) {
    if (disponibilidadeColecoes.colecaoEstaBloqueada("contas") || disponibilidadeColecoes.colecaoEstaBloqueada("transacoes")) {
        return saldosIndisponiveis("Dados de contas ou transações indisponíveis nesta sessão.");
    }
    return calcularSaldos(disponibilidadeColecoes.consultarContas(), disponibilidadeColecoes.consultarTransacoes(), hoje, disponibilidadeColecoes.consultarInvestimentos());
}

// Entrada da aplicação: utiliza a coleção completa e respeita os bloqueios existentes.
function obterHistoricoMensal(mesFinal = null, duracao = 6, hoje = obterDataLocal()) {
    if (disponibilidadeColecoes.colecaoEstaBloqueada("transacoes") || disponibilidadeColecoes.colecaoEstaBloqueada("contas")) {
        return historicoMensalIndisponivel("Dados de transações ou seus vínculos indisponíveis nesta sessão.");
    }
    if (!validarColecao(disponibilidadeColecoes.consultarTransacoes(), validarTransacao) || !validarColecao(disponibilidadeColecoes.consultarContas(), validarConta)
        || !validarVinculosTransacoes(disponibilidadeColecoes.consultarTransacoes(), disponibilidadeColecoes.consultarContas(), disponibilidadeColecoes.consultarInvestimentos())) {
        return historicoMensalIndisponivel("Não foi possível validar as transações e seus vínculos.");
    }
    return prepararHistoricoMensal(disponibilidadeColecoes.consultarTransacoes(), hoje, mesFinal, duracao);
}

listagensTransacoes.prepararClassificacoes();

disponibilidadeColecoes.prepararCompatibilidadeTransacoes();

// Entrada da aplicação: sempre usa as coleções completas e os bloqueios existentes.
function obterDistribuicaoDespesas(tipo = "atual", mesInicial = null, mesFinal = null, hoje = obterDataLocal()) {
    if (disponibilidadeColecoes.colecaoEstaBloqueada("transacoes") || disponibilidadeColecoes.colecaoEstaBloqueada("contas")) {
        return distribuicaoDespesasIndisponivel("Dados de transações ou seus vínculos indisponíveis nesta sessão.");
    }
    if (!validarColecao(disponibilidadeColecoes.consultarTransacoes(), validarTransacao) || !validarColecao(disponibilidadeColecoes.consultarContas(), validarConta)
        || !validarVinculosTransacoes(disponibilidadeColecoes.consultarTransacoes(), disponibilidadeColecoes.consultarContas(), disponibilidadeColecoes.consultarInvestimentos())) {
        return distribuicaoDespesasIndisponivel("Não foi possível validar as transações e seus vínculos.");
    }
    const periodo = definirPeriodoDespesas(tipo, mesInicial, mesFinal, hoje);
    if (!periodo.disponivel) return distribuicaoDespesasIndisponivel(periodo.motivo);
    return prepararDistribuicaoDespesas(disponibilidadeColecoes.consultarTransacoes(), periodo.mesInicial, periodo.mesFinal, hoje);
}

const analises = criarAnalises({
    document, window,
    elementos: Object.fromEntries([
        "grafico-distribuicao",
        "area-distribuicao",
        "periodo-distribuicao",
        "mes-inicial-distribuicao",
        "mes-final-distribuicao",
        "estado-distribuicao",
        "total-distribuicao",
        "intervalo-distribuicao",
        "legenda-distribuicao",
        "meses-distribuicao",
        "valor-total-distribuicao",
        "mes-final-historico",
        "area-historico-resumo",
        "area-historico-analises",
        "estado-historico-resumo",
        "estado-historico-analises",
        "periodo-historico-resumo",
        "periodo-historico-analises",
        "dados-historico-resumo",
        "dados-historico-analises",
        "grafico-historico-resumo",
        "grafico-historico-analises"
    ].map((id) => [id, document.getElementById(id)])),
    botoesDuracao: document.querySelectorAll("[data-duracao-historico]"),
    obterHistoricoMensal, obterDistribuicaoDespesas,
    obterChart: () => window.Chart,
    movimentoReduzidoGraficos: window.matchMedia("(prefers-reduced-motion: reduce)")
});

function atualizarGraficosHistorico() { analises.atualizarGraficosHistorico(); }
function atualizarDistribuicaoDespesas() { analises.atualizarDistribuicaoDespesas(); }
function concluirFormacoesAnalises() { analises.concluirFormacoesAnalises(); }
function prepararFormacoesPagina(pagina) { analises.prepararFormacoesPagina(pagina); }
function agendarFormacaoAnalises(chave) { analises.agendarFormacaoAnalises(chave); }

function carregarColecao(chave, validarRegistro) {
    try {
        const inicializacao = chave === "contas" ? disponibilidadeColecoes.inicializarContas()
            : chave === "transacoes" ? disponibilidadeColecoes.inicializarTransacoes()
                : disponibilidadeColecoes.inicializarInvestimentos();
        if (!inicializacao.sucesso) throw inicializacao.erro;
        return chave === "contas" ? disponibilidadeColecoes.consultarContas()
            : chave === "transacoes" ? disponibilidadeColecoes.consultarTransacoes()
                : disponibilidadeColecoes.consultarInvestimentos();
    } catch (erro) {
        disponibilidadeColecoes.bloquearColecao(chave);
        mostrarToast(`Os dados de ${chave} estão indisponíveis: não foi possível lê-los ou validá-los. `
            + (chave === "contas" ? "A referência do saldo deve ser válida e não posterior a hoje. " : "")
            + "O conteúdo armazenado não foi alterado. As gravações desta coleção estão bloqueadas nesta sessão.", "erro");
        return [];
    }
}

function persistirColecao(chave, registros) {
    if (chave === "contas" || chave === "transacoes" || chave === "investimentos") {
        const resultado = chave === "contas" ? disponibilidadeColecoes.confirmarContas(registros)
            : chave === "transacoes" ? disponibilidadeColecoes.confirmarTransacoes(registros)
                : disponibilidadeColecoes.confirmarInvestimentos(registros);
        if (resultado.sucesso) return true;
        if (resultado.motivo === "bloqueada") {
            mostrarToast(`Não é possível salvar ${chave}: os dados estão indisponíveis e a coleção está bloqueada. `
                + "O conteúdo armazenado não foi alterado.", "erro");
        } else if (resultado.motivo === "invalida") {
            mostrarToast("Não foi possível salvar: a coleção contém dados incompatíveis com o modelo atual. "
                + "A alteração não foi confirmada e os dados anteriores foram preservados.", "erro");
        } else if (resultado.motivo === "dependencias") {
            mostrarToast("Não foi possível confirmar os vínculos e o capital: uma coleção necessária está indisponível. A alteração não foi confirmada.", "erro");
        } else if (resultado.motivo === "integridade") {
            mostrarToast(`Não foi possível salvar: ${resultado.detalhe} A alteração não foi confirmada.`, "erro");
        } else {
            mostrarToast(`Não foi possível salvar ${chave}. A alteração não foi confirmada. `
                + "Os dados anteriores e os campos preenchidos foram mantidos. Tente novamente.", "erro");
        }
        return false;
    }
    if (disponibilidadeColecoes.colecaoEstaBloqueada(chave)) {
        mostrarToast(`Não é possível salvar ${chave}: os dados estão indisponíveis e a coleção está bloqueada. `
            + "O conteúdo armazenado não foi alterado.", "erro");
    } else {
        mostrarToast("Não foi possível salvar: a coleção contém dados incompatíveis com o modelo atual. "
            + "A alteração não foi confirmada e os dados anteriores foram preservados.", "erro");
    }
    return false;
}

function podeReceberFoco(elemento) {
    // A barra pode continuar visualmente presente durante a animação de saída.
    const area = elemento && elemento.closest(".area-acoes");
    if (area && !area.classList.contains("ativa")) return false;
    return elemento && elemento !== document.body && elemento.isConnected && !elemento.matches(":disabled")
        && !elemento.closest("[inert]") && elemento.getClientRects().length > 0
        && getComputedStyle(elemento).visibility !== "hidden";
}

function posicionarNotificacoesModal(modal, noPainel) {
    const painel = modal.querySelector('[role="dialog"]');
    const foco = areaNotificacoes.contains(document.activeElement) ? document.activeElement : null;
    // O anúncio permanece no diálogo mesmo enquanto os toasts escapam do transform.
    (noPainel ? areaNotificacoes : painel).appendChild(anuncioNotificacoes);
    (noPainel ? painel : modal).appendChild(areaNotificacoes);
    if (foco) foco.focus({ preventScroll: true });
}

function abrirModal(modal, focoInicial) {
    modais.abrirModal(modal, focoInicial);
}

function fecharModal(modal, aoFechar = null) {
    modais.fecharModal(modal, aoFechar);
}

function renderizarTransacoes(tabelaDestino, limite = null, pesquisa = "", tipo = "todos", categoria = "todas", dataInicial = "", dataFinal = "", classificacao = "todas") {
    listagensTransacoes.renderizarTransacoes(tabelaDestino, limite, pesquisa, tipo, categoria, dataInicial, dataFinal, classificacao);
}

function atualizarResumo() {
    atualizarVisualizacoesSaldos();
    atualizarGraficosHistorico();
    atualizarDistribuicaoDespesas();
    const totais = disponibilidadeColecoes.colecaoEstaBloqueada("transacoes")
        ? { receitasCentavos: null, despesasCentavos: null }
        : calcularTotaisResumo(disponibilidadeColecoes.consultarTransacoes());
    resumo.renderizarIndicadores(totais);
}

// O controle em lote opera apenas sobre os registros já renderizados nesta página.


function limparSelecao() {
    listagensTransacoes.limparSelecao();
}

function atualizarBarraAcoes() {
    listagensTransacoes.atualizarBarraAcoes();
}

function navegarPara(paginaDestino) {
    const paginaSelecionada = document.getElementById(
        `pagina-${paginaDestino}`
    );

    if (!paginaSelecionada) return;

    const mudouPagina = !paginaSelecionada.classList.contains("ativa");
    if (mudouPagina) listagensTransacoes.concluirPaginacaoSeAtiva();
    if (mudouPagina) {
        concluirFormacoesAnalises();
        prepararFormacoesPagina(paginaDestino);
        limparSelecao();
    }

    if (mudouPagina) {
        paginas.forEach((pagina) => {
            pagina.classList.remove("ativa", "entrada-pagina");
        });
        paginaSelecionada.classList.add("ativa");
    }

    linksNavegacao.forEach((link) => {
        const linkAtivo = link.dataset.pagina === paginaDestino;

        link.classList.toggle("ativo", linkAtivo);
        if (link.closest("nav")) {
            if (linkAtivo) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        }
    });
    if (paginaDestino === "analises" || paginaDestino === "resumo") atualizarGraficosHistorico();
    if (paginaDestino === "analises") atualizarDistribuicaoDespesas();
    if (paginaDestino === "investimentos") renderizarInvestimentos();
    if (mudouPagina) {
        const titulo = paginaSelecionada.querySelector("h1");
        if (titulo) {
            titulo.setAttribute("tabindex", "-1");
            titulo.focus({ preventScroll: true });
        }
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            if (paginaDestino === "contas") {
                let indiceConta = 0;
                paginaSelecionada.querySelectorAll("#lista-contas > .item-conta, #lista-contas > .mensagem-vazia")
                    .forEach((elemento) => {
                        const atraso = elemento.classList.contains("item-conta")
                            ? Math.min(indiceConta++ * 70, 350) : 0;
                        elemento.style.setProperty("--atraso-entrada-conta", `${atraso}ms`);
                        elemento.classList.add("entrada-conta");
                    });
            }
            if (paginaDestino === "investimentos") {
                let indiceInvestimento = 0;
                paginaSelecionada.querySelectorAll("#lista-investimentos > .item-investimento, #lista-investimentos > .mensagem-vazia")
                    .forEach((elemento) => {
                        const atraso = elemento.classList.contains("item-investimento")
                            ? Math.min(indiceInvestimento++ * 70, 350) : 0;
                        elemento.style.setProperty("--atraso-entrada-investimento", `${atraso}ms`);
                        elemento.classList.add("entrada-investimento");
                    });
            }
            // Reinicia a entrada mesmo ao retornar antes do fim da animação anterior.
            void paginaSelecionada.offsetWidth;
            paginaSelecionada.classList.add("entrada-pagina");
        }
        // Reavalia depois da rolagem e da entrada CSS, inclusive em navegações muito rápidas.
        if (paginaDestino === "resumo") agendarFormacaoAnalises("resumo");
        if (paginaDestino === "analises") {
            agendarFormacaoAnalises("historico");
            agendarFormacaoAnalises("distribuicao");
        }
    }
}

function atualizarTabelaCompleta(preservarTransicao = false) {
    listagensTransacoes.atualizarTabelaCompleta(preservarTransicao);
}

function atualizarCategorias() {
    listagensTransacoes.atualizarCategorias();
}

function abrirModalConta(contaId = null) {
    funcionalidadeContas.abrirModalConta(contaId);
}

function atualizarOpcoesContas() {
    operacoesTransacoes.atualizarOpcoesContas();
}

function podeExcluirConta(contaId) {
    return funcionalidadeContas.podeExcluirConta(contaId);
}

function fecharModalExclusaoConta() {
    funcionalidadeContas.fecharModalExclusaoConta();
}

function renderizarContas(saldos) {
    funcionalidadeContas.renderizarContas(saldos);
}
// Compartilha um único cálculo sobre as coleções completas entre as páginas.
function atualizarVisualizacoesSaldos() {
    const saldos = obterSaldosContas();
    saldoTotalContas.textContent = saldos.disponivel
        ? formatarCentavos(saldos.saldoTotalCentavos) : "Indisponível";
    resumo.renderizarSaldo(saldos);
    renderizarContas(saldos);
    renderizarContasResumo(saldos);
}

function renderizarContasResumo(saldos) {
    resumo.renderizarContas({ contas: disponibilidadeColecoes.consultarContas(), saldos });
}

// eventos links de navegação
linksNavegacao.forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();

        const paginaDestino = link.dataset.pagina;

        navegarPara(paginaDestino);
    });
});

funcionalidadeContas.inicializar();

function solicitarExclusaoTransacoesSelecionadas() {
    operacoesTransacoes.solicitarExclusao();
}

function solicitarEdicaoTransacaoSelecionada() {
    if (listagensTransacoes.consultarSelecao().length !== 1) return;

    const id = listagensTransacoes.consultarSelecao()[0];

    const transacao = disponibilidadeColecoes.consultarTransacoes().find((transacao) => {
        return transacao.id === id;
    });

    if (!transacao) return;
    if (ehMovimentacaoInvestimento(transacao)) {
        abrirModalMovimentacao(transacao.tipo, transacao.investimentoId, transacao.id);
        return;
    }
    operacoesTransacoes.editarTransacao(id);
}

const apresentacaoInvestimentos = criarApresentacaoInvestimentos({
    document, window,
    listaInvestimentos: document.getElementById("lista-investimentos"),
    historicoInvestimentos: document.getElementById("historico-investimentos"),
    totalCapital: document.getElementById("total-capital-investimentos"),
    totalValor: document.getElementById("total-valor-investimentos"),
    botaoNovoInvestimento: document.getElementById("novo-investimento"),
    navegacaoPrincipal, larguraMobileTransacoes,
    movimentoReduzidoMenus: window.matchMedia("(prefers-reduced-motion: reduce)"),
    formatarCentavos, converterParaCentavos, formatadorMoeda, obterDataLocal, formatarDataInvestimento,
    obterModalAtivo: () => modais.obterModalAtivo(),
    definirFocoRetorno: (elemento) => modais.definirFocoRetorno(elemento),
    acoes: {
        aporte: (id) => abrirModalMovimentacao("aporte", id),
        resgate: (id) => abrirModalMovimentacao("resgate", id),
        atualizar: abrirAtualizacaoValor, editar: abrirModalInvestimento, excluir: solicitarExclusaoInvestimento
    }
});
apresentacaoInvestimentos.inicializar();

function prepararRetornoFocoInvestimento(id, acao) {
    apresentacaoInvestimentos.prepararRetornoFocoInvestimento(id, acao);
}

function renderizarInvestimentos() {
    const acompanhamento = obterAcompanhamentoInvestimentos();
    apresentacaoInvestimentos.renderizarIndicadores(acompanhamento);
    renderizarHistoricoInvestimentos();
    apresentacaoInvestimentos.renderizarCards({
        acompanhamento,
        investimentos: disponibilidadeColecoes.consultarInvestimentos(),
        indisponivel: disponibilidadeColecoes.colecaoEstaBloqueada("investimentos"),
        restricaoMovimentacao: !disponibilidadeColecoes.colecaoEstaBloqueada("investimentos")
            && disponibilidadeColecoes.consultarInvestimentos().length > 0
            ? obterRestricaoMovimentacaoInvestimentos() : null
    });
}

const elementosOperacoesInvestimentos = Object.fromEntries([
    "aviso-retroativo-investimento",
    "aviso-retroativo-manual",
    "form-investimento",
    "modal-investimento",
    "modal-exclusao-investimento",
    "nome-investimento",
    "tipo-investimento",
    "instituicao-investimento",
    "capital-investimento",
    "valor-investimento",
    "referencia-investimento",
    "referencia-valor-investimento",
    "observacoes-investimento",
    "titulo-modal-investimento",
    "salvar-investimento",
    "mensagem-exclusao-investimento",
    "cancelar-exclusao-investimento",
    "modal-valor-investimento",
    "form-valor-investimento",
    "valor-manual-investimento",
    "data-valor-manual",
    "titulo-valor-investimento",
    "avaliacao-anterior-investimento",
    "modal-movimentacao",
    "form-movimentacao",
    "titulo-modal-movimentacao",
    "salvar-movimentacao",
    "rotulo-investimento-movimentacao",
    "rotulo-conta-movimentacao",
    "rotulo-valor-movimentacao",
    "campos-resgate",
    "confirmar-retroativo-investimento",
    "novo-investimento",
    "fechar-investimento",
    "cancelar-investimento",
    "confirmar-exclusao-investimento",
    "confirmar-retroativo-manual",
    "cancelar-valor-investimento",
    "fechar-valor-investimento",
    "fechar-movimentacao",
    "cancelar-movimentacao",
    "investimento-movimentacao",
    "conta-movimentacao",
    "valor-movimentacao",
    "capital-movimentacao",
    "baixa-movimentacao",
    "data-movimentacao",
    "observacoes-movimentacao"
].map((id) => [id, document.getElementById(id)]));
elementosOperacoesInvestimentos.botoesMovimentacao = document.querySelectorAll("[data-movimentacao]");
const operacoesInvestimentos = criarOperacoesInvestimentos({
    elementos: elementosOperacoesInvestimentos,
    consultas: {
        colecaoEstaBloqueada: (chave) => disponibilidadeColecoes.colecaoEstaBloqueada(chave),
        consultarInvestimentos: () => disponibilidadeColecoes.consultarInvestimentos(),
        consultarTransacoes: () => disponibilidadeColecoes.consultarTransacoes(),
        consultarContas: () => disponibilidadeColecoes.consultarContas()
    },
    confirmarInvestimentos: (candidatos) => persistirColecao("investimentos", candidatos),
    confirmarTransacoes: (candidatos) => persistirColecao("transacoes", candidatos),
    validarContaTransacao, prepararMovimentacaoInvestimento, obterRestricaoMovimentacaoInvestimentos, formatarDataInvestimento,
    modais: { abrirModal, fecharModal }, mostrarToast,
    aposSalvarInvestimento: (registro, editando) => {
        renderizarInvestimentos();
        renderizarTransacoes(listaTransacoes, 5);
        atualizarTabelaCompleta();
        if (editando) prepararRetornoFocoInvestimento(registro.id, "editar");
    },
    aposExcluirInvestimento: () => renderizarInvestimentos(),
    aposAtualizarValor: (registro) => {
        renderizarInvestimentos();
        prepararRetornoFocoInvestimento(registro.id, "atualizar");
    },
    aposSalvarMovimentacao: () => {
        limparSelecao();
        atualizarCategorias();
        renderizarTransacoes(listaTransacoes, 5);
        atualizarTabelaCompleta();
        atualizarResumo();
        renderizarInvestimentos();
    }
});
operacoesInvestimentos.inicializar();
renderizarInvestimentos();

function abrirModalInvestimento(id = null) { return operacoesInvestimentos.abrirModalInvestimento(id); }
function solicitarExclusaoInvestimento(id) { return operacoesInvestimentos.solicitarExclusaoInvestimento(id); }
function fecharExclusaoInvestimento() { operacoesInvestimentos.fecharExclusaoInvestimento(); }
function abrirAtualizacaoValor(id) { operacoesInvestimentos.abrirAtualizacaoValor(id); }
function abrirModalMovimentacao(tipo, investimentoId = null, id = null) {
    operacoesInvestimentos.abrirModalMovimentacao(tipo, investimentoId, id);
}

function formatarDataInvestimento(data) {
    return data.split("-").reverse().join("/");
}

function renderizarHistoricoInvestimentos() {
    const disponivel = !["investimentos", "transacoes", "contas"].some((chave) => disponibilidadeColecoes.colecaoEstaBloqueada(chave))
        && verificarIntegridadeTransacoes(disponibilidadeColecoes.consultarTransacoes(), disponibilidadeColecoes.consultarContas(), disponibilidadeColecoes.consultarInvestimentos()).disponivel;
    const movimentos = disponivel ? disponibilidadeColecoes.consultarTransacoes().filter(ehMovimentacaoInvestimento)
        .slice().sort((a, b) => b.data.localeCompare(a.data)) : [];
    apresentacaoInvestimentos.renderizarHistorico({
        disponivel,
        movimentos: movimentos.map((movimento) => ({
            movimento,
            nomeInvestimento: disponibilidadeColecoes.consultarInvestimentos().find((registro) => registro.id === movimento.investimentoId).nome,
            nomeConta: disponibilidadeColecoes.consultarContas().find((registro) => registro.id === movimento.contaId).nome,
            futura: movimento.data > obterDataLocal()
        }))
    });
}

function obterRestricaoMovimentacaoInvestimentos() {
    if (["transacoes", "contas", "investimentos"].some((chave) => disponibilidadeColecoes.colecaoEstaBloqueada(chave))) {
        return { mensagem: "Não é possível movimentar: contas, investimentos ou transações estão indisponíveis. Os dados armazenados foram preservados.", tipo: "erro" };
    }
    if (!disponibilidadeColecoes.consultarContas().length || !disponibilidadeColecoes.consultarInvestimentos().length) {
        return { mensagem: "Cadastre pelo menos uma conta e um investimento antes de registrar aportes ou resgates.", tipo: "informacao" };
    }
    return null;
}

analises.inicializar();

listagensTransacoes.inicializar();

navegarPara("resumo");
atualizarOpcoesContas();
renderizarTransacoes(listaTransacoes, 5);
atualizarCategorias();
atualizarTabelaCompleta();
atualizarResumo();
atualizarBarraAcoes();

// A carga inicial já começa no Resumo; não precisa trocar de página ou mover o foco.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.getElementById("pagina-resumo").classList.add("entrada-pagina");
}

// Usa o dia local atualizado ao retornar à aplicação ou restaurar a página.
window.addEventListener("pageshow", () => {
    renderizarInvestimentos();
    atualizarVisualizacoesSaldos();
    atualizarGraficosHistorico();
    atualizarDistribuicaoDespesas();
});
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") concluirFormacoesAnalises();
    if (document.visibilityState === "visible") {
        renderizarInvestimentos();
        atualizarVisualizacoesSaldos();
        atualizarGraficosHistorico();
        atualizarDistribuicaoDespesas();
    }
});

/* RESETAR OS DADOS DE TESTE

transacoes.length = 0;
localStorage.setItem("transacoes", JSON.stringify(transacoes));
renderizarTransacoes(listaTransacoes, 5);
atualizarTabelaCompleta();

*/

/*OU
localStorage.removeItem("transacoes");
*/
