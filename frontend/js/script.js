import { criarApresentacaoInvestimentos } from "./funcionalidades/investimentos.js";
import { criarOperacoesTransacoes } from "./funcionalidades/operacoes-transacoes.js";
import { criarListagensTransacoes } from "./funcionalidades/transacoes.js";
import { criarContas } from "./funcionalidades/contas.js";
import { criarResumo } from "./funcionalidades/resumo.js";
import { criarModais } from "./ui/modais.js";
import { criarNotificacoes } from "./ui/notificacoes.js";
import { mostrarErro, limparErros, limparErroCampo, focarPrimeiroErro } from "./ui/formularios.js";
import { dataValida, obterDataLocal, converterParaCentavos, formatarCentavos, formatadorMoeda } from "./dominio/valores-datas.js";
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
let duracaoHistoricoAnalises = 6;
let mesFinalHistoricoAnalises = null;
const graficosHistorico = { resumo: null, analises: null };
let graficoDistribuicao = null;
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

// Estado visual da sessão: a criação de uma instância oculta não consome a entrada.
const formacoesAnalises = {
    resumo: { exibido: false, ultimoInicio: null, iniciou: false, quadro: null, grafico: null, inicio: null, progresso: 1, assinatura: null },
    historico: { exibido: false, ultimoInicio: null, iniciou: false, quadro: null, grafico: null, inicio: null, progresso: 1 },
    distribuicao: { exibido: false, ultimoInicio: null, iniciou: false, quadro: null, grafico: null, inicio: null, progresso: 1 }
};
const movimentoReduzidoGraficos = window.matchMedia("(prefers-reduced-motion: reduce)");
const recortesFormacaoAnalises = new WeakSet();

function restaurarRecorteFormacao(grafico) {
    if (recortesFormacaoAnalises.delete(grafico)) grafico.ctx.restore();
}

function graficoDaFormacao(chave) {
    if (chave === "distribuicao") return graficoDistribuicao;
    return chave === "resumo" ? graficosHistorico.resumo : graficosHistorico.analises;
}

// Apenas a entrada na seção pode liberar uma repetição, nunca uma atualização de dados.
function prepararFormacoesPagina(pagina) {
    const agora = performance.now();
    for (const [chave, estado] of Object.entries(formacoesAnalises)) {
        if ((chave === "resumo" ? "resumo" : "analises") !== pagina) continue;
        estado.exibido = estado.ultimoInicio !== null && agora - estado.ultimoInicio < 5000;
    }
}

function formacaoEstaVisivel(grafico) {
    if (!grafico || document.visibilityState !== "visible"
        || !grafico.canvas.closest(".pagina").classList.contains("ativa")) return false;
    const area = grafico.canvas.parentElement;
    if (area.hidden || !grafico.width || !grafico.height) return false;
    const retangulo = area.getBoundingClientRect();
    return retangulo.bottom > 0 && retangulo.top < window.innerHeight
        && retangulo.right > 0 && retangulo.left < window.innerWidth;
}

function finalizarFormacaoAnalises(chave, redesenhar = false) {
    const estado = formacoesAnalises[chave];
    if (estado.quadro !== null) cancelAnimationFrame(estado.quadro);
    const grafico = estado.grafico;
    if (grafico) {
        // Renderizações sucessivas na inicialização não consomem uma entrada ainda não desenhada.
        if (estado.inicio !== null) estado.exibido = true;
        restaurarRecorteFormacao(grafico);
    }
    estado.quadro = null;
    estado.grafico = null;
    estado.inicio = null;
    estado.iniciou = false;
    estado.progresso = 1;
    if (redesenhar && grafico) {
        try { grafico.draw(); } catch (erro) { /* Falhas visuais não interrompem a aplicação. */ }
    }
}

function concluirFormacoesAnalises() {
    Object.keys(formacoesAnalises).forEach((chave) => finalizarFormacaoAnalises(chave, true));
}

function agendarFormacaoAnalises(chave) {
    if (!("IntersectionObserver" in window)) return;
    const estado = formacoesAnalises[chave];
    const grafico = graficoDaFormacao(chave);
    if (estado.exibido || estado.quadro !== null || !formacaoEstaVisivel(grafico)) return;
    estado.grafico = grafico;
    const duracao = chave === "historico" ? 500 : 450;
    const desenhar = (tempo) => {
        estado.quadro = null;
        if (grafico !== graficoDaFormacao(chave) || !formacaoEstaVisivel(grafico)
            || movimentoReduzidoGraficos.matches) {
            if (formacaoEstaVisivel(grafico)) estado.exibido = true;
            finalizarFormacaoAnalises(chave, true);
            return;
        }
        if (estado.inicio === null) {
            estado.exibido = true;
            estado.progresso = 0;
            const entrada = grafico.canvas.closest(".card").getAnimations?.()
                .find((animacao) => animacao.animationName === "entrada-pagina");
            const timing = entrada?.effect.getTiming();
            const espera = entrada ? Math.max(0, timing.delay + Number(timing.duration) / 2 - Number(entrada.currentTime)) : 0;
            estado.inicio = tempo + espera;
        }
        const fracao = Math.max(0, Math.min(1, (tempo - estado.inicio) / duracao));
        if (tempo >= estado.inicio && !estado.iniciou) {
            estado.ultimoInicio = tempo; // Mesmo relógio monotônico de performance.now().
            estado.iniciou = true;
        }
        estado.progresso = 1 - (1 - fracao) ** 3;
        try {
            grafico.draw();
        } catch (erro) {
            finalizarFormacaoAnalises(chave, true);
            return;
        }
        // Um resize/update disparado pelo próprio draw pode ter concluído a formação.
        if (estado.grafico !== grafico) return;
        if (fracao < 1) estado.quadro = requestAnimationFrame(desenhar);
        else finalizarFormacaoAnalises(chave);
    };
    estado.quadro = requestAnimationFrame(desenhar);
}

