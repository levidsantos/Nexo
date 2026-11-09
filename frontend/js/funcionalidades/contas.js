import { dataValida, obterDataLocal, formatarCentavos } from "../dominio/valores-datas.js";
import { valorMonetarioValido } from "../dominio/validacoes.js";
import { mostrarErro, limparErros, limparErroCampo, focarPrimeiroErro, criarConfirmacaoFinanceira } from "../ui/formularios.js";

// A funcionalidade mantém apenas estado visual; consulta as coleções atuais em cada operação.
export function criarContas({ elementos, estado: disponibilidadeColecoes, confirmarContas,
    modais: { abrirModal, fecharModal }, mostrarToast, aoConfirmarAlteracao,
    gerarId = () => crypto.randomUUID() }) {
    const {
        botaoNovaConta, modalConta, botaoFecharConta, botaoCancelarConta,
        formConta, campoNomeConta, campoTipoConta, campoInstituicaoConta,
        campoSaldoInicial, campoDataReferencia, campoIncluirNoSaldoDisponivel, tituloModalConta,
        botaoSalvarConta, modalExclusaoConta, mensagemExclusaoConta, botaoCancelarExclusaoConta,
        botaoConfirmarExclusaoConta, listaContas
    } = elementos;
    const document = listaContas.ownerDocument;
    let inclusaoSaldoAlterada = false;
    let contaEmEdicao = null;
    let contaEmExclusao = null;
    let inicializado = false;
    const removerListeners = [];
    const confirmacaoFinanceira = criarConfirmacaoFinanceira(mostrarToast);
    const removerListenersCards = [];
    const escutar = (elemento, tipo, callback) => {
        elemento.addEventListener(tipo, callback);
        removerListeners.push(() => elemento.removeEventListener(tipo, callback));
    };
    const escutarCard = (elemento, callback) => {
        elemento.addEventListener("click", callback);
        removerListenersCards.push(() => elemento.removeEventListener("click", callback));
    };

    function abrirModalConta(contaId = null) {
        if (confirmacaoFinanceira.estaPendente()) return;
        const conta = contaId === null ? null : disponibilidadeColecoes.consultarContas().find((registro) => registro.id === contaId);
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

    function fecharModalConta() {
        if (confirmacaoFinanceira.estaPendente()) return;
        fecharModal(modalConta, () => {
            formConta.reset();
            limparErros(formConta);
            contaEmEdicao = null;
            inclusaoSaldoAlterada = false;
        });
    }

    function podeExcluirConta(contaId) {
        if (disponibilidadeColecoes.colecaoEstaBloqueada("contas") || disponibilidadeColecoes.colecaoEstaBloqueada("transacoes")) {
            mostrarToast("Não é possível excluir a conta: os dados de contas ou transações estão indisponíveis. "
                + "Não foi possível confirmar a ausência de vínculos.", "erro");
            return false;
        }
        if (!disponibilidadeColecoes.consultarContas().some((conta) => conta.id === contaId)) {
            mostrarToast("Não foi possível excluir: a conta não está disponível.", "erro");
            return false;
        }
        if (disponibilidadeColecoes.consultarTransacoes().some((transacao) => transacao.contaId === contaId)) {
            mostrarToast("Esta conta possui transações vinculadas e não pode ser excluída, "
                + "mesmo que sejam históricas. Nenhuma transação foi alterada.", "erro");
            return false;
        }
        return true;
    }

    function solicitarExclusaoConta(contaId) {
        if (confirmacaoFinanceira.estaPendente()) return;
        if (!podeExcluirConta(contaId)) return;
        const conta = disponibilidadeColecoes.consultarContas().find((registro) => registro.id === contaId);
        contaEmExclusao = conta.id;
        mensagemExclusaoConta.textContent = `Deseja excluir a conta "${conta.nome}"? Esta ação não poderá ser desfeita.`;
        abrirModal(modalExclusaoConta, botaoCancelarExclusaoConta);
    }

    function fecharModalExclusaoConta() {
        if (confirmacaoFinanceira.estaPendente()) return;
        fecharModal(modalExclusaoConta);
        contaEmExclusao = null;
    }

    function renderizarContas(saldos) {
        removerListenersCards.splice(0).forEach((remover) => remover());
        listaContas.innerHTML = "";

        if (disponibilidadeColecoes.colecaoEstaBloqueada("contas")) {
            const mensagem = document.createElement("p");
            mensagem.classList.add("mensagem-vazia");
            mensagem.textContent = "Os dados das contas estão indisponíveis. Não é possível cadastrar, editar ou excluir contas nesta sessão.";
            listaContas.appendChild(mensagem);
            return;
        }

        if (!saldos.disponivel) {
            const mensagem = document.createElement("p");
            mensagem.classList.add("mensagem-vazia");
            mensagem.textContent = `Saldos indisponíveis. ${saldos.motivo}`;
            listaContas.appendChild(mensagem);
        }

        if (disponibilidadeColecoes.consultarContas().length === 0) {
            if (!saldos.disponivel) return;
            listaContas.innerHTML = `
                <p class="mensagem-vazia">
                    Nenhuma conta cadastrada.
                </p>
            `;
            return;
        }

        disponibilidadeColecoes.consultarContas().forEach((conta) => {
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
            escutarCard(editar, () => abrirModalConta(conta.id));
            const excluir = document.createElement("button");
            excluir.type = "button";
            excluir.classList.add("btn-excluir");
            excluir.textContent = "Excluir";
            excluir.setAttribute("aria-label", `Excluir conta ${conta.nome}`);
            escutarCard(excluir, () => solicitarExclusaoConta(conta.id));
            acoes.append(editar, excluir);
            const rotuloSaldo = document.createElement("span");
            rotuloSaldo.className = "rotulo-saldo-conta";
            rotuloSaldo.textContent = "Saldo atual";
            saldo.className = "saldo-atual-conta";
            if (saldos.disponivel && saldos.saldosPorContaCentavos.get(conta.id) < 0) saldo.classList.add("saldo-negativo");
            const inclusao = document.createElement("p");
            inclusao.className = "inclusao-conta";
            inclusao.textContent = conta.incluirNoSaldoDisponivel
                ? "Incluída no saldo disponível" : "Fora do saldo disponível";
            if (conta.incluirNoSaldoDisponivel) inclusao.classList.add("incluida");
            item.append(nome, detalhes, rotuloSaldo, saldo, inclusao, acoes);
            listaContas.appendChild(item);
        });
    }

    function inicializar() {
        if (inicializado) return;
        inicializado = true;
        escutar(botaoNovaConta, "click", () => abrirModalConta());

        escutar(botaoFecharConta, "click", fecharModalConta);

        escutar(botaoCancelarConta, "click", fecharModalConta);
        escutar(campoTipoConta, "change", () => {
            // A sugestão por tipo não substitui uma escolha manual durante o cadastro.
            if (!inclusaoSaldoAlterada) {
                campoIncluirNoSaldoDisponivel.checked = campoTipoConta.value !== "reserva";
            }
        });
        escutar(campoIncluirNoSaldoDisponivel, "change", () => {
            inclusaoSaldoAlterada = true;
        });

        escutar(formConta, "submit", async (evento) => {
            evento.preventDefault();
            if (confirmacaoFinanceira.estaPendente()) return;
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
                mostrarErro(campoSaldoInicial, "Informe um saldo zero ou positivo, com até duas casas decimais, dentro do limite permitido.");
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
            const contaExistente = estavaEditando ? disponibilidadeColecoes.consultarContas().find((conta) => conta.id === contaEmEdicao) : null;
            if (estavaEditando && !contaExistente) {
                mostrarToast("Não foi possível salvar: a conta em edição não está disponível.", "erro");
                return;
            }
            const contaAtualizada = {
                ...contaExistente,
                id: estavaEditando ? contaExistente.id : gerarId(),
                nome: nome,
                tipo: tipo,
                instituicao: instituicao,
                saldoInicial: saldoInicial,
                dataReferencia,
                incluirNoSaldoDisponivel
            };

            const proximasContas = estavaEditando
                ? disponibilidadeColecoes.consultarContas().map((conta) => conta.id === contaEmEdicao ? contaAtualizada : conta)
                : [...disponibilidadeColecoes.consultarContas(), contaAtualizada];
            if (!await confirmacaoFinanceira.confirmar(confirmarContas, proximasContas, botaoSalvarConta)) return;
            aoConfirmarAlteracao("salvar");

            fecharModalConta();
            mostrarToast(estavaEditando ? "Conta atualizada." : "Conta criada.", "sucesso");
        });

        escutar(botaoCancelarExclusaoConta, "click", fecharModalExclusaoConta);
        escutar(modalExclusaoConta, "click", (evento) => {
            if (evento.target === modalExclusaoConta) fecharModalExclusaoConta();
        });
        escutar(botaoConfirmarExclusaoConta, "click", async () => {
            if (contaEmExclusao === null || !podeExcluirConta(contaEmExclusao)) return;
            const proximasContas = disponibilidadeColecoes.consultarContas().filter((conta) => conta.id !== contaEmExclusao);
            if (!await confirmacaoFinanceira.confirmar(confirmarContas, proximasContas, botaoConfirmarExclusaoConta)) return;
            aoConfirmarAlteracao("excluir");
            fecharModalExclusaoConta();
            mostrarToast("Conta excluída.", "sucesso");
        });


        [campoNomeConta, campoTipoConta, campoSaldoInicial, campoDataReferencia].forEach((campo) => {
            escutar(campo, "input", () => limparErroCampo(campo));
        });
    }

    function encerrar() {
        removerListeners.splice(0).forEach((remover) => remover());
        removerListenersCards.splice(0).forEach((remover) => remover());
        inicializado = false;
    }

    return { inicializar, abrirModalConta, fecharModalExclusaoConta, podeExcluirConta, renderizarContas, encerrar };
}
