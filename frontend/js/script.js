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
let transacoes = carregarColecao("transacoes", validarTransacao);
let contas = carregarColecao("contas", validarConta);
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
const listaContas = document.getElementById("lista-contas");
const saldoTotalContas = document.getElementById("saldo-total-contas");
let modalAtivo = null;
let focoAnteriorModal = null;
let elementosInertes = [];

// botoes para abrir e fechar o modal
addReceita.addEventListener("click", () => {
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

// Isolado para permitir que a conta da transação se torne opcional no futuro.
function validarContaTransacao(conta) {
    return textoPreenchido(conta);
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
    return registro !== null && typeof registro === "object" && !Array.isArray(registro)
        && textoPreenchido(registro.id)
        && ["receita", "despesa"].includes(registro.tipo)
        && textoPreenchido(registro.nome)
        && textoPreenchido(registro.categoria)
        && validarContaTransacao(registro.conta)
        && Number.isFinite(registro.valor) && registro.valor > 0
        && dataValida(registro.data)
        && textoOpcional(registro.pagamento)
        && textoOpcional(registro.classificacao);
}

function validarConta(registro) {
    return registro !== null && typeof registro === "object" && !Array.isArray(registro)
        && textoPreenchido(registro.id)
        && textoPreenchido(registro.nome)
        && ["corrente", "poupanca", "reserva", "carteira"].includes(registro.tipo)
        && Number.isFinite(registro.saldoInicial) && registro.saldoInicial >= 0
        && textoOpcional(registro.instituicao);
}

function carregarColecao(chave, validarRegistro) {
    try {
        const conteudo = localStorage.getItem(chave);
        if (conteudo === null) return [];
        const registros = JSON.parse(conteudo);
        if (!Array.isArray(registros)) throw new Error("O conteúdo não é um array.");
        const ids = new Set();
        for (const registro of registros) {
            if (!validarRegistro(registro) || ids.has(registro.id)) {
                throw new Error("Há registros inválidos ou IDs repetidos.");
            }
            ids.add(registro.id);
        }
        return registros;
    } catch (erro) {
        colecoesBloqueadas.add(chave);
        mostrarToast(`Os dados de ${chave} estão indisponíveis: não foi possível lê-los ou validá-los. `
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
        : addReceita;
    destino.focus();
    focoAnteriorModal = null;
}
const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});

function renderizarTransacoes(tabelaDestino, limite=null, pesquisa="", tipo="todos", categoria="todas", dataInicial="", dataFinal="") {
    tabelaDestino.innerHTML = "";
    
    const transacoesOrdenadas = transacoes.toSorted((a, b) => {
        return b.data.localeCompare(a.data);
    });
    const transacoesFiltradas = transacoesOrdenadas.filter((transacao) => {
        const correspondePesquisa = transacao.nome
            .toLowerCase()
            .includes(pesquisa.toLowerCase());

        const correspondeTipo = tipo === "todos" || transacao.tipo === tipo;
        const correspondeCategoria = categoria === "todas" || transacao.categoria.trim() === categoria.trim();
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
        celulaNome.textContent = transacao.nome;
        linha.appendChild(celulaNome);
        
        const celulaCategoria = document.createElement("td");
        celulaCategoria.textContent = transacao.categoria;
        linha.appendChild(celulaCategoria);

        const celulaData = document.createElement("td");
        const [ano, mes, dia] = transacao.data.split("-");
        const dataFormatada = `${dia}/${mes}/${ano}`;
        celulaData.textContent = dataFormatada;
        linha.appendChild(celulaData);

        const celulaPagamento = document.createElement("td");
        celulaPagamento.textContent = transacao.pagamento || "-";
        linha.appendChild(celulaPagamento);
        
        const celulaClassificacao = document.createElement("td");
        celulaClassificacao.textContent = transacao.classificacao || "-";
        linha.appendChild(celulaClassificacao);

        const celulaConta = document.createElement("td");
        celulaConta.textContent = transacao.conta;
        linha.appendChild(celulaConta);

        const celulaValor = document.createElement("td");
        const sinal = transacao.tipo === "despesa" ? "-" : "+";
        celulaValor.textContent = `${sinal}${formatadorMoeda.format(transacao.valor)}`;
        celulaValor.classList.add(transacao.tipo);
        linha.appendChild(celulaValor);



        tabelaDestino.appendChild(linha);
    })
}

function atualizarResumo() {
    if (colecoesBloqueadas.has("transacoes")) {
        [valorRecebido, valorDespesas, valorSaldo].forEach((campo) => {
            campo.textContent = "Indisponível";
        });
        return;
    }
    const receitas = transacoes.reduce((acumulador, transacao) => {
        if (transacao.tipo === "receita") {
            return acumulador + transacao.valor;
        }
        return acumulador;
    }, 0);

    const despesas = transacoes.reduce((acumulador, transacao) => {
        if (transacao.tipo === "despesa") {
            return acumulador + transacao.valor;
        }
        return acumulador;
    }, 0);

    const saldo = receitas - despesas;

    valorRecebido.textContent = formatadorMoeda.format(receitas);
    valorDespesas.textContent = formatadorMoeda.format(despesas);
    valorSaldo.textContent = formatadorMoeda.format(saldo);
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
    formTransacao.elements.namedItem("conta").value = transacao.conta;
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
        transacoes.map((transacao) => transacao.categoria.trim())
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

function abrirModalConta() {
    formConta.reset();
    limparErros(formConta);
    abrirModal(modalConta, campoNomeConta);
}

function fecharModalConta() {
    fecharModal(modalConta);
    formConta.reset();
    limparErros(formConta);
}

function renderizarContas() {
    listaContas.innerHTML = "";

    if (colecoesBloqueadas.has("contas")) {
        const mensagem = document.createElement("p");
        mensagem.classList.add("mensagem-vazia");
        mensagem.textContent = "Dados de contas indisponíveis. Gravações bloqueadas nesta sessão.";
        listaContas.appendChild(mensagem);
        return;
    }

    if (contas.length === 0) {
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
        saldo.textContent = conta.saldoInicial.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        item.append(nome, detalhes, saldo);
        listaContas.appendChild(item);
    });
}
function atualizarSaldoTotalContas() {
    if (colecoesBloqueadas.has("contas")) {
        saldoTotalContas.textContent = "Indisponível";
        return;
    }
    const total = contas.reduce((soma, conta) => {
        return soma + conta.saldoInicial;
    }, 0);

    saldoTotalContas.textContent = total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
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
botaoNovaConta.addEventListener("click", abrirModalConta);

botaoFecharConta.addEventListener("click", fecharModalConta);

botaoCancelarConta.addEventListener("click", fecharModalConta);
formConta.addEventListener("submit", (evento) => {
    evento.preventDefault();
    limparErros(formConta);

    const nome = campoNomeConta.value.trim();
    const tipo = campoTipoConta.value;
    const instituicao = campoInstituicaoConta.value.trim();
    const valorInformado = campoSaldoInicial.value;
    const saldoInicial = Number(valorInformado);

    let formularioValido = true;
    if (!nome) {
        mostrarErro(campoNomeConta, "Informe o nome da conta.");
        formularioValido = false;
    }
    if (!tipo) {
        mostrarErro(campoTipoConta, "Selecione um tipo de conta.");
        formularioValido = false;
    }
    if (valorInformado === "" || !Number.isFinite(saldoInicial) || saldoInicial < 0
        || !campoSaldoInicial.validity.valid) {
        mostrarErro(campoSaldoInicial, "Informe um saldo igual ou maior que zero, em centavos.");
        formularioValido = false;
    }
    if (!formularioValido) {
        focarPrimeiroErro(formConta);
        return;
    }

    const novaConta = {
        id: crypto.randomUUID(),
        nome: nome,
        tipo: tipo,
        instituicao: instituicao,
        saldoInicial: saldoInicial
    };

    const proximasContas = [...contas, novaConta];
    if (!persistirColecao("contas", proximasContas)) return;
    contas = proximasContas;
    renderizarContas();
    atualizarSaldoTotalContas();

    fecharModalConta();
    mostrarToast("Conta criada.", "sucesso");
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
    campoSaldoInicial
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
    limparErros(formTransacao);
    const nome = campoNome.value.trim();
    const valor = Number(campoValor.value);
    const categoria = campoCategoria.value.trim();
    const classificacao = selectClassificacao.value;
    const pagamento = selectPagamento.value;
    const conta = campoConta.value;
    const data = campoData.value;
    
    let formularioValido = true;

    if (nome === "") {
        mostrarErro(campoNome, "Informe o nome da transação.");
        formularioValido = false;
    }
    if (!Number.isFinite(valor) || valor <= 0 || !campoValor.validity.valid) {
        mostrarErro(campoValor, "Informe um valor de pelo menos R$ 0,01, em centavos.");
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

    if (conta === "") {
        mostrarErro(campoConta, "Selecione uma conta.");
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
            conta,
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
        conta,
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

navegarPara("resumo");
renderizarTransacoes(listaTransacoes, 5);
atualizarCategorias();
atualizarTabelaCompleta();
atualizarResumo();
atualizarBarraAcoes();
renderizarContas();
atualizarSaldoTotalContas();

/* RESETAR OS DADOS DE TESTE

transacoes.length = 0;
localStorage.setItem("transacoes", JSON.stringify(transacoes));
renderizarTransacoes(listaTransacoes, 5);
atualizarTabelaCompleta();

*/

/*OU
localStorage.removeItem("transacoes");
*/