// Recorta somente as séries; eixos, legendas, tooltips e coordenadas ficam completos.
const formacaoGraficosAnalises = {
    id: "formacao-analises",
    beforeDatasetsDraw(grafico) {
        const estado = Object.values(formacoesAnalises).find((item) => item.grafico === grafico);
        if (!estado || estado.progresso >= 1) return;
        const { ctx, chartArea } = grafico;
        ctx.save();
        recortesFormacaoAnalises.add(grafico);
        try {
            ctx.beginPath();
            if (grafico.config.type === "line") {
                ctx.rect(chartArea.left, chartArea.top,
                    (chartArea.right - chartArea.left) * estado.progresso, chartArea.bottom - chartArea.top);
            } else {
                const arcos = grafico.getDatasetMeta(0).data;
                const primeiro = arcos[0];
                const ultimo = arcos.at(-1);
                ctx.moveTo(primeiro.x, primeiro.y);
                ctx.arc(primeiro.x, primeiro.y, Math.max(grafico.width, grafico.height) * 2,
                    primeiro.startAngle, primeiro.startAngle + (ultimo.endAngle - primeiro.startAngle) * estado.progresso);
                ctx.closePath();
            }
            ctx.clip();
        } catch (erro) {
            restaurarRecorteFormacao(grafico);
            throw erro;
        }
    },
    afterDatasetsDraw(grafico) {
        restaurarRecorteFormacao(grafico);
    },
    beforeUpdate(grafico) {
        for (const [chave, estado] of Object.entries(formacoesAnalises)) {
            // O compacto pode estabilizar seu tamanho enquanto ainda aguarda a entrada do card.
            if (estado.grafico === grafico && estado.exibido && (chave !== "resumo" || estado.iniciou)) {
                finalizarFormacaoAnalises(chave);
            }
        }
    },
    resize(grafico) { formacaoGraficosAnalises.beforeUpdate(grafico); },
    beforeDestroy(grafico) {
        for (const [chave, estado] of Object.entries(formacoesAnalises)) {
            if (estado.grafico === grafico) finalizarFormacaoAnalises(chave);
        }
    }
};

function observarFormacoesAnalises() {
    if (!("IntersectionObserver" in window)) return; // Sem observador, mantém os gráficos completos.
    const observador = new IntersectionObserver((entradas) => {
        for (const entrada of entradas) {
            const chave = entrada.target.id === "area-historico-resumo" ? "resumo"
                : entrada.target.id === "area-historico-analises" ? "historico" : "distribuicao";
            if (entrada.isIntersecting) agendarFormacaoAnalises(chave);
            else finalizarFormacaoAnalises(chave, true);
        }
    });
    ["area-historico-resumo", "area-historico-analises", "area-distribuicao"]
        .forEach((id) => observador.observe(document.getElementById(id)));
    movimentoReduzidoGraficos.addEventListener("change", () => {
        if (movimentoReduzidoGraficos.matches) concluirFormacoesAnalises();
    });
}

