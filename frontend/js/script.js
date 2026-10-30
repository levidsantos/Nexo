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
let tipoTransacao = "";
// Inicializar antes da leitura: erros de carregamento também geram notificações.
const areaNotificacoes = document.getElementById("notificacoes");
const listaNotificacoes = document.getElementById("lista-notificacoes");
const anuncioNotificacoes = document.getElementById("anuncio-notificacoes");
const notificacoesAtivas = [];
const filaNotificacoes = [];
let mensagensParaAnunciar = [];
let anuncioPendente = null;
const colecoesBloqueadas = new Set();
let blocoHistoricoAnalises = 0;
const graficosHistorico = { resumo: null, analises: null };
let graficoDistribuicao = null;
let transacoes = carregarColecao("transacoes", validarTransacao);
let contas = carregarColecao("contas", validarConta);
let investimentos = carregarColecao("investimentos", validarInvestimento);
verificarVinculosCarregados();
const listaTransacoes = document.getElementById("lista-transacoes");
const listaTransacoesCompleta = document.getElementById("lista-transacoes-completa");
const valorRecebido = document.getElementById("valor-recebido");
const valorDespesas = document.getElementById("valor-despesas");
const valorSaldo = document.getElementById("valor-saldo");
let transacoesSelecionadas = [];
const areaAcoes = document.getElementById("area-acoes");
const quantidadeSelecionadas = document.getElementById("transacoes-selecionadas");
const botaoEditar = document.getElementById("btn-editar");
const botaoExcluir = document.getElementById("btn-excluir");
const areaAcoesCompleta = document.getElementById("area-acoes-completa");
const quantidadeSelecionadasCompleta = document.getElementById("transacoes-selecionadas-completa");
const botaoEditarCompleta = document.getElementById("btn-editar-completa");
const botaoExcluirCompleta = document.getElementById("btn-excluir-completa");
const modalExclusao = document.getElementById("modal-exclusao");
const mensagemExclusao = document.getElementById("mensagem-exclusao");
const botaoCancelarExclusao = document.getElementById("cancelar-exclusao");
const botaoConfirmarExclusao = document.getElementById("confirmar-exclusao");
let transacaoEmEdicao = null;
const botaoSalvarTransacao = formTransacao.querySelector('button[type="submit"]');
const linksNavegacao = document.querySelectorAll("[data-pagina]");
const paginas = document.querySelectorAll(".pagina")
const campoPesquisa = document.getElementById("pesquisa-transacoes");
const filtroTipo = document.getElementById("filtro-tipo");
const filtroCategoria = document.getElementById("filtro-categoria");
const filtroDataInicial = document.getElementById("data-inicial");
const filtroDataFinal = document.getElementById("data-final");
const erroFiltroDatas = document.getElementById("erro-filtro-datas");
const botaoLimparFiltros = document.getElementById("limpar-filtros");
let paginaAtual = 1;
const transacoesPorPagina = 8;
const infoPaginacao = document.getElementById("info-paginacao");
const botaoPaginaAnterior = document.getElementById("pagina-anterior");
const botaoProximaPagina = document.getElementById("proxima-pagina");
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
let inclusaoSaldoAlterada = false;
let contaEmEdicao = null;
let contaEmExclusao = null;
const tituloModalConta = document.getElementById("titulo-modal-conta");
const botaoSalvarConta = document.getElementById("salvar-conta");
const modalExclusaoConta = document.getElementById("modal-exclusao-conta");
const mensagemExclusaoConta = document.getElementById("mensagem-exclusao-conta");
const botaoCancelarExclusaoConta = document.getElementById("cancelar-exclusao-conta");
const botaoConfirmarExclusaoConta = document.getElementById("confirmar-exclusao-conta");
const listaContas = document.getElementById("lista-contas");
const saldoTotalContas = document.getElementById("saldo-total-contas");
let modalAtivo = null;
let focoAnteriorModal = null;
let elementosInertes = [];

// botoes para abrir e fechar o modal
addReceita.addEventListener("click", () => {
    if (!prepararContasTransacao()) return;
    formTransacao.reset();
    limparErros(formTransacao);
    transacaoEmEdicao = null;
    modalTitle.textContent = "Adicionar Receita";
    botaoSalvarTransacao.textContent = "Salvar";
    campoClassificacao.classList.add("hidden");
    campoPagamento.classList.add("hidden");
    tipoTransacao = "receita";
    
    abrirModal(modalOverlay, campoNome);
});

addDespesa.addEventListener("click", () => {
    if (!prepararContasTransacao()) return;
    formTransacao.reset();
    limparErros(formTransacao);
    transacaoEmEdicao = null;
    modalTitle.textContent = "Adicionar Despesa";
    botaoSalvarTransacao.textContent = "Salvar";
    campoClassificacao.classList.remove("hidden");
    campoPagamento.classList.remove("hidden");
    tipoTransacao = "despesa";

    abrirModal(modalOverlay, campoNome);
});

botoesFechar.forEach((fechar) => {
    fechar.addEventListener("click", fecharModalTransacao);
});

// funcoes reutilizaveis
function mostrarToast(mensagem, tipo = "informacao") {
    if (!["sucesso", "erro", "informacao"].includes(tipo)) tipo = "informacao";
    const repetida = [...notificacoesAtivas, ...filaNotificacoes].some((notificacao) => {
        return notificacao.mensagem === mensagem && notificacao.tipo === tipo;
    });
    if (repetida) return;

    filaNotificacoes.push({ mensagem, tipo });
    if (notificacoesAtivas.length === 3) {
        const temporaria = notificacoesAtivas.find((notificacao) => {
            return notificacao.tipo !== "erro"
                && !notificacao.elemento.contains(document.activeElement);
        });
        if (temporaria) {
            fecharToast(temporaria);
            return;
        }
    }
    exibirProximosToasts();
}

function exibirProximosToasts() {
    const titulos = { sucesso: "Sucesso", erro: "Erro", informacao: "Informação" };
    while (notificacoesAtivas.length < 3 && filaNotificacoes.length > 0) {
        const notificacao = filaNotificacoes.shift();
        const elemento = document.createElement("div");
        elemento.classList.add("notificacao", `notificacao-${notificacao.tipo}`);
        elemento.setAttribute("role", "group");
        elemento.setAttribute("aria-label", titulos[notificacao.tipo]);
        const texto = document.createElement("div");
        texto.classList.add("notificacao-texto");
        const titulo = document.createElement("strong");
        titulo.classList.add("notificacao-titulo");
        titulo.textContent = titulos[notificacao.tipo];
        const mensagem = document.createElement("p");
        mensagem.classList.add("notificacao-mensagem");
        mensagem.textContent = notificacao.mensagem;
        const fechar = document.createElement("button");
        fechar.type = "button";
        fechar.classList.add("fechar-notificacao");
        fechar.setAttribute("aria-label", `Fechar notificação: ${titulos[notificacao.tipo]}`);
        fechar.textContent = "×";
        fechar.addEventListener("click", () => fecharToast(notificacao));
        texto.append(titulo, mensagem);
        elemento.append(texto, fechar);
        listaNotificacoes.appendChild(elemento);
        notificacao.elemento = elemento;
        notificacao.restante = 4000;
        notificacao.temporizador = null;
        notificacoesAtivas.push(notificacao);

        elemento.addEventListener("mouseenter", () => pausarToast(notificacao));
        elemento.addEventListener("mouseleave", () => retomarToast(notificacao));
        elemento.addEventListener("focusin", (evento) => {
            if (!elemento.contains(evento.relatedTarget)) notificacao.focoAnterior = evento.relatedTarget;
            pausarToast(notificacao);
        });
        elemento.addEventListener("focusout", (evento) => {
            if (!elemento.contains(evento.relatedTarget)) retomarToast(notificacao);
        });
        retomarToast(notificacao);
        mensagensParaAnunciar.push(`${titulos[notificacao.tipo]}: ${notificacao.mensagem}`);
    }
    // Agrupa anúncios que surgem juntos, como falhas nas duas coleções ao iniciar.
    if (mensagensParaAnunciar.length > 0 && anuncioPendente === null) {
        anuncioNotificacoes.textContent = "";
        anuncioPendente = setTimeout(() => {
            anuncioNotificacoes.textContent = mensagensParaAnunciar.join(" ");
            mensagensParaAnunciar = [];
            anuncioPendente = null;
        }, 100);
    }
}

function pausarToast(notificacao) {
    if (notificacao.temporizador === null) return;
    clearTimeout(notificacao.temporizador);
    notificacao.temporizador = null;
    notificacao.restante = Math.max(0, notificacao.restante - (Date.now() - notificacao.inicio));
}

function retomarToast(notificacao) {
    if (!notificacao.elemento.isConnected || notificacao.tipo === "erro" || notificacao.temporizador !== null
        || notificacao.elemento.matches(":hover")
        || notificacao.elemento.contains(document.activeElement)) return;
    notificacao.inicio = Date.now();
    notificacao.temporizador = setTimeout(() => fecharToast(notificacao), notificacao.restante);
}

function fecharToast(notificacao) {
    const indice = notificacoesAtivas.indexOf(notificacao);
    if (indice === -1) return;
    const tinhaFoco = notificacao.elemento.contains(document.activeElement);
    clearTimeout(notificacao.temporizador);
    notificacoesAtivas.splice(indice, 1);
    notificacao.elemento.remove();
    exibirProximosToasts();
    if (tinhaFoco) {
        const proxima = notificacoesAtivas[Math.min(indice, notificacoesAtivas.length - 1)];
        if (proxima) {
            proxima.elemento.querySelector("button").focus();
        } else if (podeReceberFoco(notificacao.focoAnterior)) {
            notificacao.focoAnterior.focus();
        } else if (modalAtivo) {
            modalAtivo.querySelector("button, input").focus();
        } else {
            addReceita.focus();
        }
    }
}

function textoPreenchido(valor) {
    return typeof valor === "string" && valor.trim() !== "";
}

function textoOpcional(valor) {
    return valor == null || typeof valor === "string";
}

function validarContaTransacao(contaId) {
    return !colecoesBloqueadas.has("contas") && textoPreenchido(contaId)
        && contas.some((conta) => conta.id === contaId);
}

function ehMovimentacaoInvestimento(registro) {
    return registro.tipo === "aporte" || registro.tipo === "resgate";
}

function validarVinculosTransacoes(registros, contasCadastradas, investimentosCadastrados = []) {
    const idsContas = new Set(contasCadastradas.map((conta) => conta.id));
    const idsInvestimentos = new Set(investimentosCadastrados.map((item) => item.id));
    return registros.every((transacao) => idsContas.has(transacao.contaId)
        && (!ehMovimentacaoInvestimento(transacao) || idsInvestimentos.has(transacao.investimentoId)));
}

function verificarVinculosCarregados() {
    if (colecoesBloqueadas.has("transacoes")) return;
    const integridade = verificarIntegridadeTransacoes(transacoes, contas, investimentos);
    if (colecoesBloqueadas.has("contas") || !integridade.disponivel) {
        colecoesBloqueadas.add("transacoes");
        // Não apresentar um histórico parcial nem gravar sobre a coleção original.
        transacoes = [];
        mostrarToast("Transações indisponíveis: não foi possível confirmar os vínculos ou a integridade do capital. "
            + integridade.motivo + " "
            + "Os dados armazenados foram preservados e as gravações de transações estão bloqueadas nesta sessão.", "erro");
    }
}

function dataValida(data) {
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
    const [ano, mes, dia] = data.split("-").map(Number);
    if (ano < 1 || mes < 1 || mes > 12 || dia < 1) return false;
    const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
    const diasPorMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return dia <= diasPorMes[mes - 1];
}

