import { dataValida } from "../dominio/valores-datas.js";
import { valorMonetarioValido, classificacaoDespesaValida, ehMovimentacaoInvestimento } from "../dominio/validacoes.js";
import { mostrarErro, limparErros, limparErroCampo, focarPrimeiroErro } from "../ui/formularios.js";

// Formulário e confirmação usam os controladores compartilhados; o coordenador atualiza as páginas.
export function criarOperacoesTransacoes({ elementos, consultas: disponibilidadeColecoes,
    confirmarTransacoes, validarContaTransacao, consultarSelecao,
    modais: { abrirModal, fecharModal }, mostrarToast, aposPersistir, aposFecharExclusao,
    gerarId = () => crypto.randomUUID() }) {
    const {
        addReceita, addDespesa, botoesFechar, modalOverlay,
        modalTitle, campoClassificacao, campoPagamento, formTransacao,
        campoNome, campoValor, campoCategoria, selectClassificacao,
        selectPagamento, campoConta, campoData, botaoSalvarTransacao,
        modalExclusao, mensagemExclusao, botaoCancelarExclusao, botaoConfirmarExclusao
    } = elementos;
    const document = campoConta.ownerDocument;
    let tipoTransacao = "";
    let transacaoEmEdicao = null;
    let inicializado = false;
    const removerListeners = [];
    const escutar = (alvo, tipo, callback) => {
        alvo.addEventListener(tipo, callback);
        removerListeners.push(() => alvo.removeEventListener(tipo, callback));
    };

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
        fecharModal(modalOverlay, () => {
            formTransacao.reset();
            limparErros(formTransacao);
            transacaoEmEdicao = null;
        });
    }

    function atualizarOpcoesContas() {
        const contaAtual = campoConta.value;
        campoConta.innerHTML = '<option value="">Selecione uma conta...</option>';
        if (disponibilidadeColecoes.colecaoEstaBloqueada("contas")) return;
        disponibilidadeColecoes.consultarContas().forEach((conta) => {
            const option = document.createElement("option");
            option.value = conta.id;
            option.textContent = conta.nome;
            campoConta.appendChild(option);
        });
        campoConta.value = disponibilidadeColecoes.consultarContas().some((conta) => conta.id === contaAtual) ? contaAtual : "";
    }

    function prepararContasTransacao() {
        if (disponibilidadeColecoes.colecaoEstaBloqueada("transacoes") || disponibilidadeColecoes.colecaoEstaBloqueada("contas")) {
            mostrarToast("Não é possível abrir o formulário: os dados de contas ou transações estão indisponíveis. "
                + "Os dados armazenados foram preservados.", "erro");
            return false;
        }
        if (disponibilidadeColecoes.consultarContas().length === 0) {
            mostrarToast("É necessário cadastrar uma conta antes de criar transações. "
                + "Cadastre a primeira conta na página Contas.", "informacao");
            return false;
        }
        atualizarOpcoesContas();
        return true;
    }

    function solicitarExclusaoTransacoesSelecionadas() {
        const quantidade = consultarSelecao().length;

        if (quantidade === 0) return;

        mensagemExclusao.textContent =
            `Deseja realmente excluir ${quantidade} ${quantidade === 1 ? "transação" : "transações"}? Esta ação não poderá ser desfeita.`;

        abrirModal(modalExclusao, botaoCancelarExclusao);
    }

    function abrirReceita() {
        if (!prepararContasTransacao()) return;
        formTransacao.reset();
        limparErros(formTransacao);
        transacaoEmEdicao = null;
        modalTitle.textContent = "Adicionar Receita";
        botaoSalvarTransacao.textContent = "Salvar";
        campoClassificacao.classList.add("hidden");
        selectClassificacao.required = false;
        campoPagamento.classList.add("hidden");
        tipoTransacao = "receita";

        abrirModal(modalOverlay, campoNome);
    }

    function abrirDespesa() {
        if (!prepararContasTransacao()) return;
        formTransacao.reset();
        limparErros(formTransacao);
        transacaoEmEdicao = null;
        modalTitle.textContent = "Adicionar Despesa";
        botaoSalvarTransacao.textContent = "Salvar";
        campoClassificacao.classList.remove("hidden");
        selectClassificacao.required = true;
        campoPagamento.classList.remove("hidden");
        tipoTransacao = "despesa";

        abrirModal(modalOverlay, campoNome);
    }

    function editarTransacao(id) {
        const transacao = disponibilidadeColecoes.consultarTransacoes().find((transacao) => {
            return transacao.id === id;
        });

        if (!transacao) return;
        if (ehMovimentacaoInvestimento(transacao)) return;
        if (!prepararContasTransacao()) return;

        limparErros(formTransacao);
        transacaoEmEdicao = transacao.id;
        tipoTransacao = transacao.tipo;

        preencherFormulario(transacao);

        modalTitle.textContent =
            transacao.tipo === "receita" ? "Editar Receita" : "Editar Despesa";

        botaoSalvarTransacao.textContent = "Salvar Alterações";

        if (transacao.tipo === "receita") {
            selectClassificacao.required = false;
            campoClassificacao.classList.add("hidden");
            campoPagamento.classList.add("hidden");
        } else {
            selectClassificacao.required = true;
            campoClassificacao.classList.remove("hidden");
            campoPagamento.classList.remove("hidden");
        }

        abrirModal(modalOverlay, campoNome);
    }

    function confirmarExclusao() {
        const quantidade = consultarSelecao().length;
        const transacoesRestantes = disponibilidadeColecoes.consultarTransacoes().filter((transacao) => {
            return !consultarSelecao().includes(transacao.id);
        });

        if (!confirmarTransacoes(transacoesRestantes)) return;

        aposPersistir();

        fecharModal(modalExclusao);
        aposFecharExclusao();
        mostrarToast(quantidade === 1 ? "Transação excluída." : `${quantidade} transações excluídas.`, "sucesso");
    }

    function enviarTransacao(enviar) {
        enviar.preventDefault();
        if (!["receita", "despesa"].includes(tipoTransacao)
            || disponibilidadeColecoes.consultarTransacoes().some((item) => item.id === transacaoEmEdicao && ehMovimentacaoInvestimento(item))) {
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
            mostrarErro(campoValor, "Informe um valor maior que zero, com até duas casas decimais, dentro do limite permitido.");
            formularioValido = false;
        }
        if (categoria.trim() === "") {
            mostrarErro(campoCategoria, "Informe uma categoria.");
            formularioValido = false;
        }

        if (tipoTransacao === "despesa" && !classificacaoDespesaValida(classificacao)) {
            mostrarErro(selectClassificacao, "Selecione uma classificação válida para a despesa.");
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
            const transacaoExistente = disponibilidadeColecoes.consultarTransacoes().find((transacao) => {
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
            proximasTransacoes = disponibilidadeColecoes.consultarTransacoes().map((transacao) => {
                return transacao.id === transacaoEmEdicao ? transacaoAtualizada : transacao;
            });
        } else {
            const transacao = {
                id: gerarId(),
                tipo: tipoTransacao,
                nome,
                valor,
                categoria,
                classificacao: tipoTransacao === "despesa" ? classificacao : null,
                pagamento: tipoTransacao === "despesa" ? pagamento : null,
                contaId,
                data,
            };
            proximasTransacoes = [...disponibilidadeColecoes.consultarTransacoes(), transacao];
        }

        if (!confirmarTransacoes(proximasTransacoes)) return;
        aposPersistir();

        const estavaEditando = transacaoEmEdicao !== null;
        fecharModalTransacao();
        mostrarToast(estavaEditando ? "Transação atualizada." : "Transação criada.", "sucesso");
    }

    function cancelarExclusao() { fecharModal(modalExclusao); }

    function inicializar() {
        if (inicializado) return;
        inicializado = true;
        escutar(addReceita, "click", abrirReceita);
        escutar(addDespesa, "click", abrirDespesa);
        botoesFechar.forEach((fechar) => escutar(fechar, "click", fecharModalTransacao));
        // limpar os erros quando o usuario digitar algo nos campos do formulario
        const camposFormulario = [
            campoNome,
            campoValor,
            campoCategoria,
            campoData,
            campoConta
        ];

        camposFormulario.forEach((campo) => {
            escutar(campo, "input", () => {
                limparErroCampo(campo);
            });
        });
        escutar(selectClassificacao, "change", () => {
            if (classificacaoDespesaValida(selectClassificacao.value)) limparErroCampo(selectClassificacao);
        });
        escutar(botaoCancelarExclusao, "click", cancelarExclusao);
        escutar(botaoConfirmarExclusao, "click", confirmarExclusao);
        // fechar o modal de exclusao ao clicar fora dele ou botao esc
        escutar(modalExclusao, "click", (event) => {
            if (event.target === modalExclusao) {
                fecharModal(modalExclusao);
            }
        });


        escutar(formTransacao, "submit", enviarTransacao);
    }

    function encerrar() {
        removerListeners.splice(0).forEach((remover) => remover());
        inicializado = false;
    }

    return { inicializar, abrirReceita, abrirDespesa, editarTransacao,
        solicitarExclusao: solicitarExclusaoTransacoesSelecionadas,
        confirmarExclusao, cancelarExclusao, atualizarOpcoesContas, encerrar };
}