function configurarGraficoDistribuicao(classificacoes) {
    return {
        type: "doughnut",
        plugins: [formacaoGraficosAnalises],
        data: { labels: classificacoes.map((item) => item.nome), datasets: [{
            data: classificacoes.map((item) => item.totalCentavos / 100),
            backgroundColor: classificacoes.map((item) => item.cor), borderWidth: 2, borderColor: "#ffffff"
        }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: "65%",
            plugins: { legend: { display: false }, tooltip: { callbacks: {
                label: (contexto) => {
                    const item = classificacoes[contexto.dataIndex];
                    return `${item.nome}: ${formatarCentavos(item.totalCentavos)} (${formatarPercentualDistribuicao(item.percentual)})`;
                }
            } } }
        }
    };
}

function formatarPercentualDistribuicao(percentual) {
    return `${percentual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatarPeriodoDistribuicao(mesInicial, mesFinal) {
    const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const formatar = (mes) => `${nomes[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
    return mesInicial === mesFinal ? formatar(mesInicial) : `${formatar(mesInicial)} — ${formatar(mesFinal)}`;
}

function destruirInstanciaGrafico(canvas, instancia = null) {
    try {
        const grafico = instancia || window.Chart?.getChart?.(canvas);
        if (grafico) grafico.destroy();
        return true;
    } catch (erro) {
        // A falha visual não pode interromper operações já persistidas.
        return false;
    }
}

function limparGraficoDistribuicao() {
    const canvas = document.getElementById("grafico-distribuicao");
    document.getElementById("area-distribuicao").hidden = true;
    const instancia = graficoDistribuicao;
    graficoDistribuicao = null;
    destruirInstanciaGrafico(canvas, instancia);
}

function atualizarDistribuicaoDespesas() {
    finalizarFormacaoAnalises("distribuicao");
    const tipo = document.getElementById("periodo-distribuicao").value;
    const inicial = document.getElementById("mes-inicial-distribuicao");
    const final = document.getElementById("mes-final-distribuicao");
    const estado = document.getElementById("estado-distribuicao");
    const total = document.getElementById("total-distribuicao");
    const intervalo = document.getElementById("intervalo-distribuicao");
    const legenda = document.getElementById("legenda-distribuicao");
    document.getElementById("meses-distribuicao").hidden = tipo !== "personalizado";
    limparErroCampo(inicial);
    limparErroCampo(final);
    let periodo = definirPeriodoDespesas(tipo, inicial.value, final.value);
    if (tipo === "personalizado") {
        if (!dataValida(`${inicial.value}-01`)) mostrarErro(inicial, "Selecione um mês inicial válido.");
        if (!dataValida(`${final.value}-01`)) mostrarErro(final, "Selecione um mês final válido.");
        if (dataValida(`${inicial.value}-01`) && dataValida(`${final.value}-01`) && !periodo.disponivel) {
            mostrarErro(inicial.value > final.value ? final : inicial, periodo.motivo);
        }
    }
    const distribuicao = periodo.disponivel
        ? obterDistribuicaoDespesas(tipo, inicial.value, final.value)
        : distribuicaoDespesasIndisponivel(periodo.motivo);
    legenda.replaceChildren();
    total.hidden = !distribuicao.disponivel;
    document.getElementById("valor-total-distribuicao").textContent = distribuicao.disponivel
        ? formatarCentavos(distribuicao.totalCentavos) : "";
    intervalo.textContent = periodo.disponivel
        ? formatarPeriodoDistribuicao(periodo.mesInicial, periodo.mesFinal) : "";
    let mensagem = !distribuicao.disponivel ? `Distribuição indisponível. ${distribuicao.motivo}`
        : distribuicao.vazio ? distribuicao.motivo : "";
    if (!mensagem) {
        const itens = distribuicao.classificacoes.filter((item) => item.totalCentavos > 0);
        itens.forEach((item) => {
            const linha = document.createElement("li");
            const cor = document.createElement("span");
            cor.classList.add("cor-classificacao");
            cor.style.backgroundColor = item.cor;
            cor.setAttribute("aria-hidden", "true");
            const texto = document.createElement("span");
            texto.classList.add("nome-classificacao");
            texto.append(cor, `${item.nome}:`);
            const valor = document.createElement("span");
            valor.classList.add("valor-classificacao");
            valor.textContent = ` ${formatarCentavos(item.totalCentavos)}`;
            const percentual = document.createElement("span");
            percentual.classList.add("percentual-classificacao");
            percentual.textContent = ` ${formatarPercentualDistribuicao(item.percentual)}`;
            linha.append(texto, valor, percentual);
            legenda.appendChild(linha);
        });
        if (typeof window.Chart !== "function") {
            mensagem = "Gráfico indisponível: não foi possível carregar a biblioteca. Os valores estão disponíveis na legenda.";
        } else {
            try {
                document.getElementById("area-distribuicao").hidden = false;
                const configuracao = configurarGraficoDistribuicao(itens);
                if (graficoDistribuicao) {
                    graficoDistribuicao.data = configuracao.data;
                    graficoDistribuicao.options = configuracao.options;
                    graficoDistribuicao.update("none");
                    graficoDistribuicao.resize();
                } else {
                    const canvas = document.getElementById("grafico-distribuicao");
                    if (!destruirInstanciaGrafico(canvas)) throw new Error("Não foi possível liberar o gráfico anterior.");
                    graficoDistribuicao = new window.Chart(canvas, configuracao);
                }
            } catch (erro) {
                mensagem = "Gráfico indisponível: não foi possível renderizar a distribuição. Consulte os valores na legenda.";
            }
        }
    }
    if (mensagem) limparGraficoDistribuicao();
    estado.textContent = mensagem;
    // Se a visita começou sem gráfico válido, novos lançamentos continuam instantâneos.
    if (mensagem && document.getElementById("grafico-distribuicao").closest(".pagina").classList.contains("ativa")) {
        formacoesAnalises.distribuicao.exibido = true;
    }
    agendarFormacaoAnalises("distribuicao");
    estado.hidden = !mensagem;
}

function formatarMesHistorico(mes, incluirAno = true) {
    const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return nomes[Number(mes.slice(5, 7)) - 1] + (incluirAno ? ` ${mes.slice(0, 4)}` : "");
}

function formatarPeriodoHistorico(inicio, fim, hoje = obterDataLocal()) {
    const periodo = inicio === fim ? formatarMesHistorico(fim)
        : `${formatarMesHistorico(inicio, inicio.slice(0, 4) !== fim.slice(0, 4))} — ${formatarMesHistorico(fim)}`;
    return periodo + (fim === hoje.slice(0, 7) ? " · Dados até hoje" : "");
}

// Plugin local: não altera a rosca nem registra comportamento global no Chart.js.
const indicadorMesHistorico = {
    id: "indicadorMesHistorico",
    beforeUpdate(grafico) {
        grafico.setActiveElements([]);
        grafico.tooltip?.setActiveElements([], { x: 0, y: 0 });
    },
    afterEvent(grafico, argumentos) {
        const tipo = argumentos.event.native?.type || argumentos.event.type;
        if (argumentos.inChartArea && tipo !== "touchcancel") return;
        grafico.setActiveElements([]);
        grafico.tooltip?.setActiveElements([], { x: 0, y: 0 });
        argumentos.changed = true;
    },
    beforeDatasetsDraw(grafico) {
        const ativo = grafico.getActiveElements()[0];
        if (!ativo) return;
        const { ctx, chartArea } = grafico;
        const x = ativo.element.x;
        ctx.save();
        try {
            ctx.beginPath();
            ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
            ctx.clip();
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.setLineDash([2, 3]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "#d8d2df";
            ctx.stroke();
        } finally {
            ctx.restore();
        }
    }
};

// As duas visualizações diferem apenas na densidade de eixos e legenda.
function configurarGraficoHistorico(historico, compacto = false) {
    const configuracao = {
        type: "line",
        plugins: [indicadorMesHistorico, formacaoGraficosAnalises],
        data: {
            labels: historico.meses.map((mes) => formatarPeriodoDistribuicao(mes.mes, mes.mes)),
            datasets: [
                { label: "Receitas", data: historico.meses.map((mes) => mes.receitasCentavos / 100),
                    borderColor: "#14966D", backgroundColor: "#14966D", pointStyle: "circle" },
                { label: "Despesas", data: historico.meses.map((mes) => mes.despesasCentavos / 100),
                    borderColor: "#E76F65", backgroundColor: "#E76F65", pointStyle: "circle" }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            locale: "pt-BR",
            events: ["mousemove", "mouseout", "click", "touchstart", "touchmove", "touchcancel"],
            interaction: { mode: "index", intersect: false },
            elements: { line: { borderWidth: 2, cubicInterpolationMode: "monotone" }, point: { radius: 0, hoverRadius: 4, hitRadius: 14 } },
            plugins: {
                legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, font: { size: compacto ? 11 : 12 } } },
                tooltip: { callbacks: {
                    title: (itens) => itens.length ? formatarPeriodoDistribuicao(historico.meses[itens[0].dataIndex].mes, historico.meses[itens[0].dataIndex].mes) : "",
                    label: (contexto) => `${contexto.dataset.label}: ${formatarCentavos(historico.meses[contexto.dataIndex][contexto.datasetIndex === 0 ? "receitasCentavos" : "despesasCentavos"])}` } }
            },
            scales: {
                x: {
                    grid: { display: false },
                    afterBuildTicks: (escala) => {
                        const limite = compacto || escala.chart.width < 480 ? 3 : 6;
                        const quantidade = historico.meses.length;
                        const selecionados = new Set([quantidade - 1]);
                        // Preserva a virada do ano mesmo quando reduzimos os rótulos.
                        historico.meses.forEach((item, indice) => {
                            if (indice > 0 && item.mes.slice(5, 7) === "01") selecionados.add(indice);
                        });
                        const distancia = Math.max(1, Math.floor(quantidade / limite));
                        for (let indice = 0; indice < quantidade && selecionados.size < limite; indice++) {
                            if ([...selecionados].every((outro) => Math.abs(outro - indice) >= distancia)) selecionados.add(indice);
                        }
                        escala.ticks = escala.ticks.filter((tick) => selecionados.has(Number(tick.value)));
                    },
                    ticks: { maxRotation: 0, autoSkip: false, callback: (valor) => {
                        const indice = Number(valor);
                        const mes = historico.meses[indice].mes;
                        const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                        const virada = indice > 0 && mes.slice(0, 4) !== historico.meses[indice - 1].mes.slice(0, 4);
                        return nomes[Number(mes.slice(5, 7)) - 1] + (virada ? " '" + mes.slice(2, 4) : "");
                    } }
                },
                y: { beginAtZero: true, border: { display: false },
                    grid: { display: !compacto, color: "#edf0f5" },
                    ticks: { maxTicksLimit: compacto ? 3 : 6, callback: (valor) => formatadorMoeda.format(valor) } }
            }
        }
    };
    if (!compacto) {
        configuracao.options.plugins.legend.labels.color = "#62566f";
        configuracao.options.plugins.legend.labels.padding = 20;
        Object.assign(configuracao.options.plugins.tooltip, {
            backgroundColor: "#302738", padding: 12, cornerRadius: 8,
            titleFont: { size: 12 }, bodyFont: { size: 12 }
        });
        configuracao.options.scales.x.ticks.color = "#6d6278";
        configuracao.options.scales.x.ticks.font = { size: 12 };
        configuracao.options.scales.x.ticks.padding = 8;
        configuracao.options.scales.y.ticks.color = "#6d6278";
        configuracao.options.scales.y.ticks.font = { size: 11 };
        configuracao.options.scales.y.grid.color = "#eeeaf3";
    }
    return configuracao;
}

function renderizarGraficoHistorico(destino, historico) {
    const chaveFormacao = destino === "resumo" ? "resumo" : "historico";
    const formacao = formacoesAnalises[chaveFormacao];
    const assinatura = destino === "resumo" && historico.disponivel && !historico.vazio
        ? JSON.stringify(historico.meses) : null;
    const preservarEsperaResumo = destino === "resumo" && assinatura !== null
        && assinatura === formacao.assinatura && formacao.grafico === graficosHistorico.resumo
        && formacao.quadro !== null && !formacao.iniciou && formacaoEstaVisivel(formacao.grafico);
    if (!preservarEsperaResumo) {
        if (destino === "resumo" && formacao.grafico && assinatura !== formacao.assinatura) {
            formacao.exibido = true;
        }
        finalizarFormacaoAnalises(chaveFormacao);
    }
    if (destino === "resumo") formacao.assinatura = assinatura;
    const area = document.getElementById(`area-historico-${destino}`);
    const estado = document.getElementById(`estado-historico-${destino}`);
    const periodo = document.getElementById(`periodo-historico-${destino}`);
    const descricao = document.getElementById(`dados-historico-${destino}`);
    const canvas = document.getElementById(`grafico-historico-${destino}`);
    let mensagem = !historico.disponivel ? `Histórico indisponível. ${historico.motivo}`
        : historico.vazio ? "Nenhuma transação até a data atual para exibir no histórico."
        : typeof window.Chart !== "function" ? "Gráfico indisponível: não foi possível carregar a biblioteca. Verifique sua conexão e recarregue a página." : "";

    periodo.textContent = historico.disponivel && !historico.vazio
        ? formatarPeriodoHistorico(historico.meses[0].mes, historico.meses.at(-1).mes) : "";
    descricao.textContent = historico.disponivel && !historico.vazio
        ? `${periodo.textContent}. ` + historico.meses.map((mes) => `${formatarPeriodoDistribuicao(mes.mes, mes.mes)}: receitas ${formatarCentavos(mes.receitasCentavos)}, despesas ${formatarCentavos(mes.despesasCentavos)}.`).join(" ") : "";
    if (!mensagem) {
        area.hidden = false;
        try {
            const configuracao = configurarGraficoHistorico(historico, destino === "resumo");
            if (graficosHistorico[destino]) {
                graficosHistorico[destino].data = configuracao.data;
                // O tooltip monetário deve usar os centavos do período atualizado.
                graficosHistorico[destino].options = configuracao.options;
                graficosHistorico[destino].update("none");
                graficosHistorico[destino].resize();
            } else {
                if (!destruirInstanciaGrafico(canvas)) throw new Error("Não foi possível liberar o gráfico anterior.");
                graficosHistorico[destino] = new window.Chart(canvas, configuracao);
            }
        } catch (erro) {
            mensagem = "Gráfico indisponível: não foi possível renderizar o histórico financeiro.";
        }
    }
    if (mensagem) {
        area.hidden = true;
        // Também remove instâncias eventualmente registradas por um construtor que falhou.
        const grafico = graficosHistorico[destino];
        graficosHistorico[destino] = null;
        destruirInstanciaGrafico(canvas, grafico);
    }
    estado.textContent = mensagem;
    estado.hidden = !mensagem;
    if (mensagem && canvas.closest(".pagina").classList.contains("ativa")) {
        formacoesAnalises[chaveFormacao].exibido = true;
    }
    agendarFormacaoAnalises(chaveFormacao);
}

function atualizarControlesHistorico(historico) {
    const seletor = document.getElementById("mes-final-historico");
    const disponivel = historico.disponivel && !historico.vazio;
    document.querySelectorAll("[data-duracao-historico]").forEach((botao) => {
        botao.disabled = !disponivel;
        botao.setAttribute("aria-pressed", String(Number(botao.dataset.duracaoHistorico) === duracaoHistoricoAnalises));
    });
    seletor.disabled = !disponivel;
    const limites = disponivel ? historico.primeiroMes + ":" + historico.ultimoMes
        : historico.disponivel ? "vazio" : "indisponivel";
    if (seletor.dataset.limites !== limites || !seletor.options.length) {
        seletor.replaceChildren();
        if (disponivel) {
            const primeiro = Number(historico.primeiroMes.slice(0, 4)) * 12 + Number(historico.primeiroMes.slice(5, 7)) - 1;
            const ultimo = Number(historico.ultimoMes.slice(0, 4)) * 12 + Number(historico.ultimoMes.slice(5, 7)) - 1;
            for (let indice = ultimo; indice >= primeiro; indice--) {
                const mes = String(Math.floor(indice / 12)).padStart(4, "0") + "-" + String(indice % 12 + 1).padStart(2, "0");
                const opcao = document.createElement("option");
                opcao.value = mes;
                opcao.textContent = formatarPeriodoDistribuicao(mes, mes);
                seletor.appendChild(opcao);
            }
        } else {
            const opcao = document.createElement("option");
            opcao.textContent = historico.disponivel ? "Sem histórico" : "Dados indisponíveis";
            seletor.appendChild(opcao);
        }
        seletor.dataset.limites = limites;
    }
    if (disponivel) seletor.value = mesFinalHistoricoAnalises;
}

function atualizarGraficosHistorico() {
    const recente = obterHistoricoMensal(); // Resumo: sempre seis meses recentes.
    if (recente.disponivel) {
        mesFinalHistoricoAnalises = recente.vazio ? null
            : mesFinalHistoricoAnalises === null ? recente.ultimoMes
            : mesFinalHistoricoAnalises < recente.primeiroMes ? recente.primeiroMes
            : mesFinalHistoricoAnalises > recente.ultimoMes ? recente.ultimoMes : mesFinalHistoricoAnalises;
    }
    const analises = !recente.disponivel || recente.vazio ? recente
        : obterHistoricoMensal(mesFinalHistoricoAnalises, duracaoHistoricoAnalises);
    atualizarControlesHistorico(recente);
    renderizarGraficoHistorico("resumo", recente);
    renderizarGraficoHistorico("analises", analises);
}

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

let investimentoEmEdicao = null;
let investimentoEmExclusao = null;
const formInvestimento = document.getElementById("form-investimento");
const modalInvestimento = document.getElementById("modal-investimento");
const modalExclusaoInvestimento = document.getElementById("modal-exclusao-investimento");
const camposInvestimento = {
    nome: document.getElementById("nome-investimento"),
    tipo: document.getElementById("tipo-investimento"),
    instituicao: document.getElementById("instituicao-investimento"),
    capital: document.getElementById("capital-investimento"),
    valor: document.getElementById("valor-investimento"),
    referencia: document.getElementById("referencia-investimento"),
    referenciaValor: document.getElementById("referencia-valor-investimento"),
    observacoes: document.getElementById("observacoes-investimento")
};

function investimentosDisponiveis() {
    if (!disponibilidadeColecoes.colecaoEstaBloqueada("investimentos")) return true;
    mostrarToast("Investimentos indisponíveis. As gravações estão bloqueadas e os dados armazenados foram preservados.", "erro");
    return false;
}

function abrirModalInvestimento(id = null) {
    if (!investimentosDisponiveis()) return;
    const investimento = id === null ? null : disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === id);
    if (id !== null && !investimento) {
        mostrarToast("O investimento não está disponível para edição.", "erro");
        return;
    }
    formInvestimento.reset();
    limparErros(formInvestimento);
    investimentoEmEdicao = id;
    document.getElementById("titulo-modal-investimento").textContent = investimento ? "Editar investimento" : "Adicionar investimento";
    document.getElementById("salvar-investimento").textContent = investimento ? "Salvar alterações" : "Salvar investimento";
    camposInvestimento.nome.value = investimento?.nome ?? "";
    camposInvestimento.tipo.value = investimento?.tipo ?? "";
    camposInvestimento.instituicao.value = investimento?.instituicao ?? "";
    camposInvestimento.capital.value = investimento?.capitalInicial ?? "";
    camposInvestimento.valor.value = investimento?.valorInformado ?? "";
    camposInvestimento.referencia.max = obterDataLocal();
    camposInvestimento.referencia.value = investimento?.dataReferenciaCapital ?? obterDataLocal();
    camposInvestimento.referenciaValor.max = obterDataLocal();
    camposInvestimento.referenciaValor.value = investimento?.dataReferenciaValor ?? obterDataLocal();
    atualizarAvisoRetroativo(camposInvestimento.referenciaValor, investimento?.dataReferenciaValor,
        "aviso-retroativo-investimento", "confirmar-retroativo-investimento");
    camposInvestimento.observacoes.value = investimento?.observacoes ?? "";
    abrirModal(modalInvestimento, camposInvestimento.nome);
}

function fecharModalInvestimento() {
    fecharModal(modalInvestimento, () => {
        formInvestimento.reset();
        limparErros(formInvestimento);
        investimentoEmEdicao = null;
    });
}

// Ponto único de proteção da exclusão, incluindo movimentos históricos e futuros.
function podeExcluirInvestimento(id) {
    if (!investimentosDisponiveis()) return false;
    if (disponibilidadeColecoes.colecaoEstaBloqueada("transacoes")) {
        mostrarToast("Não é possível excluir o investimento: as transações estão indisponíveis e os vínculos não puderam ser verificados.", "erro");
        return false;
    }
    if (disponibilidadeColecoes.consultarTransacoes().some((item) => ehMovimentacaoInvestimento(item) && item.investimentoId === id)) {
        mostrarToast("Este investimento possui aportes ou resgates vinculados e não pode ser excluído, inclusive quando os registros são históricos ou futuros.", "erro");
        return false;
    }
    if (!disponibilidadeColecoes.consultarInvestimentos().some((item) => item.id === id)) {
        mostrarToast("O investimento não está disponível para exclusão.", "erro");
        return false;
    }
    return true;
}

function solicitarExclusaoInvestimento(id) {
    if (!podeExcluirInvestimento(id)) return;
    investimentoEmExclusao = id;
    const investimento = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === id);
    document.getElementById("mensagem-exclusao-investimento").textContent = `Deseja excluir o investimento "${investimento.nome}"? Esta ação não poderá ser desfeita.`;
    abrirModal(modalExclusaoInvestimento, document.getElementById("cancelar-exclusao-investimento"));
}

function fecharExclusaoInvestimento() {
    fecharModal(modalExclusaoInvestimento);
    investimentoEmExclusao = null;
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

formInvestimento.addEventListener("submit", (evento) => {
    evento.preventDefault();
    limparErros(formInvestimento);
    if (!investimentosDisponiveis()) return;
    const campos = camposInvestimento;
    let valido = true;
    const erro = (campo, mensagem) => { mostrarErro(campo, mensagem); valido = false; };
    if (!campos.nome.value.trim()) erro(campos.nome, "Informe o nome do investimento.");
    if (!campos.tipo.value.trim()) erro(campos.tipo, "Informe o tipo do investimento ou escolha uma sugestão.");
    [campos.capital, campos.valor].forEach((campo) => {
        if (campo.value === "" || !valorMonetarioValido(campo.value) || !campo.validity.valid) {
            erro(campo, "Informe um valor zero ou positivo, com até duas casas decimais, dentro do limite permitido.");
        }
    });
    const referencia = campos.referencia.value;
    if (!dataValida(referencia) || referencia > obterDataLocal() || !campos.referencia.validity.valid) {
        erro(campos.referencia, "Informe uma data válida, igual ou anterior a hoje.");
    }
    if (campos.observacoes.value.length > 500) erro(campos.observacoes, "Use no máximo 500 caracteres.");
    const referenciaValor = campos.referenciaValor.value;
    if (!dataValida(referenciaValor) || referenciaValor > obterDataLocal() || !campos.referenciaValor.validity.valid) {
        erro(campos.referenciaValor, "Informe uma data válida, igual ou anterior a hoje.");
    }
    const investimentoAnterior = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === investimentoEmEdicao);
    if (investimentoAnterior && referenciaValor < investimentoAnterior.dataReferenciaValor
        && !document.getElementById("confirmar-retroativo-investimento").checked) {
        erro(campos.referenciaValor, "Confirme abaixo a substituição retroativa e o recálculo das movimentações.");
    }
    if (!valido) { focarPrimeiroErro(formInvestimento); return; }
    const editando = investimentoEmEdicao !== null;
    const anterior = editando ? disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === investimentoEmEdicao) : null;
    if (editando && !anterior) { mostrarToast("O investimento em edição não está disponível.", "erro"); return; }
    const valorInformado = Number(campos.valor.value);
    const atualizouValor = !anterior || anterior.valorInformado !== valorInformado || anterior.dataReferenciaValor !== referenciaValor;
    const registro = {
        id: anterior ? anterior.id : crypto.randomUUID(),
        nome: campos.nome.value.trim(), tipo: campos.tipo.value.trim(), instituicao: campos.instituicao.value.trim(),
        capitalInicial: Number(campos.capital.value), dataReferenciaCapital: referencia,
        valorInformado, dataReferenciaValor: referenciaValor,
        atualizadoEm: atualizouValor ? new Date().toISOString() : anterior.atualizadoEm,
        observacoes: campos.observacoes.value.trim()
    };
    const proximos = editando ? disponibilidadeColecoes.consultarInvestimentos().map((item) => item.id === anterior.id ? registro : item) : [...disponibilidadeColecoes.consultarInvestimentos(), registro];
    if (!persistirColecao("investimentos", proximos)) return;
    renderizarInvestimentos();
    // Resolve os nomes atuais pelos IDs, preservando os registros e o estado da listagem.
    renderizarTransacoes(listaTransacoes, 5);
    atualizarTabelaCompleta();
    if (editando) prepararRetornoFocoInvestimento(registro.id, "editar");
    fecharModalInvestimento();
    mostrarToast(editando ? "Investimento atualizado." : "Investimento cadastrado.", "sucesso");
});
document.getElementById("novo-investimento").addEventListener("click", () => abrirModalInvestimento());
document.getElementById("fechar-investimento").addEventListener("click", fecharModalInvestimento);
document.getElementById("cancelar-investimento").addEventListener("click", fecharModalInvestimento);
Object.values(camposInvestimento).filter((campo) => campo.id !== "instituicao-investimento").forEach((campo) => {
    campo.addEventListener("input", () => limparErroCampo(campo));
});
document.getElementById("cancelar-exclusao-investimento").addEventListener("click", fecharExclusaoInvestimento);
modalExclusaoInvestimento.addEventListener("click", (evento) => {
    if (evento.target === modalExclusaoInvestimento) fecharExclusaoInvestimento();
});
document.getElementById("confirmar-exclusao-investimento").addEventListener("click", () => {
    if (investimentoEmExclusao === null || !podeExcluirInvestimento(investimentoEmExclusao)) return;
    const proximos = disponibilidadeColecoes.consultarInvestimentos().filter((item) => item.id !== investimentoEmExclusao);
    if (!persistirColecao("investimentos", proximos)) return;
    renderizarInvestimentos();
    fecharExclusaoInvestimento();
    mostrarToast("Investimento excluído.", "sucesso");
});
renderizarInvestimentos();