function validarTransacao(registro) {
    const baseValida = registro !== null && typeof registro === "object" && !Array.isArray(registro)
        && textoPreenchido(registro.id)
        && ["receita", "despesa", "aporte", "resgate"].includes(registro.tipo)
        && textoPreenchido(registro.nome)
        // Os vínculos são verificados depois de carregar todas as coleções.
        && textoPreenchido(registro.contaId)
        && Number.isFinite(registro.valor) && valorMonetarioValido(registro.valor) && registro.valor > 0
        && dataValida(registro.data);
    if (!baseValida) return false;
    if (!ehMovimentacaoInvestimento(registro)) {
        // Preserva as regras e o formato já aceitos de receitas e despesas.
        return textoPreenchido(registro.categoria) && textoOpcional(registro.pagamento)
            && textoOpcional(registro.classificacao);
    }
    return textoPreenchido(registro.investimentoId) && valorInvestimentoValido(registro.valor)
        && textoOpcional(registro.observacoes)
        && (registro.observacoes == null || registro.observacoes.length <= 500)
        && (registro.tipo !== "resgate" || (
            valorInvestimentoValido(registro.capitalRetirado) && registro.capitalRetirado > 0
            && valorInvestimentoValido(registro.valorRetiradoInvestimento) && registro.valorRetiradoInvestimento > 0));
}

// Uso explícito pela futura interface. Nunca normaliza ou regrava registros carregados.
function prepararMovimentacaoInvestimento(registro) {
    return registro.tipo === "resgate"
        ? { ...registro, valorRetiradoInvestimento: registro.valorRetiradoInvestimento ?? registro.valor }
        : { ...registro };
}

function validarConta(registro) {
    return registro !== null && typeof registro === "object" && !Array.isArray(registro)
        && textoPreenchido(registro.id)
        && textoPreenchido(registro.nome)
        && ["corrente", "poupanca", "reserva", "carteira"].includes(registro.tipo)
        && Number.isFinite(registro.saldoInicial) && valorMonetarioValido(registro.saldoInicial)
        && dataValida(registro.dataReferencia)
        && registro.dataReferencia <= obterDataLocal()
        && typeof registro.incluirNoSaldoDisponivel === "boolean"
        && textoOpcional(registro.instituicao);
}

function validarColecao(registros, validarRegistro) {
    if (!Array.isArray(registros)) return false;
    const ids = new Set();
    for (const registro of registros) {
        if (!validarRegistro(registro) || ids.has(registro.id)) return false;
        ids.add(registro.id);
    }
    return true;
}

function valorInvestimentoValido(valor) {
    return Number.isFinite(valor) && valorMonetarioValido(valor);
}

function valorMonetarioValido(valor) {
    return Number.isSafeInteger(converterParaCentavos(valor));
}

function validarInvestimento(registro) {
    if (registro === null || typeof registro !== "object" || Array.isArray(registro)) return false;
    const hoje = obterDataLocal();
    const instante = typeof registro.atualizadoEm === "string" ? new Date(registro.atualizadoEm) : null;
    return typeof registro.id === "string"
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(registro.id)
        && textoPreenchido(registro.nome) && textoPreenchido(registro.tipo)
        && textoOpcional(registro.instituicao)
        && valorInvestimentoValido(registro.capitalInicial) && valorInvestimentoValido(registro.valorInformado)
        && dataValida(registro.dataReferenciaCapital) && registro.dataReferenciaCapital <= hoje
        && dataValida(registro.dataReferenciaValor) && registro.dataReferenciaValor <= hoje
        && instante !== null && Number.isFinite(instante.getTime())
        && instante.toISOString() === registro.atualizadoEm
        && textoOpcional(registro.observacoes)
        && (registro.observacoes == null || registro.observacoes.length <= 500);
}

