import { dataValida, obterDataLocal, converterParaCentavos, formatarCentavos } from "../dominio/valores-datas.js";
import { valorMonetarioValido, ehMovimentacaoInvestimento } from "../dominio/validacoes.js";
import { mostrarErro, limparErros, limparErroCampo, focarPrimeiroErro, criarConfirmacaoFinanceira } from "../ui/formularios.js";

// Estado de formulário local; coleções e confirmações são consultadas explicitamente.
export function criarOperacoesInvestimentos({ elementos, consultas: disponibilidadeColecoes,
    confirmarInvestimentos, confirmarTransacoes, validarContaTransacao,
    prepararMovimentacaoInvestimento, obterRestricaoMovimentacaoInvestimentos, formatarDataInvestimento,
    modais: { abrirModal, fecharModal }, mostrarToast,
    aposSalvarInvestimento, aposExcluirInvestimento, aposAtualizarValor, aposSalvarMovimentacao,
    gerarId = () => crypto.randomUUID() }) {
    const obterElemento = (id) => elementos[id];
    let inicializado = false;
    const removerListeners = [];
    const confirmacaoFinanceira = criarConfirmacaoFinanceira(mostrarToast);
    function escutar(alvo, tipo, callback) {
        alvo.addEventListener(tipo, callback);
        removerListeners.push(() => alvo.removeEventListener(tipo, callback));
    }
    function criarOpcao(texto, valor) {
        const opcao = elementos["form-movimentacao"].ownerDocument.createElement("option");
        opcao.textContent = texto;
        opcao.value = valor;
        return opcao;
    }
    let investimentoEmEdicao = null;
    let investimentoEmExclusao = null;
    const formInvestimento = obterElemento("form-investimento");
    const modalInvestimento = obterElemento("modal-investimento");
    const modalExclusaoInvestimento = obterElemento("modal-exclusao-investimento");
    const camposInvestimento = {
        nome: obterElemento("nome-investimento"),
        tipo: obterElemento("tipo-investimento"),
        instituicao: obterElemento("instituicao-investimento"),
        capital: obterElemento("capital-investimento"),
        valor: obterElemento("valor-investimento"),
        referencia: obterElemento("referencia-investimento"),
        referenciaValor: obterElemento("referencia-valor-investimento"),
        observacoes: obterElemento("observacoes-investimento")
    };

    function investimentosDisponiveis() {
        if (!disponibilidadeColecoes.colecaoEstaBloqueada("investimentos")) return true;
        mostrarToast("Investimentos indisponíveis. As gravações estão bloqueadas e os dados armazenados foram preservados.", "erro");
        return false;
    }

    function abrirModalInvestimento(id = null) {
        if (confirmacaoFinanceira.estaPendente()) return;
        if (!investimentosDisponiveis()) return;
        const investimento = id === null ? null : disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === id);
        if (id !== null && !investimento) {
            mostrarToast("O investimento não está disponível para edição.", "erro");
            return;
        }
        formInvestimento.reset();
        limparErros(formInvestimento);
        investimentoEmEdicao = id;
        obterElemento("titulo-modal-investimento").textContent = investimento ? "Editar investimento" : "Adicionar investimento";
        obterElemento("salvar-investimento").textContent = investimento ? "Salvar alterações" : "Salvar investimento";
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
        if (confirmacaoFinanceira.estaPendente()) return;
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
        if (confirmacaoFinanceira.estaPendente()) return;
        if (!podeExcluirInvestimento(id)) return;
        investimentoEmExclusao = id;
        const investimento = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === id);
        obterElemento("mensagem-exclusao-investimento").textContent = `Deseja excluir o investimento "${investimento.nome}"? Esta ação não poderá ser desfeita.`;
        abrirModal(modalExclusaoInvestimento, obterElemento("cancelar-exclusao-investimento"));
    }

    function fecharExclusaoInvestimento() {
        if (confirmacaoFinanceira.estaPendente()) return;
        fecharModal(modalExclusaoInvestimento);
        investimentoEmExclusao = null;
    }

    function atualizarAvisoRetroativo(campo, referenciaAnterior, avisoId, confirmacaoId) {
        const aviso = obterElemento(avisoId);
        aviso.classList.toggle("hidden", !referenciaAnterior || !campo.value || campo.value >= referenciaAnterior);
        obterElemento(confirmacaoId).checked = false;
    }

    let investimentoEmAtualizacao = null;
    const modalValorInvestimento = obterElemento("modal-valor-investimento");
    const formValorInvestimento = obterElemento("form-valor-investimento");
    const campoValorManual = obterElemento("valor-manual-investimento");
    const campoDataValorManual = obterElemento("data-valor-manual");

    function abrirAtualizacaoValor(id) {
        if (confirmacaoFinanceira.estaPendente()) return;
        if (!investimentosDisponiveis()) return;
        const investimento = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === id);
        if (!investimento) { mostrarToast("Investimento indisponível para atualização.", "erro"); return; }
        investimentoEmAtualizacao = id;
        formValorInvestimento.reset();
        limparErros(formValorInvestimento);
        obterElemento("titulo-valor-investimento").textContent = `Atualizar valor · ${investimento.nome}`;
        obterElemento("avaliacao-anterior-investimento").textContent =
            `Avaliação anterior: ${formatarCentavos(converterParaCentavos(investimento.valorInformado))}, referente ao final de ${formatarDataInvestimento(investimento.dataReferenciaValor)}. Registro atualizado em ${formatarDataInvestimento(obterDataLocal(new Date(investimento.atualizadoEm)))}.`;
        campoValorManual.value = investimento.valorInformado;
        campoDataValorManual.max = obterDataLocal();
        campoDataValorManual.value = investimento.dataReferenciaValor;
        atualizarAvisoRetroativo(campoDataValorManual, investimento.dataReferenciaValor,
            "aviso-retroativo-manual", "confirmar-retroativo-manual");
        abrirModal(modalValorInvestimento, campoValorManual);
    }

    function fecharAtualizacaoValor() {
        if (confirmacaoFinanceira.estaPendente()) return;
        fecharModal(modalValorInvestimento, () => {
            formValorInvestimento.reset();
            limparErros(formValorInvestimento);
            investimentoEmAtualizacao = null;
        });
    }

    const modalMovimentacao = obterElemento("modal-movimentacao");
    const formMovimentacao = obterElemento("form-movimentacao");
    const camposMovimentacao = Object.fromEntries(
        ["investimento", "conta", "valor", "capital", "baixa", "data", "observacoes"]
            .map((nome) => [nome, obterElemento(`${nome}-movimentacao`)]));
    let tipoMovimentacao = "aporte";
    let movimentacaoEmEdicao = null;

    function podeMovimentarInvestimentos() {
        const restricao = obterRestricaoMovimentacaoInvestimentos();
        if (restricao) {
            mostrarToast(restricao.mensagem, restricao.tipo);
            return false;
        }
        return true;
    }

    function abrirModalMovimentacao(tipo, investimentoId = null, id = null) {
        if (confirmacaoFinanceira.estaPendente()) return;
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
        obterElemento("titulo-modal-movimentacao").textContent = `${registro ? "Editar" : "Adicionar"} ${tipo}`;
        obterElemento("salvar-movimentacao").textContent = registro ? "Salvar alterações" : `Salvar ${tipo}`;
        obterElemento("rotulo-investimento-movimentacao").textContent = `Investimento de ${resgate ? "origem" : "destino"}`;
        obterElemento("rotulo-conta-movimentacao").textContent = `Conta de ${resgate ? "destino" : "origem"}`;
        obterElemento("rotulo-valor-movimentacao").textContent = resgate ? "Valor recebido" : "Valor do aporte";
        obterElemento("campos-resgate").classList.toggle("hidden", !resgate);
        camposMovimentacao.capital.required = resgate;
        camposMovimentacao.capital.disabled = !resgate;
        camposMovimentacao.baixa.disabled = !resgate;
        for (const [nome, colecao] of [["investimento", disponibilidadeColecoes.consultarInvestimentos()], ["conta", disponibilidadeColecoes.consultarContas()]]) {
            const select = camposMovimentacao[nome];
            select.replaceChildren(criarOpcao("Selecione...", ""));
            colecao.forEach((item) => select.add(criarOpcao(item.nome, item.id)));
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
        if (confirmacaoFinanceira.estaPendente()) return;
        fecharModal(modalMovimentacao, () => {
            formMovimentacao.reset();
            limparErros(formMovimentacao);
            movimentacaoEmEdicao = null;
        });
    }

    // Como no cadastro de investimentos, fundo e Escape não descartam o formulário.

    function inicializar() {
        if (inicializado) return;
        inicializado = true;
        escutar(formInvestimento, "submit", async (evento) => {
            evento.preventDefault();
            if (confirmacaoFinanceira.estaPendente()) return;
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
                && !obterElemento("confirmar-retroativo-investimento").checked) {
                erro(campos.referenciaValor, "Confirme abaixo a substituição retroativa e o recálculo das movimentações.");
            }
            if (!valido) { focarPrimeiroErro(formInvestimento); return; }
            const editando = investimentoEmEdicao !== null;
            const anterior = editando ? disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === investimentoEmEdicao) : null;
            if (editando && !anterior) { mostrarToast("O investimento em edição não está disponível.", "erro"); return; }
            const valorInformado = Number(campos.valor.value);
            const atualizouValor = !anterior || anterior.valorInformado !== valorInformado || anterior.dataReferenciaValor !== referenciaValor;
            const registro = {
                id: anterior ? anterior.id : gerarId(),
                nome: campos.nome.value.trim(), tipo: campos.tipo.value.trim(), instituicao: campos.instituicao.value.trim(),
                capitalInicial: Number(campos.capital.value), dataReferenciaCapital: referencia,
                valorInformado, dataReferenciaValor: referenciaValor,
                atualizadoEm: atualizouValor ? new Date().toISOString() : anterior.atualizadoEm,
                observacoes: campos.observacoes.value.trim()
            };
            const proximos = editando ? disponibilidadeColecoes.consultarInvestimentos().map((item) => item.id === anterior.id ? registro : item) : [...disponibilidadeColecoes.consultarInvestimentos(), registro];
            if (!await confirmacaoFinanceira.confirmar(confirmarInvestimentos, proximos, obterElemento("salvar-investimento"))) return;
            aposSalvarInvestimento(registro, editando);
            fecharModalInvestimento();
            mostrarToast(editando ? "Investimento atualizado." : "Investimento cadastrado.", "sucesso");
        });
        escutar(obterElemento("novo-investimento"), "click", () => abrirModalInvestimento());
        escutar(obterElemento("fechar-investimento"), "click", fecharModalInvestimento);
        escutar(obterElemento("cancelar-investimento"), "click", fecharModalInvestimento);
        Object.values(camposInvestimento).filter((campo) => campo.id !== "instituicao-investimento").forEach((campo) => {
            escutar(campo, "input", () => limparErroCampo(campo));
        });
        escutar(obterElemento("cancelar-exclusao-investimento"), "click", fecharExclusaoInvestimento);
        escutar(modalExclusaoInvestimento, "click", (evento) => {
            if (evento.target === modalExclusaoInvestimento) fecharExclusaoInvestimento();
        });
        escutar(obterElemento("confirmar-exclusao-investimento"), "click", async () => {
            if (investimentoEmExclusao === null || !podeExcluirInvestimento(investimentoEmExclusao)) return;
            const proximos = disponibilidadeColecoes.consultarInvestimentos().filter((item) => item.id !== investimentoEmExclusao);
            if (!await confirmacaoFinanceira.confirmar(confirmarInvestimentos, proximos, obterElemento("confirmar-exclusao-investimento"))) return;
            aposExcluirInvestimento();
            fecharExclusaoInvestimento();
            mostrarToast("Investimento excluído.", "sucesso");
        });
        escutar(camposInvestimento.referenciaValor, "input", () => {
            const anterior = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === investimentoEmEdicao);
            atualizarAvisoRetroativo(camposInvestimento.referenciaValor, anterior?.dataReferenciaValor,
                "aviso-retroativo-investimento", "confirmar-retroativo-investimento");
        });
        escutar(formValorInvestimento, "submit", async (evento) => {
            evento.preventDefault();
            if (confirmacaoFinanceira.estaPendente()) return;
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
            } else if (data < anterior.dataReferenciaValor && !obterElemento("confirmar-retroativo-manual").checked) {
                mostrarErro(campoDataValorManual, "Confirme abaixo a substituição retroativa e o recálculo das movimentações.");
                valido = false;
            }
            if (!valido) { focarPrimeiroErro(formValorInvestimento); return; }
            const atualizado = { ...anterior, valorInformado: Number(campoValorManual.value),
                dataReferenciaValor: data, atualizadoEm: new Date().toISOString() };
            const candidatos = disponibilidadeColecoes.consultarInvestimentos().map((item) => item.id === anterior.id ? atualizado : item);
            if (!await confirmacaoFinanceira.confirmar(confirmarInvestimentos, candidatos, formValorInvestimento.querySelector('button[type="submit"]'))) return;
            aposAtualizarValor(atualizado);
            fecharAtualizacaoValor();
            mostrarToast("Valor informado atualizado. As estimativas foram recalculadas.", "sucesso");
        });
        escutar(campoDataValorManual, "input", () => {
            const anterior = disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === investimentoEmAtualizacao);
            atualizarAvisoRetroativo(campoDataValorManual, anterior?.dataReferenciaValor,
                "aviso-retroativo-manual", "confirmar-retroativo-manual");
        });
        [campoValorManual, campoDataValorManual].forEach((campo) => escutar(campo, "input", () => limparErroCampo(campo)));
        escutar(obterElemento("cancelar-valor-investimento"), "click", fecharAtualizacaoValor);
        escutar(obterElemento("fechar-valor-investimento"), "click", fecharAtualizacaoValor);
        escutar(formMovimentacao, "submit", async (evento) => {
            evento.preventDefault();
            if (confirmacaoFinanceira.estaPendente()) return;
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
                id: anterior?.id ?? gerarId(),
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
            if (!await confirmacaoFinanceira.confirmar(confirmarTransacoes, candidatos, obterElemento("salvar-movimentacao"))) return;
            aposSalvarMovimentacao();
            fecharModalMovimentacao();
            mostrarToast(anterior ? "Movimentação atualizada." : "Movimentação registrada.", "sucesso");
        });
        elementos.botoesMovimentacao.forEach((botao) => {
            escutar(botao, "click", () => abrirModalMovimentacao(botao.dataset.movimentacao));
        });
        escutar(obterElemento("fechar-movimentacao"), "click", fecharModalMovimentacao);
        escutar(obterElemento("cancelar-movimentacao"), "click", fecharModalMovimentacao);
        Object.values(camposMovimentacao).forEach((campo) => {
            escutar(campo, "input", () => limparErroCampo(campo));
            escutar(campo, "change", () => limparErroCampo(campo));
        });
    }
    function encerrar() {
        for (const remover of removerListeners.splice(0)) remover();
        inicializado = false;
    }
    return { inicializar, abrirModalInvestimento, solicitarExclusaoInvestimento, podeExcluirInvestimento,
        fecharExclusaoInvestimento, abrirAtualizacaoValor, abrirModalMovimentacao, encerrar };
}