function atualizarAvisoRetroativo(campo, referenciaAnterior, avisoId, confirmacaoId) {
    const aviso = document.getElementById(avisoId);
    aviso.classList.toggle("hidden", !referenciaAnterior || !campo.value || campo.value >= referenciaAnterior);
    document.getElementById(confirmacaoId).checked = false;
}

camposInvestimento.referenciaValor.addEventListener("input", () => {
    const anterior = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === investimentoEmEdicao);
    atualizarAvisoRetroativo(camposInvestimento.referenciaValor, anterior?.dataReferenciaValor,
        "aviso-retroativo-investimento", "confirmar-retroativo-investimento");
});

let investimentoEmAtualizacao = null;
const modalValorInvestimento = document.getElementById("modal-valor-investimento");
const formValorInvestimento = document.getElementById("form-valor-investimento");
const campoValorManual = document.getElementById("valor-manual-investimento");
const campoDataValorManual = document.getElementById("data-valor-manual");

function abrirAtualizacaoValor(id) {
    if (!investimentosDisponiveis()) return;
    const investimento = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === id);
    if (!investimento) { mostrarToast("Investimento indisponível para atualização.", "erro"); return; }
    investimentoEmAtualizacao = id;
    formValorInvestimento.reset();
    limparErros(formValorInvestimento);
    document.getElementById("titulo-valor-investimento").textContent = `Atualizar valor · ${investimento.nome}`;
    document.getElementById("avaliacao-anterior-investimento").textContent =
        `Avaliação anterior: ${formatarCentavos(converterParaCentavos(investimento.valorInformado))}, referente ao final de ${formatarDataInvestimento(investimento.dataReferenciaValor)}. Registro atualizado em ${formatarDataInvestimento(obterDataLocal(new Date(investimento.atualizadoEm)))}.`;
    campoValorManual.value = investimento.valorInformado;
    campoDataValorManual.max = obterDataLocal();
    campoDataValorManual.value = investimento.dataReferenciaValor;
    atualizarAvisoRetroativo(campoDataValorManual, investimento.dataReferenciaValor,
        "aviso-retroativo-manual", "confirmar-retroativo-manual");
    abrirModal(modalValorInvestimento, campoValorManual);
}