function obterDataLocal(data = new Date()) {
    const ano = String(data.getFullYear()).padStart(4, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function converterParaCentavos(valor) {
    if ((typeof valor !== "number" && typeof valor !== "string")
        || String(valor).trim() === "" || !Number.isFinite(Number(valor)) || Number(valor) < 0) return NaN;
    // Opera sobre dígitos decimais, sem arredondar frações de centavo.
    const lerDecimal = (texto) => {
        const partes = /^[-+]?(\d*)(?:\.(\d*))?(?:e([-+]?\d+))?$/i.exec(texto);
        if (!partes || !(partes[1] + (partes[2] || "")).length) return NaN;
        let digitos = (partes[1] + (partes[2] || "")).replace(/^0+/, "");
        if (!digitos) return 0;
        let deslocamento = 2 + Number(partes[3] || 0) - (partes[2] || "").length;
        const semZerosFinais = digitos.replace(/0+$/, "");
        deslocamento += digitos.length - semZerosFinais.length;
        digitos = semZerosFinais;
        if (deslocamento < 0 || digitos.length + deslocamento > 16) return NaN;
        const centavos = Number(digitos + "0".repeat(deslocamento));
        return Number.isSafeInteger(centavos) ? centavos : NaN;
    };
    const centavos = lerDecimal(String(valor).trim());
    // A entrada do formulário também precisa sobreviver ao armazenamento como Number.
    return centavos === lerDecimal(String(Number(valor))) ? centavos : NaN;
}

function saldosIndisponiveis(motivo) {
    return {
        disponivel: false,
        motivo,
        saldosPorContaCentavos: null,
        saldoTotalCentavos: null,
        saldoDisponivelCentavos: null
    };
}

function capitaisIndisponiveis(motivo) {
    return { disponivel: false, motivo, capitaisPorInvestimentoCentavos: null };
}

function calcularCapitaisAplicados(investimentosCadastrados, registros, hoje = obterDataLocal()) {
    if (!dataValida(hoje) || !validarColecao(investimentosCadastrados, validarInvestimento)
        || !validarColecao(registros, validarTransacao)) {
        return capitaisIndisponiveis("Investimentos, transações ou data inválidos para calcular o capital.");
    }
    const porId = new Map(investimentosCadastrados.map((item) => [item.id, item]));
    const movimentosPorDia = new Map(investimentosCadastrados.map((item) => [item.id, new Map()]));
    for (const registro of registros) {
        if (!ehMovimentacaoInvestimento(registro)) continue;
        const investimento = porId.get(registro.investimentoId);
        if (!investimento) return capitaisIndisponiveis("Há uma movimentação vinculada a um investimento inexistente.");
        // A base é consolidada ao final da referência. Não conhecemos o capital anterior.
        if (registro.data <= investimento.dataReferenciaCapital) continue;
        const dias = movimentosPorDia.get(investimento.id);
        const totais = dias.get(registro.data) || { aportes: 0, retiradas: 0 };
        const campo = registro.tipo === "aporte" ? "aportes" : "retiradas";
        const valor = converterParaCentavos(registro.tipo === "aporte" ? registro.valor : registro.capitalRetirado);
        const acumulado = totais[campo] + valor;
        if (!Number.isSafeInteger(valor) || !Number.isSafeInteger(acumulado)) {
            return capitaisIndisponiveis("Um movimento diário ultrapassa o limite seguro em centavos.");
        }
        totais[campo] = acumulado;
        dias.set(registro.data, totais);
    }
    const capitaisPorInvestimentoCentavos = new Map();
    for (const investimento of investimentosCadastrados) {
        let capital = converterParaCentavos(investimento.capitalInicial);
        if (!Number.isSafeInteger(capital)) return capitaisIndisponiveis("Capital inicial fora do limite seguro.");
        let corrente = capital;
        // Sem horário, valida-se o fechamento de cada dia, independentemente da ordem do array.
        const dias = [...movimentosPorDia.get(investimento.id)].sort(([a], [b]) => a.localeCompare(b));
        for (const [data, totais] of dias) {
            capital += totais.aportes - totais.retiradas;
            if (!Number.isSafeInteger(capital) || capital < 0) {
                return capitaisIndisponiveis(`Capital inconsistente no investimento "${investimento.nome}" em ${data}: saldo negativo ou fora do limite seguro.`);
            }
            if (data <= hoje) corrente = capital;
        }
        capitaisPorInvestimentoCentavos.set(investimento.id, corrente);
    }
    return { disponivel: true, motivo: "", capitaisPorInvestimentoCentavos };
}

function verificarIntegridadeTransacoes(registros, contasCadastradas, investimentosCadastrados) {
    if (!validarColecao(registros, validarTransacao) || !validarColecao(contasCadastradas, validarConta)
        || !validarVinculosTransacoes(registros, contasCadastradas, investimentosCadastrados)) {
        return { disponivel: false, motivo: "Há dados inválidos ou vínculos com contas/investimentos inexistentes." };
    }
    // Uma coleção de investimentos indisponível não invalida receitas/despesas sem esses vínculos.
    return registros.some(ehMovimentacaoInvestimento)
        ? calcularCapitaisAplicados(investimentosCadastrados, registros)
        : { disponivel: true, motivo: "" };
}

function obterCapitaisAplicados(hoje = obterDataLocal()) {
    if (["investimentos", "transacoes", "contas"].some((chave) => colecoesBloqueadas.has(chave))) {
        return capitaisIndisponiveis("Dados necessários ao cálculo de capital indisponíveis nesta sessão.");
    }
    const integridade = verificarIntegridadeTransacoes(transacoes, contas, investimentos);
    if (!integridade.disponivel) return capitaisIndisponiveis(integridade.motivo);
    return calcularCapitaisAplicados(investimentos, transacoes, hoje);
}

function valoresInvestimentosIndisponiveis(motivo) {
    return { disponivel: false, motivo, valoresPorInvestimento: null, totalValorCentavos: null };
}

function calcularValoresInvestimentos(investimentosCadastrados, registros, hoje = obterDataLocal()) {
    if (!dataValida(hoje) || !validarColecao(investimentosCadastrados, validarInvestimento)
        || !validarColecao(registros, validarTransacao)) {
        return valoresInvestimentosIndisponiveis("Dados ou data inválidos para estimar as posições.");
    }
    const valoresPorInvestimento = new Map(investimentosCadastrados.map((item) => [item.id, {
        disponivel: true, valorCentavos: converterParaCentavos(item.valorInformado),
        ajustado: false, motivo: "", aportes: 0, retiradas: 0
    }]));
    const porId = new Map(investimentosCadastrados.map((item) => [item.id, item]));
    for (const movimento of registros) {
        if (!ehMovimentacaoInvestimento(movimento)) continue;
        const investimento = porId.get(movimento.investimentoId);
        if (!investimento) return valoresInvestimentosIndisponiveis("Movimentação sem investimento válido.");
        if (movimento.data <= investimento.dataReferenciaValor || movimento.data > hoje) continue;
        const posicao = valoresPorInvestimento.get(investimento.id);
        const campo = movimento.tipo === "aporte" ? "aportes" : "retiradas";
        posicao[campo] += converterParaCentavos(movimento.tipo === "aporte"
            ? movimento.valor : movimento.valorRetiradoInvestimento);
        posicao.ajustado = true;
        if (!Number.isSafeInteger(posicao[campo])) posicao.disponivel = false;
    }
    let totalValorCentavos = 0;
    let disponivel = true;
    for (const posicao of valoresPorInvestimento.values()) {
        const valor = posicao.valorCentavos + (posicao.aportes - posicao.retiradas);
        if (!posicao.disponivel || !Number.isSafeInteger(valor) || valor < 0) {
            posicao.disponivel = false;
            posicao.valorCentavos = null;
            posicao.motivo = "Estimativa inconsistente: atualize o valor manual ou revise as movimentações. Não foi aplicado ajuste automático.";
            disponivel = false;
        } else {
            posicao.valorCentavos = valor;
            totalValorCentavos += valor;
            if (!Number.isSafeInteger(totalValorCentavos)) disponivel = false;
        }
        delete posicao.aportes;
        delete posicao.retiradas;
    }
    return { disponivel, motivo: disponivel ? "" : "Valor total indisponível: há estimativa inconsistente ou limite numérico excedido.",
        valoresPorInvestimento, totalValorCentavos: disponivel ? totalValorCentavos : null };
}

function obterAcompanhamentoInvestimentos(hoje = obterDataLocal()) {
    const capitais = obterCapitaisAplicados(hoje);
    if (!capitais.disponivel) return { capitais, valores: valoresInvestimentosIndisponiveis(capitais.motivo), totalCapitalCentavos: null };
    let totalCapitalCentavos = 0;
    for (const capital of capitais.capitaisPorInvestimentoCentavos.values()) {
        totalCapitalCentavos += capital;
        if (!Number.isSafeInteger(totalCapitalCentavos)) { totalCapitalCentavos = null; break; }
    }
    return { capitais, totalCapitalCentavos, valores: calcularValoresInvestimentos(investimentos, transacoes, hoje) };
}

function movimentoBancarioCentavos(transacao) {
    const valor = converterParaCentavos(transacao.valor);
    switch (transacao.tipo) {
        case "receita": case "resgate": return valor;
        case "despesa": case "aporte": return -valor;
        default: return null;
    }
}

// Recebe as coleções completas. Todos os valores retornados estão em centavos.
// O parâmetro hoje permite testar datas sem depender do relógio da execução.
function calcularSaldos(contasCadastradas, registrosTransacoes, hoje = obterDataLocal(), investimentosCadastrados = []) {
    if (!dataValida(hoje) || !validarColecao(contasCadastradas, validarConta)
        || !validarColecao(registrosTransacoes, validarTransacao)) {
        return saldosIndisponiveis("Dados ou data inválidos para calcular os saldos.");
    }
    const integridade = verificarIntegridadeTransacoes(registrosTransacoes, contasCadastradas, investimentosCadastrados);
    if (!integridade.disponivel) return saldosIndisponiveis(integridade.motivo);

    const contasPorId = new Map();
    const saldosPorContaCentavos = new Map();
    for (const conta of contasCadastradas) {
        const inicial = converterParaCentavos(conta.saldoInicial);
        if (!Number.isSafeInteger(inicial)) {
            return saldosIndisponiveis("O saldo inicial ultrapassa o limite de cálculo seguro em centavos.");
        }
        contasPorId.set(conta.id, conta);
        saldosPorContaCentavos.set(conta.id, inicial);
    }

    for (const transacao of registrosTransacoes) {
        const conta = contasPorId.get(transacao.contaId);
        if (transacao.data <= conta.dataReferencia || transacao.data > hoje) continue;
        const valor = converterParaCentavos(transacao.valor);
        const movimento = movimentoBancarioCentavos(transacao);
        const saldo = saldosPorContaCentavos.get(conta.id) + movimento;
        if (!Number.isSafeInteger(valor) || !Number.isSafeInteger(saldo)) {
            return saldosIndisponiveis("Um movimento ou saldo ultrapassa o limite de cálculo seguro em centavos.");
        }
        saldosPorContaCentavos.set(conta.id, saldo);
    }

    let saldoTotalCentavos = 0;
    let saldoDisponivelCentavos = 0;
    for (const conta of contasCadastradas) {
        const saldo = saldosPorContaCentavos.get(conta.id);
        saldoTotalCentavos += saldo;
        if (conta.incluirNoSaldoDisponivel === true) saldoDisponivelCentavos += saldo;
        if (!Number.isSafeInteger(saldoTotalCentavos) || !Number.isSafeInteger(saldoDisponivelCentavos)) {
            return saldosIndisponiveis("Os totais ultrapassam o limite de cálculo seguro em centavos.");
        }
    }
    return {
        disponivel: true,
        motivo: "",
        saldosPorContaCentavos,
        saldoTotalCentavos,
        saldoDisponivelCentavos
    };
}

// Ponto de entrada da aplicação: nunca calcular sobre os arrays vazios de fallback
// usados quando uma coleção não pôde ser carregada ou seus vínculos são inválidos.
function obterSaldosContas(hoje = obterDataLocal()) {
    if (colecoesBloqueadas.has("contas") || colecoesBloqueadas.has("transacoes")) {
        return saldosIndisponiveis("Dados de contas ou transações indisponíveis nesta sessão.");
    }
    return calcularSaldos(contas, transacoes, hoje, investimentos);
}

function historicoMensalIndisponivel(motivo) {
    return { disponivel: false, motivo, vazio: null, meses: null,
        primeiroMes: null, ultimoMes: null, bloco: null, totalBlocos: null,
        temAnterior: false, temProximo: false };
}

// Bloco 0: até seis meses terminando no mês atual. Blocos maiores recuam no tempo.
// Datas são comparadas como YYYY-MM-DD; não há conversão UTC nem referência de conta.
function prepararHistoricoMensal(registros, hoje = obterDataLocal(), bloco = 0) {
    if (!dataValida(hoje) || !validarColecao(registros, validarTransacao)
        || !Number.isSafeInteger(bloco) || bloco < 0) {
        return historicoMensalIndisponivel("Transações, data ou bloco inválidos para preparar o histórico.");
    }

    const totaisPorMes = new Map();
    let primeiroIndice = null;
    for (const transacao of registros) {
        if (transacao.tipo !== "receita" && transacao.tipo !== "despesa") continue;
        if (transacao.data > hoje) continue;
        const ano = Number(transacao.data.slice(0, 4));
        const mes = Number(transacao.data.slice(5, 7));
        const indice = ano * 12 + mes - 1;
        const totais = totaisPorMes.get(indice) || { receitasCentavos: 0, despesasCentavos: 0 };
        const campo = transacao.tipo === "receita" ? "receitasCentavos" : "despesasCentavos";
        const valor = converterParaCentavos(transacao.valor);
        const total = totais[campo] + valor;
        if (!Number.isSafeInteger(valor) || !Number.isSafeInteger(total)) {
            return historicoMensalIndisponivel("Um valor ou total mensal ultrapassa o limite seguro em centavos.");
        }
        totais[campo] = total;
        totaisPorMes.set(indice, totais);
        primeiroIndice = primeiroIndice === null ? indice : Math.min(primeiroIndice, indice);
    }

    if (primeiroIndice === null) {
        return { disponivel: true, motivo: "Nenhuma movimentação até a data atual.", vazio: true,
            meses: [], primeiroMes: null, ultimoMes: null, bloco: 0, totalBlocos: 0,
            temAnterior: false, temProximo: false };
    }

    const indiceAtual = Number(hoje.slice(0, 4)) * 12 + Number(hoje.slice(5, 7)) - 1;
    const totalBlocos = Math.ceil((indiceAtual - primeiroIndice + 1) / 6);
    if (bloco >= totalBlocos) {
        return historicoMensalIndisponivel("O bloco solicitado está fora do histórico disponível.");
    }
    const fim = indiceAtual - bloco * 6;
    const inicio = Math.max(primeiroIndice, fim - 5);
    const chaveMes = (indice) => `${String(Math.floor(indice / 12)).padStart(4, "0")}-${String(indice % 12 + 1).padStart(2, "0")}`;
    const meses = [];
    for (let indice = inicio; indice <= fim; indice++) {
        const totais = totaisPorMes.get(indice) || { receitasCentavos: 0, despesasCentavos: 0 };
        meses.push({ mes: chaveMes(indice), ...totais });
    }
    return { disponivel: true, motivo: "", vazio: false, meses,
        primeiroMes: chaveMes(primeiroIndice), ultimoMes: chaveMes(indiceAtual),
        bloco, totalBlocos, temAnterior: bloco + 1 < totalBlocos, temProximo: bloco > 0 };
}

// Entrada da aplicação: utiliza a coleção completa e respeita os bloqueios existentes.
function obterHistoricoMensal(bloco = 0, hoje = obterDataLocal()) {
    if (colecoesBloqueadas.has("transacoes") || colecoesBloqueadas.has("contas")) {
        return historicoMensalIndisponivel("Dados de transações ou seus vínculos indisponíveis nesta sessão.");
    }
    if (!validarColecao(transacoes, validarTransacao) || !validarColecao(contas, validarConta)
        || !validarVinculosTransacoes(transacoes, contas, investimentos)) {
        return historicoMensalIndisponivel("Não foi possível validar as transações e seus vínculos.");
    }
    return prepararHistoricoMensal(transacoes, hoje, bloco);
}

// Chaves idênticas aos valores persistidos pelo formulário; cores independem da ordem dos dados.
const CLASSIFICACOES_DESPESAS = Object.freeze({
    Essencial: Object.freeze({ nome: "Necessidades", cor: "#289568" }),
    Desnecessario: Object.freeze({ nome: "Desnecessários", cor: "#DC5252" }),
    Imprevisto: Object.freeze({ nome: "Imprevistos", cor: "#E4B044" }),
    Investimento: Object.freeze({ nome: "Investimentos", cor: "#E58A45" }),
    Desejo: Object.freeze({ nome: "Desejos", cor: "#9164CB" })
});

function distribuicaoDespesasIndisponivel(motivo) {
    return { disponivel: false, motivo, vazio: null, mesInicial: null, mesFinal: null,
        totalCentavos: null, classificacoes: null };
}

function definirPeriodoDespesas(tipo = "atual", mesInicial = null, mesFinal = null, hoje = obterDataLocal()) {
    if (!dataValida(hoje)) return { disponivel: false, motivo: "Data local inválida." };
    if (tipo === "atual") {
        mesInicial = mesFinal = hoje.slice(0, 7);
    } else if (tipo === "anterior") {
        const ano = Number(hoje.slice(0, 4));
        const mes = Number(hoje.slice(5, 7));
        mesInicial = mesFinal = mes === 1 ? `${String(ano - 1).padStart(4, "0")}-12`
            : `${ano.toString().padStart(4, "0")}-${String(mes - 1).padStart(2, "0")}`;
    } else if (tipo !== "personalizado") {
        return { disponivel: false, motivo: "Tipo de período inválido." };
    }
    if (typeof mesInicial !== "string" || typeof mesFinal !== "string"
        || !dataValida(`${mesInicial}-01`) || !dataValida(`${mesFinal}-01`)) {
        return { disponivel: false, motivo: "Informe meses válidos no formato YYYY-MM." };
    }
    if (mesInicial > mesFinal) {
        return { disponivel: false, motivo: "O mês inicial não pode ser posterior ao mês final." };
    }
    if (mesInicial > hoje.slice(0, 7)) {
        return { disponivel: false, motivo: "O período não pode ser inteiramente futuro." };
    }
    return { disponivel: true, motivo: "", mesInicial, mesFinal };
}

// Função pura: meses inclusivos, sem referência de saldo e sem depender da interface.
function prepararDistribuicaoDespesas(registros, mesInicial, mesFinal, hoje = obterDataLocal()) {
    const periodo = definirPeriodoDespesas("personalizado", mesInicial, mesFinal, hoje);
    if (!periodo.disponivel) return distribuicaoDespesasIndisponivel(periodo.motivo);
    if (!validarColecao(registros, validarTransacao)) {
        return distribuicaoDespesasIndisponivel("A coleção de transações contém dados inválidos.");
    }
    const totais = new Map(Object.keys(CLASSIFICACOES_DESPESAS).map((id) => [id, 0]));
    let totalCentavos = 0;
    for (const transacao of registros) {
        const mes = transacao.data.slice(0, 7);
        if (transacao.tipo !== "despesa" || mes < mesInicial || mes > mesFinal || transacao.data > hoje) continue;
        if (!totais.has(transacao.classificacao)) {
            return distribuicaoDespesasIndisponivel("Há despesas no período sem classificação ou com classificação desconhecida. Revise os registros; nenhum dado foi alterado.");
        }
        const valor = converterParaCentavos(transacao.valor);
        const subtotal = totais.get(transacao.classificacao) + valor;
        const proximoTotal = totalCentavos + valor;
        if (!Number.isSafeInteger(valor) || !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(proximoTotal)) {
            return distribuicaoDespesasIndisponivel("Um valor ou total de despesas ultrapassa o limite seguro em centavos.");
        }
        totais.set(transacao.classificacao, subtotal);
        totalCentavos = proximoTotal;
    }
    const classificacoes = Object.entries(CLASSIFICACOES_DESPESAS).map(([id, definicao]) => ({
        id, ...definicao, totalCentavos: totais.get(id),
        // Não arredondar aqui: a futura interface decide a precisão de apresentação.
        percentual: totalCentavos === 0 ? 0 : (totais.get(id) / totalCentavos) * 100
    }));
    return { disponivel: true, motivo: totalCentavos === 0 ? "Nenhuma despesa no período até a data atual." : "",
        vazio: totalCentavos === 0, mesInicial, mesFinal, totalCentavos, classificacoes };
}

// Entrada da aplicação: sempre usa as coleções completas e os bloqueios existentes.
function obterDistribuicaoDespesas(tipo = "atual", mesInicial = null, mesFinal = null, hoje = obterDataLocal()) {
    if (colecoesBloqueadas.has("transacoes") || colecoesBloqueadas.has("contas")) {
        return distribuicaoDespesasIndisponivel("Dados de transações ou seus vínculos indisponíveis nesta sessão.");
    }
    if (!validarColecao(transacoes, validarTransacao) || !validarColecao(contas, validarConta)
        || !validarVinculosTransacoes(transacoes, contas, investimentos)) {
        return distribuicaoDespesasIndisponivel("Não foi possível validar as transações e seus vínculos.");
    }
    const periodo = definirPeriodoDespesas(tipo, mesInicial, mesFinal, hoje);
    if (!periodo.disponivel) return distribuicaoDespesasIndisponivel(periodo.motivo);
    return prepararDistribuicaoDespesas(transacoes, periodo.mesInicial, periodo.mesFinal, hoje);
}

function configurarGraficoDistribuicao(classificacoes) {
    return {
        type: "doughnut",
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
    estado.hidden = !mensagem;
}

function formatarMesHistorico(mes) {
    const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    return `${nomes[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`;
}

// As duas visualizações diferem apenas na densidade de eixos e legenda.
function configurarGraficoHistorico(historico, compacto = false) {
    return {
        type: "line",
        data: {
            labels: historico.meses.map((mes) => formatarMesHistorico(mes.mes)),
            datasets: [
                { label: "Receitas", data: historico.meses.map((mes) => mes.receitasCentavos / 100),
                    borderColor: "#16805d", backgroundColor: "#16805d", pointStyle: "circle" },
                { label: "Despesas", data: historico.meses.map((mes) => mes.despesasCentavos / 100),
                    borderColor: "#8b5cc7", backgroundColor: "#8b5cc7", borderDash: [5, 3], pointStyle: "rectRot" }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            locale: "pt-BR",
            interaction: { mode: "index", intersect: false },
            elements: { line: { borderWidth: 2, tension: 0 }, point: { radius: compacto ? 2 : 3, hoverRadius: 5 } },
            plugins: {
                legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, font: { size: compacto ? 11 : 12 } } },
                tooltip: { callbacks: { label: (contexto) => `${contexto.dataset.label}: ${formatarCentavos(historico.meses[contexto.dataIndex][contexto.datasetIndex === 0 ? "receitasCentavos" : "despesasCentavos"])}` } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: compacto ? 3 : 6 } },
                y: { beginAtZero: true, border: { display: false },
                    grid: { display: !compacto, color: "#edf0f5" },
                    ticks: { maxTicksLimit: compacto ? 3 : 6, callback: (valor) => formatadorMoeda.format(valor) } }
            }
        }
    };
}

function renderizarGraficoHistorico(destino, historico) {
    const area = document.getElementById(`area-historico-${destino}`);
    const estado = document.getElementById(`estado-historico-${destino}`);
    const periodo = document.getElementById(`periodo-historico-${destino}`);
    const descricao = document.getElementById(`dados-historico-${destino}`);
    const canvas = document.getElementById(`grafico-historico-${destino}`);
    let mensagem = !historico.disponivel ? `Histórico indisponível. ${historico.motivo}`
        : historico.vazio ? "Nenhuma transação até a data atual para exibir no histórico."
        : typeof window.Chart !== "function" ? "Gráfico indisponível: não foi possível carregar a biblioteca. Verifique sua conexão e recarregue a página." : "";

    periodo.textContent = historico.disponivel && !historico.vazio
        ? `${formatarMesHistorico(historico.meses[0].mes)} — ${formatarMesHistorico(historico.meses.at(-1).mes)}` : "";
    descricao.textContent = "";
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
            descricao.textContent = historico.meses.map((mes) => `${formatarMesHistorico(mes.mes)}: receitas ${formatarCentavos(mes.receitasCentavos)}, despesas ${formatarCentavos(mes.despesasCentavos)}.`).join(" ");
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
}

function atualizarGraficosHistorico() {
    const recente = obterHistoricoMensal();
    // Reutiliza o mesmo resultado para o bloco recente; sem alterar a agregação.
    if (recente.disponivel) {
        blocoHistoricoAnalises = recente.vazio ? 0 : Math.min(blocoHistoricoAnalises, recente.totalBlocos - 1);
    }
    const analises = blocoHistoricoAnalises === 0 ? recente : obterHistoricoMensal(blocoHistoricoAnalises);
    renderizarGraficoHistorico("resumo", recente);
    renderizarGraficoHistorico("analises", analises);
    const podeNavegar = analises.disponivel && !analises.vazio && typeof window.Chart === "function";
    document.getElementById("historico-anterior").disabled = !podeNavegar || !analises.temAnterior;
    document.getElementById("historico-proximo").disabled = !podeNavegar || !analises.temProximo;
}

function carregarColecao(chave, validarRegistro) {
    try {
        const conteudo = localStorage.getItem(chave);
        if (conteudo === null) return [];
        const registros = JSON.parse(conteudo);
        if (!validarColecao(registros, validarRegistro)) {
            throw new Error("A coleção não é um array válido ou há registros inválidos/IDs repetidos.");
        }
        return registros;
    } catch (erro) {
        colecoesBloqueadas.add(chave);
        mostrarToast(`Os dados de ${chave} estão indisponíveis: não foi possível lê-los ou validá-los. `
            + (chave === "contas" ? "A referência do saldo deve ser válida e não posterior a hoje. " : "")
            + "O conteúdo armazenado não foi alterado. As gravações desta coleção estão bloqueadas nesta sessão.", "erro");
        return [];
    }
}

function persistirColecao(chave, registros) {
    if (colecoesBloqueadas.has(chave)) {
        mostrarToast(`Não é possível salvar ${chave}: os dados estão indisponíveis e a coleção está bloqueada. `
            + "O conteúdo armazenado não foi alterado.", "erro");
        return false;
    }
    const validarRegistro = chave === "contas" ? validarConta
        : chave === "transacoes" ? validarTransacao
        : chave === "investimentos" ? validarInvestimento : null;
    if (!validarRegistro || !validarColecao(registros, validarRegistro)) {
        mostrarToast("Não foi possível salvar: a coleção contém dados incompatíveis com o modelo atual. "
            + "A alteração não foi confirmada e os dados anteriores foram preservados.", "erro");
        return false;
    }
    if (chave === "transacoes" || chave === "investimentos") {
        const candidatos = chave === "transacoes" ? registros : transacoes;
        const investimentosCandidatos = chave === "investimentos" ? registros : investimentos;
        const dependenciasBloqueadas = chave === "investimentos" && colecoesBloqueadas.has("transacoes")
            || chave === "transacoes" && colecoesBloqueadas.has("contas")
            || candidatos.some(ehMovimentacaoInvestimento) && colecoesBloqueadas.has("investimentos");
        if (dependenciasBloqueadas) {
            mostrarToast("Não foi possível confirmar os vínculos e o capital: uma coleção necessária está indisponível. A alteração não foi confirmada.", "erro");
            return false;
        }
        const integridade = verificarIntegridadeTransacoes(candidatos, contas, investimentosCandidatos);
        if (!integridade.disponivel) {
            mostrarToast(`Não foi possível salvar: ${integridade.motivo} A alteração não foi confirmada.`, "erro");
            return false;
        }
    }
    try {
        localStorage.setItem(chave, JSON.stringify(registros));
        return true;
    } catch (erro) {
        mostrarToast(`Não foi possível salvar ${chave}. A alteração não foi confirmada. `
            + "Os dados anteriores e os campos preenchidos foram mantidos. Tente novamente.", "erro");
        return false;
    }
}

function mostrarErro(campo, mensagem) {
    const erro = document.getElementById(`erro-${campo.id}`);

    erro.textContent = mensagem;
    campo.classList.add("invalido");
    campo.setAttribute("aria-invalid", "true");
}
function limparErros(formulario) {
    formulario.querySelectorAll(".erro-campo").forEach((erro) => {
        erro.textContent = "";
    });

    formulario.querySelectorAll(".invalido").forEach((campo) => {
        campo.classList.remove("invalido");
        campo.removeAttribute("aria-invalid");
    });
}
function limparErroCampo(campo) {
    const erro = document.getElementById(`erro-${campo.id}`);

    erro.textContent = "";
    campo.classList.remove("invalido");
    campo.removeAttribute("aria-invalid");
}

function focarPrimeiroErro(formulario) {
    formulario.querySelector(".invalido").focus();
}

function podeReceberFoco(elemento) {
    // A barra pode continuar visualmente presente durante a animação de saída.
    const area = elemento && elemento.closest(".area-acoes");
    if (area && !area.classList.contains("ativa")) return false;
    return elemento && elemento !== document.body && elemento.isConnected && !elemento.matches(":disabled")
        && !elemento.closest("[inert]") && elemento.getClientRects().length > 0
        && getComputedStyle(elemento).visibility !== "hidden";
}

function abrirModal(modal, focoInicial) {
    focoAnteriorModal = document.activeElement;
    modalAtivo = modal;
    modal.classList.remove("hidden");
    modal.querySelector('[role="dialog"]').appendChild(areaNotificacoes);

    // Inativa apenas irmãos no caminho até o body, nunca um ancestral do modal.
    let elemento = modal;
    while (elemento !== document.body) {
        for (const irmao of elemento.parentElement.children) {
            if (irmao !== elemento) {
                elementosInertes.push({ elemento: irmao, inert: irmao.inert });
                irmao.inert = true;
            }
        }
        elemento = elemento.parentElement;
    }
    focoInicial.focus();
}

function fecharModal(modal) {
    modal.classList.add("hidden");
    for (const estado of elementosInertes) {
        estado.elemento.inert = estado.inert;
    }
    elementosInertes = [];
    modalAtivo = null;
    document.body.appendChild(areaNotificacoes);

    const destino = podeReceberFoco(focoAnteriorModal) ? focoAnteriorModal
        : document.getElementById("pagina-transacoes").classList.contains("ativa") ? campoPesquisa
        : document.getElementById("pagina-contas").classList.contains("ativa") ? botaoNovaConta
        : document.getElementById("pagina-investimentos").classList.contains("ativa") ? document.getElementById("novo-investimento")
        : addReceita;
    destino.focus();
    focoAnteriorModal = null;
}
const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});

