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
const transacoes = JSON.parse(localStorage.getItem("transacoes")) || [];
const contas = JSON.parse(localStorage.getItem("contas")) || [];
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

// botoes para abrir e fechar o modal
addReceita.addEventListener("click", () => {
    formTransacao.reset();
    transacaoEmEdicao = null;
    modalTitle.textContent = "Adicionar Receita";
    botaoSalvarTransacao.textContent = "Salvar";
    campoClassificacao.classList.add("hidden");
    campoPagamento.classList.add("hidden");
    tipoTransacao = "receita";
    
    modalOverlay.classList.remove("hidden");
});

addDespesa.addEventListener("click", () => {
    formTransacao.reset();
    transacaoEmEdicao = null;
    modalTitle.textContent = "Adicionar Despesa";
    botaoSalvarTransacao.textContent = "Salvar";
    campoClassificacao.classList.remove("hidden");
    campoPagamento.classList.remove("hidden");
    tipoTransacao = "despesa";

    modalOverlay.classList.remove("hidden");
});

botoesFechar.forEach((fechar) => {
    fechar.addEventListener("click", fecharModalTransacao);
});

// funcoes reutilizaveis
function mostrarErro(campo, mensagem) {
    const erro = document.getElementById(`erro-${campo.id}`);

    erro.textContent = mensagem;
    campo.classList.add("invalido");
}
function limparErros() {
    document.querySelectorAll(".erro-campo").forEach((erro) => {
        erro.textContent = "";
    });

    document.querySelectorAll(".invalido").forEach((campo) => {
        campo.classList.remove("invalido");
    });
}
function limparErroCampo(campo) {
    const erro = document.getElementById(`erro-${campo.id}`);

    erro.textContent = "";
    campo.classList.remove("invalido");
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
        const correspondeCategoria = categoria === "todas" || transacao.categoria === categoria;
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
        celula.textContent = "Nenhuma transação encontrada.";
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
    modalOverlay.classList.add("hidden");
    formTransacao.reset();
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

    renderizarTransacoes(listaTransacoesCompleta, null, pesquisa, tipo, categoria, dataInicial, dataFinal);
}

function atualizarCategorias() {
    const categoriaAtual = filtroCategoria.value;

    const categorias = [...new Set(
        transacoes.map((transacao) => transacao.categoria)
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
    modalConta.classList.remove("hidden");
}

function fecharModalConta() {
    modalConta.classList.add("hidden");
    formConta.reset();
}

function renderizarContas() {
    listaContas.innerHTML = "";

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

    const nome = campoNomeConta.value.trim();
    const tipo = campoTipoConta.value;
    const instituicao = campoInstituicaoConta.value.trim();
    const valorInformado = campoSaldoInicial.value;
    const saldoInicial = Number(valorInformado);

    // Validação inicial
    if (!nome || !tipo || valorInformado === "" || !Number.isFinite(saldoInicial) || saldoInicial < 0) {
        return;
    }

    const novaConta = {
        id: crypto.randomUUID(),
        nome: nome,
        tipo: tipo,
        instituicao: instituicao,
        saldoInicial: saldoInicial
    };

    contas.push(novaConta);

    localStorage.setItem("contas", JSON.stringify(contas));
    renderizarContas();
    atualizarSaldoTotalContas();

    fecharModalConta();
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
    campoConta
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

        modalExclusao.classList.remove("hidden");
    });
});

botaoCancelarExclusao.addEventListener("click", () => {
    modalExclusao.classList.add("hidden");
});

botaoConfirmarExclusao.addEventListener("click", () => {
const transacoesRestantes = transacoes.filter((transacao) => {
    return !transacoesSelecionadas.includes(transacao.id);
});

    transacoes.splice(0, transacoes.length, ...transacoesRestantes);

    localStorage.setItem("transacoes", JSON.stringify(transacoes));

    transacoesSelecionadas = [];

    renderizarTransacoes(listaTransacoes, 5);
    atualizarCategorias();
    atualizarTabelaCompleta();
    atualizarResumo();
    atualizarBarraAcoes();

    modalExclusao.classList.add("hidden");
});
[botaoEditar, botaoEditarCompleta].forEach((botao) => {
    botao.addEventListener("click", () => {
        if (transacoesSelecionadas.length !== 1) return;

        const id = transacoesSelecionadas[0];

        const transacao = transacoes.find((transacao) => {
            return transacao.id === id;
        });

        if (!transacao) return;

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

        modalOverlay.classList.remove("hidden");
        });
    });

// fechar o modal de exclusao ao clicar fora dele ou botao esc
modalExclusao.addEventListener("click", (event) => {
    if (event.target === modalExclusao) {
        modalExclusao.classList.add("hidden");
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modalExclusao.classList.contains("hidden")) {
        modalExclusao.classList.add("hidden");
    }
});

// evento de envio do formulario
formTransacao.addEventListener("submit", (enviar) => { 
    enviar.preventDefault();
    limparErros();
    const nome = campoNome.value.trim();
    const valor = Number(campoValor.value);
    const categoria = campoCategoria.value;
    const classificacao = selectClassificacao.value;
    const pagamento = selectPagamento.value;
    const conta = campoConta.value;
    const data = campoData.value;
    
    let formularioValido = true;

    if (nome === "") {
        mostrarErro(campoNome, "Informe o nome da transação.");
        formularioValido = false;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
        mostrarErro(campoValor, "O valor deve ser um número positivo.");
        formularioValido = false;
    }
    if (categoria.trim() === "") {
        mostrarErro(campoCategoria, "Informe uma categoria.");
        formularioValido = false;
    }

    if (data === "") {
        mostrarErro(campoData, "Selecione uma data.");
        formularioValido = false;
    }

    if (conta === "") {
        mostrarErro(campoConta, "Selecione uma conta.");
        formularioValido = false;
    }
    if (!formularioValido) {
        return;
    }

    if (transacaoEmEdicao !== null) {
        const transacaoExistente = transacoes.find((transacao) => {
            return transacao.id === transacaoEmEdicao;
        });

        if (!transacaoExistente) return;
            transacaoExistente.nome = nome;
            transacaoExistente.valor = valor;
            transacaoExistente.categoria = categoria;
            transacaoExistente.classificacao =
                tipoTransacao === "despesa" ? classificacao : null;
            transacaoExistente.pagamento =
                tipoTransacao === "despesa" ? pagamento : null;
            transacaoExistente.conta = conta;
            transacaoExistente.data = data;
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
    transacoes.push(transacao);
    }
    
    localStorage.setItem("transacoes", JSON.stringify(transacoes));
    transacoesSelecionadas = []
    renderizarTransacoes(listaTransacoes, 5);
    atualizarCategorias();
    atualizarTabelaCompleta();
    atualizarResumo();
    atualizarBarraAcoes();

    fecharModalTransacao();
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