function fecharAtualizacaoValor() {
    fecharModal(modalValorInvestimento, () => {
        formValorInvestimento.reset();
        limparErros(formValorInvestimento);
        investimentoEmAtualizacao = null;
    });
}

formValorInvestimento.addEventListener("submit", (evento) => {
    evento.preventDefault();
    limparErros(formValorInvestimento);
    const anterior = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === investimentoEmAtualizacao);
    if (!investimentosDisponiveis() || !anterior) return;
    let valido = true;
    if (campoValorManual.value === "" || !valorMonetarioValido(campoValorManual.value) || !campoValorManual.validity.valid) {
        mostrarErro(campoValorManual, "Informe um valor zero ou positivo, com até duas casas decimais, dentro do limite permitido.");
        valido = false;
    }
    const data = campoDataValorManual.value;
    if (!dataValida(data) || data > obterDataLocal() || !campoDataValorManual.validity.valid) {
        mostrarErro(campoDataValorManual, "Informe uma data válida, igual ou anterior a hoje.");
        valido = false;
    } else if (data < anterior.dataReferenciaValor && !document.getElementById("confirmar-retroativo-manual").checked) {
        mostrarErro(campoDataValorManual, "Confirme abaixo a substituição retroativa e o recálculo das movimentações.");
        valido = false;
    }
    if (!valido) { focarPrimeiroErro(formValorInvestimento); return; }
    const atualizado = { ...anterior, valorInformado: Number(campoValorManual.value),
        dataReferenciaValor: data, atualizadoEm: new Date().toISOString() };
    const candidatos = disponibilidadeColecoes.consultarInvestimentos().map((item) => item.id === anterior.id ? atualizado : item);
    if (!persistirColecao("investimentos", candidatos)) return;
    renderizarInvestimentos();
    prepararRetornoFocoInvestimento(atualizado.id, "atualizar");
    fecharAtualizacaoValor();
    mostrarToast("Valor informado atualizado. As estimativas foram recalculadas.", "sucesso");
});
campoDataValorManual.addEventListener("input", () => {
    const anterior = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === investimentoEmAtualizacao);
    atualizarAvisoRetroativo(campoDataValorManual, anterior?.dataReferenciaValor,
        "aviso-retroativo-manual", "confirmar-retroativo-manual");
});
[campoValorManual, campoDataValorManual].forEach((campo) => campo.addEventListener("input", () => limparErroCampo(campo)));
document.getElementById("cancelar-valor-investimento").addEventListener("click", fecharAtualizacaoValor);
document.getElementById("fechar-valor-investimento").addEventListener("click", fecharAtualizacaoValor);

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