function formatarCentavos(centavos) {
    if (!Number.isSafeInteger(centavos)) return "Indisponível";
    // Evita perder o último centavo ao dividir totais elevados por 100 como Number.
    const inteiro = BigInt(centavos);
    const fracao = String(inteiro < 0n ? -(inteiro % 100n) : inteiro % 100n).padStart(2, "0");
    const partes = formatadorMoeda.formatToParts(inteiro / 100n);
    const texto = partes.map((parte) => parte.type === "fraction" ? fracao : parte.value).join("");
    return inteiro < 0n && inteiro > -100n ? `-${texto}` : texto;
}

function renderizarTransacoes(tabelaDestino, limite=null, pesquisa="", tipo="todos", categoria="todas", dataInicial="", dataFinal="") {
    tabelaDestino.innerHTML = "";
    
    const transacoesOrdenadas = transacoes.toSorted((a, b) => {
        return b.data.localeCompare(a.data);
    });
    const transacoesFiltradas = transacoesOrdenadas.filter((transacao) => {
        const investimento = ehMovimentacaoInvestimento(transacao) && !colecoesBloqueadas.has("investimentos")
            ? investimentos.find((item) => item.id === transacao.investimentoId) : null;
        const correspondePesquisa = transacao.nome
            .toLowerCase()
            .includes(pesquisa.toLowerCase())
            || (investimento?.nome ?? "").toLowerCase().includes(pesquisa.toLowerCase());

        const correspondeTipo = tipo === "todos" || transacao.tipo === tipo;
        const categoriaTransacao = ehMovimentacaoInvestimento(transacao) ? "" : transacao.categoria;
        const correspondeCategoria = categoria === "todas" || categoriaTransacao.trim() === categoria.trim();
        const correspondeDataInicial = !dataInicial || transacao.data >= dataInicial;
        const correspondeDataFinal = !dataFinal || transacao.data <= dataFinal;

        return correspondePesquisa && correspondeTipo && correspondeCategoria && correspondeDataInicial && correspondeDataFinal;;
    });

    let transacoesExibidas;

    if (tabelaDestino === listaTransacoesCompleta) {
        const totalPaginas = Math.max(
            1,
            Math.ceil(transacoesFiltradas.length / transacoesPorPagina)
        );

        // Impede que a página atual ultrapasse a última disponível
        paginaAtual = Math.min(paginaAtual, totalPaginas);

        const inicio = (paginaAtual - 1) * transacoesPorPagina;
        const fim = inicio + transacoesPorPagina;

        transacoesExibidas = transacoesFiltradas.slice(inicio, fim);

        // Atualiza os controles
        infoPaginacao.textContent = `Página ${paginaAtual} de ${totalPaginas}`;

        botaoPaginaAnterior.disabled = paginaAtual === 1;
        botaoProximaPagina.disabled = paginaAtual === totalPaginas;

    } else {
        transacoesExibidas = limite === null
            ? transacoesFiltradas
            : transacoesFiltradas.slice(0, limite);
    }

    if (transacoesExibidas.length === 0) {
        const linha = document.createElement("tr");
        const celula = document.createElement("td");

        celula.colSpan = 8;
        celula.textContent = colecoesBloqueadas.has("transacoes")
            ? "Dados de transações indisponíveis. Gravações bloqueadas nesta sessão."
            : "Nenhuma transação encontrada.";
        celula.classList.add("mensagem-sem-resultados");

        linha.appendChild(celula);
        tabelaDestino.appendChild(linha);

        return;
    }

    transacoesExibidas.forEach((transacao) => {
        const linha = document.createElement("tr");
        
        const celulaSelecao = document.createElement("td");
        celulaSelecao.classList.add("coluna-selecao");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add("checkbox-transacao");
        checkbox.value = transacao.id;
        checkbox.setAttribute("aria-label", `Selecionar ${transacao.nome}`);
        checkbox.checked = transacoesSelecionadas.includes(transacao.id);

        celulaSelecao.appendChild(checkbox);
        linha.appendChild(celulaSelecao);

        checkbox.addEventListener("change", () => {
            const id = checkbox.value;
            if (checkbox.checked) {
                if (!transacoesSelecionadas.includes(id)) {
                    transacoesSelecionadas.push(id);
                }
            } else {
                transacoesSelecionadas = transacoesSelecionadas.filter((idSelecionado) => {
                    return idSelecionado !== id;
                });   
            }
            sincronizarCheckboxes();
            atualizarBarraAcoes();
        });

        const celulaNome = document.createElement("td");
        const tipoMovimento = transacao.tipo === "aporte" ? "Aporte" : transacao.tipo === "resgate" ? "Resgate" : "";
        const investimento = ehMovimentacaoInvestimento(transacao)
            ? investimentos.find((item) => item.id === transacao.investimentoId) : null;
        celulaNome.textContent = tipoMovimento
            ? transacao.nome === `${tipoMovimento} - ${investimento?.nome}`
                ? `${tipoMovimento} · ${investimento.nome}`
                : `${tipoMovimento} · ${transacao.nome} (${investimento?.nome ?? "Investimento indisponível"})`
            : transacao.nome;
        linha.appendChild(celulaNome);
        
        const celulaCategoria = document.createElement("td");
        celulaCategoria.textContent = ehMovimentacaoInvestimento(transacao) ? "-" : transacao.categoria;
        linha.appendChild(celulaCategoria);

        const celulaData = document.createElement("td");
        const [ano, mes, dia] = transacao.data.split("-");
        const dataFormatada = `${dia}/${mes}/${ano}`;
        celulaData.textContent = dataFormatada;
        linha.appendChild(celulaData);

        const celulaPagamento = document.createElement("td");
        celulaPagamento.textContent = ehMovimentacaoInvestimento(transacao) ? "-" : transacao.pagamento || "-";
        linha.appendChild(celulaPagamento);
        
        const celulaClassificacao = document.createElement("td");
        celulaClassificacao.textContent = ehMovimentacaoInvestimento(transacao) ? "-" : transacao.classificacao || "-";
        linha.appendChild(celulaClassificacao);

        const celulaConta = document.createElement("td");
        const conta = contas.find((conta) => conta.id === transacao.contaId);
        celulaConta.textContent = conta ? conta.nome : "Conta indisponível";
        linha.appendChild(celulaConta);

        const celulaValor = document.createElement("td");
        const sinal = movimentoBancarioCentavos(transacao) < 0 ? "-" : "+";
        celulaValor.textContent = `${sinal}${formatadorMoeda.format(transacao.valor)}`;
        celulaValor.classList.add(transacao.tipo);
        linha.appendChild(celulaValor);



        tabelaDestino.appendChild(linha);
    })
}

