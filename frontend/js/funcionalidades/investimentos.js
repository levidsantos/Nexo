// Apresentação recebe resultados preparados; decisões financeiras permanecem no coordenador.
export function criarApresentacaoInvestimentos({
    document, window, listaInvestimentos, historicoInvestimentos,
    totalCapital, totalValor, botaoNovoInvestimento, navegacaoPrincipal,
    larguraMobileTransacoes, movimentoReduzidoMenus,
    formatarCentavos, converterParaCentavos, formatadorMoeda, obterDataLocal, formatarDataInvestimento,
    obterModalAtivo, definirFocoRetorno, acoes: solicitarAcoes
}) {
    let inicializado = false;
    const eventosCards = [];
    function registrarEventoCard(botao, callback) {
        botao.addEventListener("click", callback);
        eventosCards.push(() => botao.removeEventListener("click", callback));
    }
    function limparEventosCards() {
        for (const remover of eventosCards.splice(0)) remover();
    }
    function apresentarValorInvestimento(elemento, centavos) {
        elemento.textContent = formatarCentavos(centavos);
        elemento.classList.toggle("valor-investimento-extenso", elemento.textContent.length > 18);
    }

    function prepararRetornoFocoInvestimento(id, acao) {
        const item = [...listaInvestimentos.children]
            .find((elemento) => elemento.dataset.investimentoId === id);
        const focoRetorno = item?.querySelector(`[data-acao="${acao}"]`)
            ?? botaoNovoInvestimento;
        definirFocoRetorno(focoRetorno);
        const administracao = focoRetorno.closest(".gerenciar-investimento");
        if (administracao) {
            definirMenuAcoes(administracao, true, false);
        }
    }

    function posicionarAcoesAdministrativasInvestimento(menu) {
        const posicao = menu.getBoundingClientRect();
        const altura = menu.querySelector(".acoes-administrativas-investimento").getBoundingClientRect().height || 110;
        const limiteInferior = larguraMobileTransacoes.matches
            ? navegacaoPrincipal.getBoundingClientRect().top : window.innerHeight;
        menu.classList.toggle("abre-acima", posicao.bottom + altura + 6 > limiteInferior && posicao.top > altura + 6);
    }

    const transicoesMenusAcoes = new Map();

    function definirMenuAcoes(menu, aberto, animar = true) {
        const painel = menu.querySelector(".painel-menu-acoes");
        if (!aberto && menu.classList.contains("menu-acoes-saindo")) return;
        const estavaAberto = menu.open;
        transicoesMenusAcoes.get(menu)?.cancelar();
        transicoesMenusAcoes.delete(menu);

        const concluir = () => {
            transicoesMenusAcoes.get(menu)?.cancelar();
            transicoesMenusAcoes.delete(menu);
            menu.open = aberto;
            menu.classList.remove("menu-acoes-animando", "menu-acoes-entrando", "menu-acoes-saindo");
            painel.inert = false;
        };
        if (!aberto && painel.contains(document.activeElement)) {
            menu.querySelector("summary").focus({ preventScroll: true });
        }
        if (!animar || movimentoReduzidoMenus.matches || (!aberto && !estavaAberto)) {
            concluir();
            if (aberto) posicionarAcoesAdministrativasInvestimento(menu);
            return;
        }

        menu.classList.add("menu-acoes-animando");
        if (aberto) {
            menu.open = true;
            painel.inert = false;
            posicionarAcoesAdministrativasInvestimento(menu);
            if (!estavaAberto) {
                menu.classList.add("menu-acoes-entrando");
                void painel.offsetWidth;
            }
            menu.classList.remove("menu-acoes-entrando", "menu-acoes-saindo");
        } else {
            painel.inert = true;
            menu.classList.add("menu-acoes-saindo");
        }
        const aoTerminar = (evento) => {
            if (evento.target === painel && evento.propertyName === "opacity") concluir();
        };
        const temporizador = setTimeout(concluir, (aberto ? 170 : 120) + 50);
        painel.addEventListener("transitionend", aoTerminar);
        transicoesMenusAcoes.set(menu, {
            concluir,
            cancelar: () => {
                clearTimeout(temporizador);
                painel.removeEventListener("transitionend", aoTerminar);
            }
        });
    }

    function aoMudarMovimento() {
        if (movimentoReduzidoMenus.matches) {
            for (const transicao of [...transicoesMenusAcoes.values()]) transicao.concluir();
        }
    }

    function fecharAcoesAdministrativasInvestimentos(exceto = null, restaurarFoco = false) {
        listaInvestimentos.querySelectorAll(".gerenciar-investimento[open]").forEach((menu) => {
            if (menu === exceto) return;
            const focoDentro = menu.contains(document.activeElement);
            definirMenuAcoes(menu, false);
            if (restaurarFoco && focoDentro) menu.querySelector("summary").focus({ preventScroll: true });
        });
    }

    function aoClicar(evento) {
        if (obterModalAtivo() || evento.target.closest(".modal-overlay")) return;
        const menu = evento.target.closest(".gerenciar-investimento");
        if (menu && evento.target.closest("summary")) {
            evento.preventDefault();
            definirMenuAcoes(menu, !menu.open || menu.classList.contains("menu-acoes-saindo"));
        }
        fecharAcoesAdministrativasInvestimentos(menu, true);
    }

    function aoTeclar(evento) {
        if (evento.key !== "Escape" || obterModalAtivo() || evento.target.closest(".modal-overlay")) return;
        if (listaInvestimentos.querySelector(".gerenciar-investimento[open]")) {
            fecharAcoesAdministrativasInvestimentos(null, true);
            evento.preventDefault();
        }
    }

    // O painel acompanha o card; ao mudar a área visível, evita permanecer
    // aberto sobre a navegação inferior ou fora dos limites da janela.
    function fecharAcoesInvestimentosAoMudarViewport() {
        if (!obterModalAtivo()) fecharAcoesAdministrativasInvestimentos(null, true);
    }


    function renderizarIndicadores({ totalCapitalCentavos, valores }) {
        apresentarValorInvestimento(totalCapital, totalCapitalCentavos);
        apresentarValorInvestimento(totalValor, valores.disponivel ? valores.totalValorCentavos : null);
    }
    function renderizarCards({ investimentos, indisponivel, acompanhamento, restricaoMovimentacao }) {
        const { capitais, valores: estimativas } = acompanhamento;
        const lista = listaInvestimentos;
        limparEventosCards();
        // Encerra saídas pendentes antes de descartar os cards; sem clones ou timers órfãos.
        for (const transicao of [...transicoesMenusAcoes.values()]) transicao.concluir();
        lista.replaceChildren();
        if (indisponivel || investimentos.length === 0) {
            const mensagem = document.createElement("p");
            mensagem.classList.add("mensagem-vazia");
            mensagem.textContent = indisponivel
                ? "Dados de investimentos indisponíveis. Gravações bloqueadas nesta sessão; o conteúdo armazenado foi preservado."
                : "Nenhum investimento cadastrado. Use Novo investimento para cadastrar o primeiro.";
            lista.appendChild(mensagem);
            return;
        }
        investimentos.forEach((investimento) => {
            const item = document.createElement("article");
            item.classList.add("item-investimento");
            item.dataset.investimentoId = investimento.id;
            const nome = document.createElement("h3");
            nome.textContent = investimento.nome;
            const detalhes = document.createElement("p");
            detalhes.textContent = [investimento.tipo, investimento.instituicao].filter(Boolean).join(" · ");
            const valores = document.createElement("dl");
            const posicao = estimativas.valoresPorInvestimento?.get(investimento.id);
            const capital = capitais.disponivel ? capitais.capitaisPorInvestimentoCentavos.get(investimento.id) : null;
            [["Capital aplicado atual", capital, "Inicial", investimento.capitalInicial, investimento.dataReferenciaCapital],
                ["Valor estimado atual",
                    posicao?.disponivel ? posicao.valorCentavos : null, "Manual",
                    investimento.valorInformado, investimento.dataReferenciaValor]].forEach(([rotulo, valor, rotuloBase, base, dataBase]) => {
                const grupo = document.createElement("div");
                const termo = document.createElement("dt");
                termo.textContent = rotulo;
                const descricao = document.createElement("dd");
                const quantia = document.createElement("span");
                quantia.className = "valor-investimento";
                apresentarValorInvestimento(quantia, valor);
                const referenciaBase = document.createElement("p");
                referenciaBase.className = "base-investimento";
                const quantiaBase = document.createElement("span");
                quantiaBase.className = "valor-base-investimento";
                quantiaBase.textContent = formatarCentavos(converterParaCentavos(base));
                referenciaBase.append(`${rotuloBase}: `, quantiaBase,
                    ` · fim de ${formatarDataInvestimento(dataBase)}`);
                descricao.append(quantia, referenciaBase);
                grupo.append(termo, descricao);
                valores.appendChild(grupo);
            });
            const referencia = document.createElement("p");
            referencia.classList.add("referencia-investimento");
            const dataAtualizacao = obterDataLocal(new Date(investimento.atualizadoEm));
            referencia.textContent = `Atualização manual: ${formatarDataInvestimento(dataAtualizacao)}`;
            const aviso = document.createElement("p");
            aviso.classList.add("aviso-investimento");
            aviso.textContent = posicao && !posicao.disponivel ? posicao.motivo
                : !capitais.disponivel ? capitais.motivo : "";
            const acoes = document.createElement("div");
            acoes.classList.add("acoes-investimento");
            const administracao = document.createElement("details");
            administracao.className = "gerenciar-investimento menu-acoes";
            const abrirAdministracao = document.createElement("summary");
            abrirAdministracao.textContent = "Mais ações";
            abrirAdministracao.setAttribute("aria-label", `Mais ações do investimento ${investimento.nome}`);
            const acoesAdministrativas = document.createElement("div");
            acoesAdministrativas.className = "acoes-administrativas-investimento painel-menu-acoes";
            acoesAdministrativas.id = `administracao-investimento-${investimento.id}`;
            abrirAdministracao.setAttribute("aria-controls", acoesAdministrativas.id);
            administracao.append(abrirAdministracao, acoesAdministrativas);
            [["Aporte", "aporte", solicitarAcoes.aporte],
                ["Resgate", "resgate", solicitarAcoes.resgate],
                ["Atualizar valor", "atualizar", solicitarAcoes.atualizar],
                ["Editar", "editar", solicitarAcoes.editar], ["Excluir", "excluir", solicitarAcoes.excluir]].forEach(([rotulo, chave, acao]) => {
                const botao = document.createElement("button");
                botao.type = "button";
                botao.textContent = rotulo;
                botao.dataset.acao = chave;
                if (chave === "atualizar") botao.classList.add("btn-primario");
                botao.setAttribute("aria-label", `${rotulo} investimento ${investimento.nome}`);
                if (rotulo === "Excluir") botao.classList.add("btn-excluir");
                if (restricaoMovimentacao && (chave === "aporte" || chave === "resgate")) {
                    botao.disabled = true;
                    botao.setAttribute("aria-describedby", `restricao-movimentacao-${investimento.id}`);
                }
                const administrativa = chave === "editar" || chave === "excluir";
                registrarEventoCard(botao, () => {
                    if (!administrativa) fecharAcoesAdministrativasInvestimentos();
                    else definirMenuAcoes(administracao, true, false);
                    acao(investimento.id);
                });
                (administrativa ? acoesAdministrativas : acoes).appendChild(botao);
            });
            const identidade = document.createElement("header");
            identidade.className = "identidade-investimento";
            identidade.append(nome, detalhes);
            item.append(identidade, valores, administracao);
            if (investimento.observacoes) {
                const nota = document.createElement("p");
                nota.className = "nota-investimento";
                nota.textContent = investimento.observacoes;
                item.appendChild(nota);
            }
            if (aviso.textContent) item.appendChild(aviso);
            if (restricaoMovimentacao) {
                const explicacao = document.createElement("p");
                explicacao.className = "restricao-movimentacao-investimento";
                explicacao.id = `restricao-movimentacao-${investimento.id}`;
                explicacao.textContent = restricaoMovimentacao.mensagem;
                item.appendChild(explicacao);
            }
            const rodape = document.createElement("footer");
            rodape.className = "rodape-investimento";
            rodape.append(referencia, acoes);
            item.appendChild(rodape);
            lista.appendChild(item);
        });
    }

    function renderizarHistorico({ disponivel, movimentos }) {
        const lista = historicoInvestimentos;
        lista.replaceChildren();
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
        for (const { movimento, nomeInvestimento, nomeConta, futura } of movimentos) {
            const item = document.createElement("li");
            const resgate = movimento.tipo === "resgate";
            const titulo = document.createElement("strong");
            item.classList.add(resgate ? "movimento-resgate" : "movimento-aporte");
            titulo.textContent = `${resgate ? "Resgate" : "Aporte"} · ${nomeInvestimento}`;
            const contexto = document.createElement("p");
            contexto.textContent = `${formatarDataInvestimento(movimento.data)} · ${nomeConta}${futura ? " · Data futura" : ""}`;
            const valor = document.createElement("p");
            valor.className = "valor-movimento-investimento";
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


    function inicializar() {
        if (inicializado) return;
        inicializado = true;
        movimentoReduzidoMenus.addEventListener("change", aoMudarMovimento);
        document.addEventListener("click", aoClicar);
        document.addEventListener("keydown", aoTeclar);
        window.addEventListener("scroll", fecharAcoesInvestimentosAoMudarViewport, { passive: true });
        window.addEventListener("resize", fecharAcoesInvestimentosAoMudarViewport);
    }
    function encerrar() {
        inicializado = false;
        movimentoReduzidoMenus.removeEventListener("change", aoMudarMovimento);
        document.removeEventListener("click", aoClicar);
        document.removeEventListener("keydown", aoTeclar);
        window.removeEventListener("scroll", fecharAcoesInvestimentosAoMudarViewport);
        window.removeEventListener("resize", fecharAcoesInvestimentosAoMudarViewport);
        for (const transicao of [...transicoesMenusAcoes.values()]) transicao.concluir();
        for (const menu of listaInvestimentos.querySelectorAll(".gerenciar-investimento[open]")) definirMenuAcoes(menu, false, false);
        limparEventosCards();
    }
    return { inicializar, renderizarIndicadores, renderizarCards, renderizarHistorico, prepararRetornoFocoInvestimento, encerrar };
}