const modalMovimentacao = document.getElementById("modal-movimentacao");
const formMovimentacao = document.getElementById("form-movimentacao");
const camposMovimentacao = Object.fromEntries(
    ["investimento", "conta", "valor", "capital", "baixa", "data", "observacoes"]
        .map((nome) => [nome, document.getElementById(`${nome}-movimentacao`)]));
let tipoMovimentacao = "aporte";
let movimentacaoEmEdicao = null;

function obterRestricaoMovimentacaoInvestimentos() {
    if (["transacoes", "contas", "investimentos"].some((chave) => disponibilidadeColecoes.colecaoEstaBloqueada(chave))) {
        return { mensagem: "Não é possível movimentar: contas, investimentos ou transações estão indisponíveis. Os dados armazenados foram preservados.", tipo: "erro" };
    }
    if (!disponibilidadeColecoes.consultarContas().length || !disponibilidadeColecoes.consultarInvestimentos().length) {
        return { mensagem: "Cadastre pelo menos uma conta e um investimento antes de registrar aportes ou resgates.", tipo: "informacao" };
    }
    return null;
}

function podeMovimentarInvestimentos() {
    const restricao = obterRestricaoMovimentacaoInvestimentos();
    if (restricao) {
        mostrarToast(restricao.mensagem, restricao.tipo);
        return false;
    }
    return true;
}