function calcularTotaisResumo(registros) {
    if (!validarColecao(registros, validarTransacao)) return { receitasCentavos: null, despesasCentavos: null };
    const totais = { receitasCentavos: 0, despesasCentavos: 0 };
    for (const transacao of registros) {
        if (transacao.tipo !== "receita" && transacao.tipo !== "despesa") continue;
        const campo = transacao.tipo === "receita" ? "receitasCentavos" : "despesasCentavos";
        if (totais[campo] === null) continue;
        const valor = converterParaCentavos(transacao.valor);
        const total = totais[campo] + valor;
        totais[campo] = Number.isSafeInteger(valor) && Number.isSafeInteger(total) ? total : null;
    }
    return totais;
}

function atualizarResumo() {
    atualizarVisualizacoesSaldos();
    atualizarGraficosHistorico();
    atualizarDistribuicaoDespesas();
    if (colecoesBloqueadas.has("transacoes")) {
        [valorRecebido, valorDespesas].forEach((campo) => {
            campo.textContent = "Indisponível";
        });
        return;
    }
    const { receitasCentavos, despesasCentavos } = calcularTotaisResumo(transacoes);
    valorRecebido.textContent = formatarCentavos(receitasCentavos);
    valorDespesas.textContent = formatarCentavos(despesasCentavos);
}

function sincronizarCheckboxes() {
    document.querySelectorAll(".checkbox-transacao").forEach((checkbox) => {
        checkbox.checked = transacoesSelecionadas.includes(checkbox.value);
    });
}

function limparSelecao() {
    transacoesSelecionadas = [];
    sincronizarCheckboxes();
    atualizarBarraAcoes();
}

function atualizarBarraAcoes() {
    const quantidade = transacoesSelecionadas.length;

    const texto = `${quantidade} ${quantidade === 1
        ? "transação selecionada"
        : "transações selecionadas"}`;

    // Barra do Resumo
    quantidadeSelecionadas.textContent = texto;
    areaAcoes.classList.toggle("ativa", quantidade > 0);
    botaoEditar.disabled = quantidade !== 1;

    // Barra da página Transações
    quantidadeSelecionadasCompleta.textContent = texto;
    areaAcoesCompleta.classList.toggle("ativa", quantidade > 0);
    botaoEditarCompleta.disabled = quantidade !== 1;
}

function preencherFormulario(transacao) {
    formTransacao.elements.namedItem("nome").value = transacao.nome;
    formTransacao.elements.namedItem("valor").value = transacao.valor;
    formTransacao.elements.namedItem("categoria").value = transacao.categoria;
    formTransacao.elements.namedItem("conta").value = transacao.contaId;
    formTransacao.elements.namedItem("data").value = transacao.data;

    formTransacao.elements.namedItem("pagamento").value = transacao.pagamento ?? "";
    formTransacao.elements.namedItem("classificacao").value = transacao.classificacao ?? "";
}

function fecharModalTransacao() {
    fecharModal(modalOverlay);
    formTransacao.reset();
    limparErros(formTransacao);
    transacaoEmEdicao = null;
}

function navegarPara(paginaDestino) {
    const paginaSelecionada = document.getElementById(
        `pagina-${paginaDestino}`
    );

    if (!paginaSelecionada) return;

    if (!paginaSelecionada.classList.contains("ativa")) {
        limparSelecao();
    }

    paginas.forEach((pagina) => {
        pagina.classList.remove("ativa");
    });

    paginaSelecionada.classList.add("ativa");

    linksNavegacao.forEach((link) => {
        const linkAtivo = link.dataset.pagina === paginaDestino;

        link.classList.toggle("ativo", linkAtivo);
    });
    if (paginaDestino === "analises" || paginaDestino === "resumo") atualizarGraficosHistorico();
    if (paginaDestino === "analises") atualizarDistribuicaoDespesas();
    if (paginaDestino === "investimentos") renderizarInvestimentos();
}

function atualizarTabelaCompleta() {
    const pesquisa = campoPesquisa.value.trim().toLowerCase();
    const tipo = filtroTipo.value;
    const categoria = filtroCategoria.value;
    const dataInicial = filtroDataInicial.value;
    const dataFinal = filtroDataFinal.value;
    const intervaloInvalido = Boolean(dataInicial && dataFinal && dataInicial > dataFinal);
    erroFiltroDatas.textContent = intervaloInvalido
        ? "A data inicial deve ser anterior ou igual à data final." : "";
    [filtroDataInicial, filtroDataFinal].forEach((campo) => {
        campo.classList.toggle("invalido", intervaloInvalido);
        if (intervaloInvalido) {
            campo.setAttribute("aria-invalid", "true");
        } else {
            campo.removeAttribute("aria-invalid");
        }
    });

    renderizarTransacoes(listaTransacoesCompleta, null, pesquisa, tipo, categoria, dataInicial, dataFinal);
}

function atualizarCategorias() {
    const categoriaAtual = filtroCategoria.value;

    const categorias = [...new Set(
        transacoes.filter((transacao) => !ehMovimentacaoInvestimento(transacao))
            .map((transacao) => transacao.categoria.trim())
    )].sort();

    filtroCategoria.innerHTML = '<option value="todas">Todas as categorias</option>';

    categorias.forEach((categoria) => {
        const option = document.createElement("option");

        option.value = categoria;
        option.textContent = categoria;

        filtroCategoria.appendChild(option);
    });

    filtroCategoria.value = categorias.includes(categoriaAtual)
        ? categoriaAtual
        : "todas";
}

function aplicarFiltros() {
    limparSelecao();
    paginaAtual = 1;
    atualizarTabelaCompleta();
}

function abrirModalConta(contaId = null) {
    const conta = contaId === null ? null : contas.find((registro) => registro.id === contaId);
    if (contaId !== null && !conta) {
        mostrarToast("Não foi possível editar: a conta não está disponível.", "erro");
        return;
    }
    formConta.reset();
    limparErros(formConta);
    contaEmEdicao = conta ? conta.id : null;
    tituloModalConta.textContent = conta ? "Editar Conta" : "Adicionar Conta";
    botaoSalvarConta.textContent = conta ? "Salvar alterações" : "Salvar Conta";
    campoNomeConta.value = conta ? conta.nome : "";
    campoTipoConta.value = conta ? conta.tipo : "";
    campoInstituicaoConta.value = conta ? conta.instituicao ?? "" : "";
    campoSaldoInicial.value = conta ? conta.saldoInicial : "";
    campoDataReferencia.max = obterDataLocal();
    campoDataReferencia.value = conta ? conta.dataReferencia : obterDataLocal();
    campoIncluirNoSaldoDisponivel.checked = conta ? conta.incluirNoSaldoDisponivel : true;
    // Na edição, a opção salva prevalece sobre sugestões baseadas no tipo.
    inclusaoSaldoAlterada = Boolean(conta);
    abrirModal(modalConta, campoNomeConta);
}