function abrirModalMovimentacao(tipo, investimentoId = null, id = null) {
    if (!["aporte", "resgate"].includes(tipo) || !podeMovimentarInvestimentos()) return;
    const registro = id === null ? null : disponibilidadeColecoes.consultarTransacoes().find((item) => item.id === id && item.tipo === tipo);
    if (id !== null && !registro) {
        mostrarToast("A movimentação não está disponível para edição.", "erro");
        return;
    }
    formMovimentacao.reset();
    limparErros(formMovimentacao);
    tipoMovimentacao = tipo;
    movimentacaoEmEdicao = id;
    const resgate = tipo === "resgate";
    document.getElementById("titulo-modal-movimentacao").textContent = `${registro ? "Editar" : "Adicionar"} ${tipo}`;
    document.getElementById("salvar-movimentacao").textContent = registro ? "Salvar alterações" : `Salvar ${tipo}`;
    document.getElementById("rotulo-investimento-movimentacao").textContent = `Investimento de ${resgate ? "origem" : "destino"}`;
    document.getElementById("rotulo-conta-movimentacao").textContent = `Conta de ${resgate ? "destino" : "origem"}`;
    document.getElementById("rotulo-valor-movimentacao").textContent = resgate ? "Valor recebido" : "Valor do aporte";
    document.getElementById("campos-resgate").classList.toggle("hidden", !resgate);
    camposMovimentacao.capital.required = resgate;
    camposMovimentacao.capital.disabled = !resgate;
    camposMovimentacao.baixa.disabled = !resgate;
    for (const [nome, colecao] of [["investimento", disponibilidadeColecoes.consultarInvestimentos()], ["conta", disponibilidadeColecoes.consultarContas()]]) {
        const select = camposMovimentacao[nome];
        select.replaceChildren(new Option("Selecione...", ""));
        colecao.forEach((item) => select.add(new Option(item.nome, item.id)));
    }
    camposMovimentacao.investimento.value = registro?.investimentoId ?? investimentoId ?? "";
    camposMovimentacao.conta.value = registro?.contaId ?? "";
    camposMovimentacao.valor.value = registro?.valor ?? "";
    camposMovimentacao.capital.value = registro?.capitalRetirado ?? "";
    camposMovimentacao.baixa.value = registro?.valorRetiradoInvestimento ?? "";
    camposMovimentacao.data.value = registro?.data ?? obterDataLocal();
    camposMovimentacao.observacoes.value = registro?.observacoes ?? "";
    abrirModal(modalMovimentacao, camposMovimentacao.investimento);
}

function fecharModalMovimentacao() {
    fecharModal(modalMovimentacao, () => {
        formMovimentacao.reset();
        limparErros(formMovimentacao);
        movimentacaoEmEdicao = null;
    });
}

formMovimentacao.addEventListener("submit", (evento) => {
    evento.preventDefault();
    limparErros(formMovimentacao);
    if (!podeMovimentarInvestimentos()) return;
    const campos = camposMovimentacao;
    let valido = true;
    const erro = (campo, mensagem) => { mostrarErro(campo, mensagem); valido = false; };
    const investimento = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === campos.investimento.value);
    if (!investimento) erro(campos.investimento, "Selecione um investimento cadastrado.");
    if (!validarContaTransacao(campos.conta.value)) erro(campos.conta, "Selecione uma conta cadastrada.");
    const monetarios = [campos.valor];
    if (tipoMovimentacao === "resgate") {
        monetarios.push(campos.capital);
        if (campos.baixa.value !== "") monetarios.push(campos.baixa);
    }
    for (const campo of monetarios) {
        if (campo.value === "" || !valorMonetarioValido(campo.value)
            || Number(campo.value) <= 0 || !campo.validity.valid) {
            erro(campo, "Informe um valor maior que zero, com até duas casas decimais, dentro do limite permitido.");
        }
    }
    if (!dataValida(campos.data.value) || !campos.data.validity.valid) erro(campos.data, "Selecione uma data válida.");
    if (campos.observacoes.value.length > 500) erro(campos.observacoes, "Use até 500 caracteres.");
    if (!valido) { focarPrimeiroErro(formMovimentacao); return; }
    const anterior = movimentacaoEmEdicao === null ? null
        : disponibilidadeColecoes.consultarTransacoes().find((item) => item.id === movimentacaoEmEdicao && item.tipo === tipoMovimentacao);
    if (movimentacaoEmEdicao !== null && !anterior) {
        mostrarToast("A movimentação em edição não está disponível.", "erro");
        return;
    }
    const registro = prepararMovimentacaoInvestimento({
        ...anterior,
        id: anterior?.id ?? crypto.randomUUID(),
        tipo: tipoMovimentacao,
        nome: `${tipoMovimentacao === "aporte" ? "Aporte" : "Resgate"} - ${investimento.nome}`,
        investimentoId: investimento.id,
        contaId: campos.conta.value,
        valor: Number(campos.valor.value),
        data: campos.data.value,
        observacoes: campos.observacoes.value.trim(),
        ...(tipoMovimentacao === "resgate" ? {
            capitalRetirado: Number(campos.capital.value),
            valorRetiradoInvestimento: campos.baixa.value === "" ? null : Number(campos.baixa.value)
        } : {})
    });
    const candidatos = anterior ? disponibilidadeColecoes.consultarTransacoes().map((item) => item.id === anterior.id ? registro : item)
        : [...disponibilidadeColecoes.consultarTransacoes(), registro];
    // A persistência valida também a sequência futura completa, antes de qualquer confirmação.
    if (!persistirColecao("transacoes", candidatos)) return;
    limparSelecao();
    atualizarCategorias();
    renderizarTransacoes(listaTransacoes, 5);
    atualizarTabelaCompleta();
    atualizarResumo();
    renderizarInvestimentos();
    fecharModalMovimentacao();
    mostrarToast(anterior ? "Movimentação atualizada." : "Movimentação registrada.", "sucesso");
});
document.querySelectorAll("[data-movimentacao]").forEach((botao) => {
    botao.addEventListener("click", () => abrirModalMovimentacao(botao.dataset.movimentacao));
});
document.getElementById("fechar-movimentacao").addEventListener("click", fecharModalMovimentacao);
document.getElementById("cancelar-movimentacao").addEventListener("click", fecharModalMovimentacao);
// Como no cadastro de investimentos, fundo e Escape não descartam o formulário.
Object.values(camposMovimentacao).forEach((campo) => {
    campo.addEventListener("input", () => limparErroCampo(campo));
    campo.addEventListener("change", () => limparErroCampo(campo));
});

// Um único listener atende as instâncias atuais, sem listeners retidos após destroy().
document.addEventListener("pointerdown", (evento) => {
    for (const grafico of Object.values(graficosHistorico)) {
        if (!grafico || grafico.canvas.contains(evento.target) || !grafico.getActiveElements().length) continue;
        try {
            grafico.setActiveElements([]);
            grafico.tooltip?.setActiveElements([], { x: 0, y: 0 });
            grafico.draw();
        } catch (erro) {
            // Reutiliza o tratamento de falhas visuais, sem gravar dados.
            atualizarGraficosHistorico();
            break;
        }
    }
}, { passive: true });

document.querySelectorAll("[data-duracao-historico]").forEach((botao) => {
    botao.addEventListener("click", () => {
        duracaoHistoricoAnalises = Number(botao.dataset.duracaoHistorico);
        atualizarGraficosHistorico();
    });
});
document.getElementById("mes-final-historico").addEventListener("change", (evento) => {
    mesFinalHistoricoAnalises = evento.target.value;
    atualizarGraficosHistorico();
});

const mesAtualDistribuicao = obterDataLocal().slice(0, 7);
document.getElementById("mes-inicial-distribuicao").value = mesAtualDistribuicao;
document.getElementById("mes-final-distribuicao").value = mesAtualDistribuicao;
["periodo-distribuicao", "mes-inicial-distribuicao", "mes-final-distribuicao"].forEach((id) => {
    document.getElementById(id).addEventListener("change", atualizarDistribuicaoDespesas);
});

listagensTransacoes.inicializar();

observarFormacoesAnalises();
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