function atualizarOpcoesContas() {
    const contaAtual = campoConta.value;
    campoConta.innerHTML = '<option value="">Selecione uma conta...</option>';
    if (colecoesBloqueadas.has("contas")) return;
    contas.forEach((conta) => {
        const option = document.createElement("option");
        option.value = conta.id;
        option.textContent = conta.nome;
        campoConta.appendChild(option);
    });
    campoConta.value = contas.some((conta) => conta.id === contaAtual) ? contaAtual : "";
}

function prepararContasTransacao() {
    if (colecoesBloqueadas.has("transacoes") || colecoesBloqueadas.has("contas")) {
        mostrarToast("Não é possível abrir o formulário: os dados de contas ou transações estão indisponíveis. "
            + "Os dados armazenados foram preservados.", "erro");
        return false;
    }
    if (contas.length === 0) {
        mostrarToast("É necessário cadastrar uma conta antes de criar transações. "
            + "Cadastre a primeira conta na página Contas.", "informacao");
        return false;
    }
    atualizarOpcoesContas();
    return true;
}

function fecharModalConta() {
    fecharModal(modalConta);
    formConta.reset();
    limparErros(formConta);
    contaEmEdicao = null;
    inclusaoSaldoAlterada = false;
}

function podeExcluirConta(contaId) {
    if (colecoesBloqueadas.has("contas") || colecoesBloqueadas.has("transacoes")) {
        mostrarToast("Não é possível excluir a conta: os dados de contas ou transações estão indisponíveis. "
            + "Não foi possível confirmar a ausência de vínculos.", "erro");
        return false;
    }
    if (!contas.some((conta) => conta.id === contaId)) {
        mostrarToast("Não foi possível excluir: a conta não está disponível.", "erro");
        return false;
    }
    if (transacoes.some((transacao) => transacao.contaId === contaId)) {
        mostrarToast("Esta conta possui transações vinculadas e não pode ser excluída, "
            + "mesmo que sejam históricas. Nenhuma transação foi alterada.", "erro");
        return false;
    }
    return true;
}

function solicitarExclusaoConta(contaId) {
    if (!podeExcluirConta(contaId)) return;
    const conta = contas.find((registro) => registro.id === contaId);
    contaEmExclusao = conta.id;
    mensagemExclusaoConta.textContent = `Deseja excluir a conta "${conta.nome}"? Esta ação não poderá ser desfeita.`;
    abrirModal(modalExclusaoConta, botaoCancelarExclusaoConta);
}

function fecharModalExclusaoConta() {
    fecharModal(modalExclusaoConta);
    contaEmExclusao = null;
}

function renderizarContas(saldos) {
    listaContas.innerHTML = "";

    if (colecoesBloqueadas.has("contas")) {
        const mensagem = document.createElement("p");
        mensagem.classList.add("mensagem-vazia");
        mensagem.textContent = "Dados de contas indisponíveis. Gravações bloqueadas nesta sessão.";
        listaContas.appendChild(mensagem);
        return;
    }

    if (!saldos.disponivel) {
        const mensagem = document.createElement("p");
        mensagem.classList.add("mensagem-vazia");
        mensagem.textContent = `Saldos indisponíveis. ${saldos.motivo}`;
        listaContas.appendChild(mensagem);
    }

    if (contas.length === 0) {
        if (!saldos.disponivel) return;
        listaContas.innerHTML = `
            <p class="mensagem-vazia">
                Nenhuma conta cadastrada.
            </p>
        `;
        return;
    }

    contas.forEach((conta) => {
        const item = document.createElement("div");
        item.classList.add("item-conta");

        const nome = document.createElement("h3");
        nome.textContent = conta.nome;

        const detalhes = document.createElement("p");

        const tipos = {
            corrente: "Conta corrente",
            poupanca: "Poupança",
            reserva: "Reserva",
            carteira: "Carteira física"
        };

        detalhes.textContent = [
            conta.instituicao,
            tipos[conta.tipo] || conta.tipo
        ].filter(Boolean).join(" · ");

        const saldo = document.createElement("strong");
        saldo.textContent = saldos.disponivel
            ? formatarCentavos(saldos.saldosPorContaCentavos.get(conta.id))
            : "Saldo indisponível";

        const acoes = document.createElement("div");
        acoes.classList.add("acoes-conta");
        const editar = document.createElement("button");
        editar.type = "button";
        editar.textContent = "Editar";
        editar.setAttribute("aria-label", `Editar conta ${conta.nome}`);
        editar.addEventListener("click", () => abrirModalConta(conta.id));
        const excluir = document.createElement("button");
        excluir.type = "button";
        excluir.classList.add("btn-excluir");
        excluir.textContent = "Excluir";
        excluir.setAttribute("aria-label", `Excluir conta ${conta.nome}`);
        excluir.addEventListener("click", () => solicitarExclusaoConta(conta.id));
        acoes.append(editar, excluir);
        item.append(nome, detalhes, saldo, acoes);
        listaContas.appendChild(item);
    });
}
// Compartilha um único cálculo sobre as coleções completas entre as páginas.
function atualizarVisualizacoesSaldos() {
    const saldos = obterSaldosContas();
    saldoTotalContas.textContent = saldos.disponivel
        ? formatarCentavos(saldos.saldoTotalCentavos) : "Indisponível";
    valorSaldo.textContent = saldos.disponivel
        ? formatarCentavos(saldos.saldoDisponivelCentavos) : "Indisponível";
    renderizarContas(saldos);
    renderizarContasResumo(saldos);
}

function renderizarContasResumo(saldos) {
    const lista = document.getElementById("contas-resumo");
    lista.replaceChildren();
    if (!saldos.disponivel || contas.length === 0) {
        const mensagem = document.createElement("p");
        mensagem.classList.add("mensagem-vazia");
        mensagem.textContent = !saldos.disponivel
            ? `Dados de saldo indisponíveis. ${saldos.motivo}`
            : "Cadastre sua primeira conta para acompanhar seus saldos.";
        lista.appendChild(mensagem);
        if (saldos.disponivel) {
            const cadastrar = document.createElement("button");
            cadastrar.type = "button";
            cadastrar.textContent = "Cadastrar primeira conta";
            cadastrar.addEventListener("click", () => abrirModalConta());
            lista.appendChild(cadastrar);
        }
        return;
    }
    const itens = document.createElement("ul");
    itens.classList.add("lista-contas-resumo");
    contas.slice(0, 3).forEach((conta) => {
        const item = document.createElement("li");
        const nome = document.createElement("span");
        nome.textContent = conta.nome;
        const saldo = document.createElement("strong");
        saldo.textContent = formatarCentavos(saldos.saldosPorContaCentavos.get(conta.id));
        item.append(nome, saldo);
        itens.appendChild(item);
    });
    lista.appendChild(itens);
}

// eventos links de navegação
linksNavegacao.forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();

        const paginaDestino = link.dataset.pagina;

        navegarPara(paginaDestino);
    });
});

// evento modal de conta
botaoNovaConta.addEventListener("click", () => abrirModalConta());

botaoFecharConta.addEventListener("click", fecharModalConta);

botaoCancelarConta.addEventListener("click", fecharModalConta);
campoTipoConta.addEventListener("change", () => {
    // A sugestão por tipo não substitui uma escolha manual durante o cadastro.
    if (!inclusaoSaldoAlterada) {
        campoIncluirNoSaldoDisponivel.checked = campoTipoConta.value !== "reserva";
    }
});
campoIncluirNoSaldoDisponivel.addEventListener("change", () => {
    inclusaoSaldoAlterada = true;
});

formConta.addEventListener("submit", (evento) => {
    evento.preventDefault();
    limparErros(formConta);

    const nome = campoNomeConta.value.trim();
    const tipo = campoTipoConta.value;
    const instituicao = campoInstituicaoConta.value.trim();
    const valorInformado = campoSaldoInicial.value;
    const saldoInicial = Number(valorInformado);
    const dataReferencia = campoDataReferencia.value;
    const incluirNoSaldoDisponivel = campoIncluirNoSaldoDisponivel.checked;

    let formularioValido = true;
    if (!nome) {
        mostrarErro(campoNomeConta, "Informe o nome da conta.");
        formularioValido = false;
    }
    if (!tipo) {
        mostrarErro(campoTipoConta, "Selecione um tipo de conta.");
        formularioValido = false;
    }
    if (valorInformado === "" || !valorMonetarioValido(valorInformado)
        || !campoSaldoInicial.validity.valid) {
        mostrarErro(campoSaldoInicial, "Informe um saldo não negativo, em centavos e dentro do limite seguro.");
        formularioValido = false;
    }
    if (!dataValida(dataReferencia) || dataReferencia > obterDataLocal() || !campoDataReferencia.validity.valid) {
        mostrarErro(campoDataReferencia, "Informe uma data válida, igual ou anterior a hoje.");
        formularioValido = false;
    }
    if (!formularioValido) {
        focarPrimeiroErro(formConta);
        return;
    }

    const estavaEditando = contaEmEdicao !== null;
    const contaExistente = estavaEditando ? contas.find((conta) => conta.id === contaEmEdicao) : null;
    if (estavaEditando && !contaExistente) {
        mostrarToast("Não foi possível salvar: a conta em edição não está disponível.", "erro");
        return;
    }
    const contaAtualizada = {
        ...contaExistente,
        id: estavaEditando ? contaExistente.id : crypto.randomUUID(),
        nome: nome,
        tipo: tipo,
        instituicao: instituicao,
        saldoInicial: saldoInicial,
        dataReferencia,
        incluirNoSaldoDisponivel
    };

    const proximasContas = estavaEditando
        ? contas.map((conta) => conta.id === contaEmEdicao ? contaAtualizada : conta)
        : [...contas, contaAtualizada];
    if (!persistirColecao("contas", proximasContas)) return;
    contas = proximasContas;
    atualizarOpcoesContas();
    atualizarVisualizacoesSaldos();
    // O nome exibido muda; os vínculos e a seleção continuam baseados nos IDs.
    renderizarTransacoes(listaTransacoes, 5);
    atualizarTabelaCompleta();

    fecharModalConta();
    mostrarToast(estavaEditando ? "Conta atualizada." : "Conta criada.", "sucesso");
});

botaoCancelarExclusaoConta.addEventListener("click", fecharModalExclusaoConta);
modalExclusaoConta.addEventListener("click", (evento) => {
    if (evento.target === modalExclusaoConta) fecharModalExclusaoConta();
});
botaoConfirmarExclusaoConta.addEventListener("click", () => {
    if (contaEmExclusao === null || !podeExcluirConta(contaEmExclusao)) return;
    const proximasContas = contas.filter((conta) => conta.id !== contaEmExclusao);
    if (!persistirColecao("contas", proximasContas)) return;
    contas = proximasContas;
    atualizarOpcoesContas();
    atualizarVisualizacoesSaldos();
    fecharModalExclusaoConta();
    mostrarToast("Conta excluída.", "sucesso");
});

// evento campo de pesquisa
campoPesquisa.addEventListener("input", aplicarFiltros); 
filtroTipo.addEventListener("change", aplicarFiltros);
filtroCategoria.addEventListener("change", aplicarFiltros);
filtroDataInicial.addEventListener("change", aplicarFiltros);
filtroDataFinal.addEventListener("change", aplicarFiltros);

botaoLimparFiltros.addEventListener("click", () => {
    campoPesquisa.value = "";
    filtroTipo.value = "todos";
    filtroCategoria.value = "todas";

    filtroDataInicial.value = "";
    filtroDataFinal.value = "";
    aplicarFiltros();
});

botaoPaginaAnterior.addEventListener("click", () => {
    if (paginaAtual <= 1) return;

    paginaAtual--;
    limparSelecao();
    atualizarTabelaCompleta();
});

botaoProximaPagina.addEventListener("click", () => {
    if (botaoProximaPagina.disabled) return;

    paginaAtual++;
    limparSelecao();
    atualizarTabelaCompleta();
});

// limpar os erros quando o usuario digitar algo nos campos do formulario
const camposFormulario = [
    campoNome,
    campoValor,
    campoCategoria,
    campoData,
    campoConta,
    campoNomeConta,
    campoTipoConta,
    campoSaldoInicial,
    campoDataReferencia
];

camposFormulario.forEach((campo) => {
    campo.addEventListener("input", () => {
        limparErroCampo(campo);
    });
});
[botaoExcluir, botaoExcluirCompleta].forEach((botao) => { 
    botao.addEventListener("click", () => {
        const quantidade = transacoesSelecionadas.length;

        if (quantidade === 0) return;

        mensagemExclusao.textContent =
            `Deseja realmente excluir ${quantidade} ${quantidade === 1 ? "transação" : "transações"}? Esta ação não poderá ser desfeita.`;

        abrirModal(modalExclusao, botaoCancelarExclusao);
    });
});

botaoCancelarExclusao.addEventListener("click", () => {
    fecharModal(modalExclusao);
});

botaoConfirmarExclusao.addEventListener("click", () => {
    const quantidade = transacoesSelecionadas.length;
const transacoesRestantes = transacoes.filter((transacao) => {
    return !transacoesSelecionadas.includes(transacao.id);
});

    if (!persistirColecao("transacoes", transacoesRestantes)) return;
    transacoes = transacoesRestantes;

    transacoesSelecionadas = [];

    renderizarTransacoes(listaTransacoes, 5);
    atualizarCategorias();
    atualizarTabelaCompleta();
    atualizarResumo();
    atualizarBarraAcoes();

    fecharModal(modalExclusao);
    renderizarInvestimentos();
    mostrarToast(quantidade === 1 ? "Transação excluída." : `${quantidade} transações excluídas.`, "sucesso");
});
[botaoEditar, botaoEditarCompleta].forEach((botao) => {
    botao.addEventListener("click", () => {
        if (transacoesSelecionadas.length !== 1) return;

        const id = transacoesSelecionadas[0];

        const transacao = transacoes.find((transacao) => {
            return transacao.id === id;
        });

        if (!transacao) return;
        if (ehMovimentacaoInvestimento(transacao)) {
            abrirModalMovimentacao(transacao.tipo, transacao.investimentoId, transacao.id);
            return;
        }
        if (!prepararContasTransacao()) return;

        limparErros(formTransacao);
        transacaoEmEdicao = transacao.id;
        tipoTransacao = transacao.tipo;

        preencherFormulario(transacao);

        modalTitle.textContent =
            transacao.tipo === "receita" ? "Editar Receita" : "Editar Despesa";

        botaoSalvarTransacao.textContent = "Salvar Alterações";

        if (transacao.tipo === "receita") {
            campoClassificacao.classList.add("hidden");
            campoPagamento.classList.add("hidden");
        } else {
            campoClassificacao.classList.remove("hidden");
            campoPagamento.classList.remove("hidden");
        }

        abrirModal(modalOverlay, campoNome);
        });
    });

// fechar o modal de exclusao ao clicar fora dele ou botao esc
modalExclusao.addEventListener("click", (event) => {
    if (event.target === modalExclusao) {
        fecharModal(modalExclusao);
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modalExclusao.classList.contains("hidden")) {
        fecharModal(modalExclusao);
    }
    if (event.key === "Escape" && modalAtivo === modalExclusaoConta) {
        fecharModalExclusaoConta();
    }
    if (event.key === "Escape" && modalAtivo === document.getElementById("modal-exclusao-investimento")) {
        fecharExclusaoInvestimento();
    }
    if (event.key === "Tab" && modalAtivo) {
        const campos = [...modalAtivo.querySelectorAll(
            'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        )].filter(podeReceberFoco);
        const primeiro = campos[0];
        const ultimo = campos[campos.length - 1];
        if (!primeiro) {
            event.preventDefault();
            modalAtivo.querySelector('[role="dialog"]').focus();
        } else if (!campos.includes(document.activeElement)
            || (event.shiftKey && document.activeElement === primeiro)
            || (!event.shiftKey && document.activeElement === ultimo)) {
            event.preventDefault();
            (event.shiftKey ? ultimo : primeiro).focus();
        }
    }
});

// evento de envio do formulario
formTransacao.addEventListener("submit", (enviar) => { 
    enviar.preventDefault();
    if (!["receita", "despesa"].includes(tipoTransacao)
        || transacoes.some((item) => item.id === transacaoEmEdicao && ehMovimentacaoInvestimento(item))) {
        mostrarToast("Este formulário permite somente receitas e despesas nesta etapa.", "informacao");
        return;
    }
    limparErros(formTransacao);
    const nome = campoNome.value.trim();
    const valor = Number(campoValor.value);
    const categoria = campoCategoria.value.trim();
    const classificacao = selectClassificacao.value;
    const pagamento = selectPagamento.value;
    const contaId = campoConta.value;
    const data = campoData.value;
    
    let formularioValido = true;

    if (nome === "") {
        mostrarErro(campoNome, "Informe o nome da transação.");
        formularioValido = false;
    }
    if (!valorMonetarioValido(campoValor.value) || valor <= 0 || !campoValor.validity.valid) {
        mostrarErro(campoValor, "Informe um valor positivo, em centavos e dentro do limite seguro.");
        formularioValido = false;
    }
    if (categoria.trim() === "") {
        mostrarErro(campoCategoria, "Informe uma categoria.");
        formularioValido = false;
    }

    if (!dataValida(data) || !campoData.validity.valid) {
        mostrarErro(campoData, "Selecione uma data válida.");
        formularioValido = false;
    }

    if (!validarContaTransacao(contaId)) {
        mostrarErro(campoConta, "Selecione uma conta cadastrada e disponível.");
        formularioValido = false;
    }
    if (!formularioValido) {
        focarPrimeiroErro(formTransacao);
        return;
    }

    let proximasTransacoes;
    if (transacaoEmEdicao !== null) {
        const transacaoExistente = transacoes.find((transacao) => {
            return transacao.id === transacaoEmEdicao;
        });

        if (!transacaoExistente) return;
        const transacaoAtualizada = {
            ...transacaoExistente,
            nome,
            valor,
            categoria,
            classificacao: tipoTransacao === "despesa" ? classificacao : null,
            pagamento: tipoTransacao === "despesa" ? pagamento : null,
            contaId,
            data
        };
        proximasTransacoes = transacoes.map((transacao) => {
            return transacao.id === transacaoEmEdicao ? transacaoAtualizada : transacao;
        });
    } else {
    const transacao = {
        id: crypto.randomUUID(),
        tipo: tipoTransacao,
        nome,
        valor,
        categoria,
        classificacao: tipoTransacao === "despesa" ? classificacao : null,
        pagamento: tipoTransacao === "despesa" ? pagamento : null,
        contaId,
        data,
    };
    proximasTransacoes = [...transacoes, transacao];
    }
    
    if (!persistirColecao("transacoes", proximasTransacoes)) return;
    transacoes = proximasTransacoes;
    transacoesSelecionadas = []
    renderizarTransacoes(listaTransacoes, 5);
    atualizarCategorias();
    atualizarTabelaCompleta();
    atualizarResumo();
    atualizarBarraAcoes();

    const estavaEditando = transacaoEmEdicao !== null;
    fecharModalTransacao();
    mostrarToast(estavaEditando ? "Transação atualizada." : "Transação criada.", "sucesso");
});

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
    if (!colecoesBloqueadas.has("investimentos")) return true;
    mostrarToast("Investimentos indisponíveis. As gravações estão bloqueadas e os dados armazenados foram preservados.", "erro");
    return false;
}

function abrirModalInvestimento(id = null) {
    if (!investimentosDisponiveis()) return;
    const investimento = id === null ? null : investimentos.find((item) => item.id === id);
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
    fecharModal(modalInvestimento);
    formInvestimento.reset();
    limparErros(formInvestimento);
    investimentoEmEdicao = null;
}

// Ponto único de proteção da exclusão, incluindo movimentos históricos e futuros.
function podeExcluirInvestimento(id) {
    if (!investimentosDisponiveis()) return false;
    if (colecoesBloqueadas.has("transacoes")) {
        mostrarToast("Não é possível excluir o investimento: as transações estão indisponíveis e os vínculos não puderam ser verificados.", "erro");
        return false;
    }
    if (transacoes.some((item) => ehMovimentacaoInvestimento(item) && item.investimentoId === id)) {
        mostrarToast("Este investimento possui aportes ou resgates vinculados e não pode ser excluído, inclusive quando os registros são históricos ou futuros.", "erro");
        return false;
    }
    if (!investimentos.some((item) => item.id === id)) {
        mostrarToast("O investimento não está disponível para exclusão.", "erro");
        return false;
    }
    return true;
}

function solicitarExclusaoInvestimento(id) {
    if (!podeExcluirInvestimento(id)) return;
    investimentoEmExclusao = id;
    const investimento = investimentos.find((item) => item.id === id);
    document.getElementById("mensagem-exclusao-investimento").textContent = `Deseja excluir o investimento "${investimento.nome}"? Esta ação não poderá ser desfeita.`;
    abrirModal(modalExclusaoInvestimento, document.getElementById("cancelar-exclusao-investimento"));
}

function fecharExclusaoInvestimento() {
    fecharModal(modalExclusaoInvestimento);
    investimentoEmExclusao = null;
}

function renderizarInvestimentos() {
    const acompanhamento = obterAcompanhamentoInvestimentos();
    const { capitais, valores: estimativas, totalCapitalCentavos } = acompanhamento;
    document.getElementById("total-capital-investimentos").textContent = totalCapitalCentavos === null
        ? "Indisponível" : formatarCentavos(totalCapitalCentavos);
    document.getElementById("total-valor-investimentos").textContent = estimativas.disponivel
        ? formatarCentavos(estimativas.totalValorCentavos) : "Indisponível";
    renderizarHistoricoInvestimentos();
    const lista = document.getElementById("lista-investimentos");
    lista.replaceChildren();
    if (colecoesBloqueadas.has("investimentos") || investimentos.length === 0) {
        const mensagem = document.createElement("p");
        mensagem.classList.add("mensagem-vazia");
        mensagem.textContent = colecoesBloqueadas.has("investimentos")
            ? "Dados de investimentos indisponíveis. Gravações bloqueadas nesta sessão; o conteúdo armazenado foi preservado."
            : "Nenhum investimento cadastrado. Use Novo investimento para cadastrar o primeiro.";
        lista.appendChild(mensagem);
        return;
    }
    investimentos.forEach((investimento) => {
        const item = document.createElement("article");
        item.classList.add("item-investimento");
        const nome = document.createElement("h3");
        nome.textContent = investimento.nome;
        const detalhes = document.createElement("p");
        detalhes.textContent = [investimento.tipo, investimento.instituicao].filter(Boolean).join(" · ");
        const valores = document.createElement("dl");
        const posicao = estimativas.valoresPorInvestimento?.get(investimento.id);
        const capital = capitais.disponivel ? capitais.capitaisPorInvestimentoCentavos.get(investimento.id) : null;
        [["Capital aplicado", capital], [posicao?.ajustado ? "Valor estimado" : "Valor informado",
            posicao?.disponivel ? posicao.valorCentavos : null]].forEach(([rotulo, valor]) => {
            const grupo = document.createElement("div");
            const termo = document.createElement("dt");
            termo.textContent = rotulo;
            const descricao = document.createElement("dd");
            descricao.textContent = formatarCentavos(valor);
            grupo.append(termo, descricao);
            valores.appendChild(grupo);
        });
        const referencia = document.createElement("p");
        referencia.classList.add("referencia-investimento");
        referencia.textContent = `Último valor informado: ${formatadorMoeda.format(investimento.valorInformado)} em ${formatarDataInvestimento(investimento.dataReferenciaValor)}.`;
        const aviso = document.createElement("p");
        aviso.classList.add("aviso-investimento");
        aviso.textContent = posicao && !posicao.disponivel ? posicao.motivo
            : !capitais.disponivel ? capitais.motivo : "";
        const acoes = document.createElement("div");
        acoes.classList.add("acoes-investimento");
        [["Aporte", (id) => abrirModalMovimentacao("aporte", id)],
            ["Resgate", (id) => abrirModalMovimentacao("resgate", id)],
            ["Atualizar valor", abrirAtualizacaoValor],
            ["Editar", abrirModalInvestimento], ["Excluir", solicitarExclusaoInvestimento]].forEach(([rotulo, acao]) => {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.textContent = rotulo;
            botao.setAttribute("aria-label", `${rotulo} investimento ${investimento.nome}`);
            if (rotulo === "Excluir") botao.classList.add("btn-excluir");
            botao.addEventListener("click", () => acao(investimento.id));
            acoes.appendChild(botao);
        });
        item.append(nome, detalhes, valores, referencia, aviso, acoes);
        lista.appendChild(item);
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
            erro(campo, "Informe um valor não negativo, em centavos e dentro do limite numérico seguro.");
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
    const investimentoAnterior = investimentos.find((item) => item.id === investimentoEmEdicao);
    if (investimentoAnterior && referenciaValor < investimentoAnterior.dataReferenciaValor
        && !document.getElementById("confirmar-retroativo-investimento").checked) {
        erro(campos.referenciaValor, "Confirme abaixo a substituição retroativa e o recálculo das movimentações.");
    }
    if (!valido) { focarPrimeiroErro(formInvestimento); return; }
    const editando = investimentoEmEdicao !== null;
    const anterior = editando ? investimentos.find((item) => item.id === investimentoEmEdicao) : null;
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
    const proximos = editando ? investimentos.map((item) => item.id === anterior.id ? registro : item) : [...investimentos, registro];
    if (!persistirColecao("investimentos", proximos)) return;
    investimentos = proximos;
    renderizarInvestimentos();
    // Resolve os nomes atuais pelos IDs, preservando os registros e o estado da listagem.
    renderizarTransacoes(listaTransacoes, 5);
    atualizarTabelaCompleta();
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
    const proximos = investimentos.filter((item) => item.id !== investimentoEmExclusao);
    if (!persistirColecao("investimentos", proximos)) return;
    investimentos = proximos;
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
    const anterior = investimentos.find((item) => item.id === investimentoEmEdicao);
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
    const investimento = investimentos.find((item) => item.id === id);
    if (!investimento) { mostrarToast("Investimento indisponível para atualização.", "erro"); return; }
    investimentoEmAtualizacao = id;
    formValorInvestimento.reset();
    limparErros(formValorInvestimento);
    document.getElementById("titulo-valor-investimento").textContent = `Atualizar valor · ${investimento.nome}`;
    campoValorManual.value = investimento.valorInformado;
    campoDataValorManual.max = obterDataLocal();
    campoDataValorManual.value = investimento.dataReferenciaValor;
    atualizarAvisoRetroativo(campoDataValorManual, investimento.dataReferenciaValor,
        "aviso-retroativo-manual", "confirmar-retroativo-manual");
    abrirModal(modalValorInvestimento, campoValorManual);
}

function fecharAtualizacaoValor() {
    fecharModal(modalValorInvestimento);
    formValorInvestimento.reset();
    limparErros(formValorInvestimento);
    investimentoEmAtualizacao = null;
}

formValorInvestimento.addEventListener("submit", (evento) => {
    evento.preventDefault();
    limparErros(formValorInvestimento);
    const anterior = investimentos.find((item) => item.id === investimentoEmAtualizacao);
    if (!investimentosDisponiveis() || !anterior) return;
    let valido = true;
    if (campoValorManual.value === "" || !valorMonetarioValido(campoValorManual.value) || !campoValorManual.validity.valid) {
        mostrarErro(campoValorManual, "Informe um valor não negativo, em centavos e dentro do limite seguro.");
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
    const candidatos = investimentos.map((item) => item.id === anterior.id ? atualizado : item);
    if (!persistirColecao("investimentos", candidatos)) return;
    investimentos = candidatos;
    renderizarInvestimentos();
    fecharAtualizacaoValor();
    mostrarToast("Valor informado atualizado. As estimativas foram recalculadas.", "sucesso");
});
campoDataValorManual.addEventListener("input", () => {
    const anterior = investimentos.find((item) => item.id === investimentoEmAtualizacao);
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
    const lista = document.getElementById("historico-investimentos");
    lista.replaceChildren();
    const disponivel = !["investimentos", "transacoes", "contas"].some((chave) => colecoesBloqueadas.has(chave))
        && verificarIntegridadeTransacoes(transacoes, contas, investimentos).disponivel;
    const movimentos = disponivel ? transacoes.filter(ehMovimentacaoInvestimento)
        .slice().sort((a, b) => b.data.localeCompare(a.data)) : [];
    if (!disponivel || !movimentos.length) {
        const mensagem = document.createElement("p");
        mensagem.classList.add("mensagem-vazia");
        mensagem.textContent = disponivel ? "Nenhum aporte ou resgate registrado."
            : "Histórico indisponível: não foi possível validar os dados e seus vínculos.";
        lista.appendChild(mensagem);
        return;
    }
    const itens = document.createElement("ul");
    itens.classList.add("lista-historico-investimentos");
    for (const movimento of movimentos) {
        const item = document.createElement("li");
        const investimento = investimentos.find((registro) => registro.id === movimento.investimentoId);
        const conta = contas.find((registro) => registro.id === movimento.contaId);
        const resgate = movimento.tipo === "resgate";
        const titulo = document.createElement("strong");
        titulo.textContent = `${resgate ? "Resgate" : "Aporte"} · ${investimento.nome}`;
        const contexto = document.createElement("p");
        contexto.textContent = `${formatarDataInvestimento(movimento.data)} · ${conta.nome}${movimento.data > obterDataLocal() ? " · Data futura" : ""}`;
        const valor = document.createElement("p");
        valor.textContent = resgate
            ? `−${formatadorMoeda.format(movimento.valorRetiradoInvestimento)} da posição · Recebido na conta: ${formatadorMoeda.format(movimento.valor)}`
            : `+${formatadorMoeda.format(movimento.valor)} na posição`;
        item.append(titulo, contexto, valor);
        if (resgate) {
            const detalhes = document.createElement("details");
            const resumo = document.createElement("summary");
            resumo.textContent = "Detalhes do resgate";
            const texto = document.createElement("p");
            texto.textContent = `Capital retirado: ${formatadorMoeda.format(movimento.capitalRetirado)} · Valor retirado da posição: ${formatadorMoeda.format(movimento.valorRetiradoInvestimento)}`;
            detalhes.append(resumo, texto);
            item.appendChild(detalhes);
        }
        if (movimento.observacoes) {
            const observacoes = document.createElement("p");
            observacoes.textContent = movimento.observacoes;
            item.appendChild(observacoes);
        }
        itens.appendChild(item);
    }
    lista.appendChild(itens);
}

const modalMovimentacao = document.getElementById("modal-movimentacao");
const formMovimentacao = document.getElementById("form-movimentacao");
const camposMovimentacao = Object.fromEntries(
    ["investimento", "conta", "valor", "capital", "baixa", "data", "observacoes"]
        .map((nome) => [nome, document.getElementById(`${nome}-movimentacao`)]));
let tipoMovimentacao = "aporte";
let movimentacaoEmEdicao = null;

function podeMovimentarInvestimentos() {
    if (["transacoes", "contas", "investimentos"].some((chave) => colecoesBloqueadas.has(chave))) {
        mostrarToast("Não é possível movimentar: contas, investimentos ou transações estão indisponíveis. Os dados armazenados foram preservados.", "erro");
        return false;
    }
    if (!contas.length || !investimentos.length) {
        mostrarToast("Cadastre pelo menos uma conta e um investimento antes de registrar aportes ou resgates.", "informacao");
        return false;
    }
    return true;
}

function abrirModalMovimentacao(tipo, investimentoId = null, id = null) {
    if (!["aporte", "resgate"].includes(tipo) || !podeMovimentarInvestimentos()) return;
    const registro = id === null ? null : transacoes.find((item) => item.id === id && item.tipo === tipo);
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
    for (const [nome, colecao] of [["investimento", investimentos], ["conta", contas]]) {
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
    fecharModal(modalMovimentacao);
    formMovimentacao.reset();
    limparErros(formMovimentacao);
    movimentacaoEmEdicao = null;
}

formMovimentacao.addEventListener("submit", (evento) => {
    evento.preventDefault();
    limparErros(formMovimentacao);
    if (!podeMovimentarInvestimentos()) return;
    const campos = camposMovimentacao;
    let valido = true;
    const erro = (campo, mensagem) => { mostrarErro(campo, mensagem); valido = false; };
    const investimento = investimentos.find((item) => item.id === campos.investimento.value);
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
            erro(campo, "Informe um valor positivo em centavos, dentro do limite permitido.");
        }
    }
    if (!dataValida(campos.data.value) || !campos.data.validity.valid) erro(campos.data, "Selecione uma data válida.");
    if (campos.observacoes.value.length > 500) erro(campos.observacoes, "Use até 500 caracteres.");
    if (!valido) { focarPrimeiroErro(formMovimentacao); return; }
    const anterior = movimentacaoEmEdicao === null ? null
        : transacoes.find((item) => item.id === movimentacaoEmEdicao && item.tipo === tipoMovimentacao);
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
    const candidatos = anterior ? transacoes.map((item) => item.id === anterior.id ? registro : item)
        : [...transacoes, registro];
    // A persistência valida também a sequência futura completa, antes de qualquer confirmação.
    if (!persistirColecao("transacoes", candidatos)) return;
    transacoes = candidatos;
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

document.getElementById("historico-anterior").addEventListener("click", () => {
    const historico = obterHistoricoMensal(blocoHistoricoAnalises);
    if (!historico.disponivel || !historico.temAnterior) return;
    blocoHistoricoAnalises++;
    atualizarGraficosHistorico();
});
document.getElementById("historico-proximo").addEventListener("click", () => {
    if (blocoHistoricoAnalises === 0) return;
    blocoHistoricoAnalises--;
    atualizarGraficosHistorico();
});

const mesAtualDistribuicao = obterDataLocal().slice(0, 7);
document.getElementById("mes-inicial-distribuicao").value = mesAtualDistribuicao;
document.getElementById("mes-final-distribuicao").value = mesAtualDistribuicao;
["periodo-distribuicao", "mes-inicial-distribuicao", "mes-final-distribuicao"].forEach((id) => {
    document.getElementById(id).addEventListener("change", atualizarDistribuicaoDespesas);
});

navegarPara("resumo");
atualizarOpcoesContas();
renderizarTransacoes(listaTransacoes, 5);
atualizarCategorias();
atualizarTabelaCompleta();
atualizarResumo();
atualizarBarraAcoes();

// Usa o dia local atualizado ao retornar à aplicação ou restaurar a página.
window.addEventListener("pageshow", () => {
    renderizarInvestimentos();
    atualizarVisualizacoesSaldos();
    atualizarGraficosHistorico();
    atualizarDistribuicaoDespesas();
});
document.addEventListener("visibilitychange", () => {
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
