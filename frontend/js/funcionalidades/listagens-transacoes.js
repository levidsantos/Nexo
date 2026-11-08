import { formatadorMoeda } from "../dominio/valores-datas.js";
import { ehMovimentacaoInvestimento, CLASSIFICACOES_DESPESAS } from "../dominio/validacoes.js";
import { movimentoBancarioCentavos } from "../dominio/calculos.js";

// Duas listagens, uma seleção. Consultas sempre obtêm a versão atual dos dados.
export function criarListagensTransacoes({ elementos, consultas: disponibilidadeColecoes,
    ambiente: { window, document }, larguraMobileTransacoes, modais, aoEditar, aoExcluir }) {
    const {
        listaTransacoes, listaTransacoesCompleta, areaAcoes, quantidadeSelecionadas,
        botaoEditar, botaoExcluir, areaAcoesCompleta, quantidadeSelecionadasCompleta,
        botaoEditarCompleta, botaoExcluirCompleta, campoPesquisa, filtroTipo,
        filtroCategoria, filtroClassificacao, filtroDataInicial, filtroDataFinal,
        erroFiltroDatas, botaoLimparFiltros, paginaTransacoes, barraAcoesCompleta,
        barraContextual, quantidadeContextual, infoPaginacao, botaoPaginaAnterior,
        botaoProximaPagina
    } = elementos;
    const navegacaoPrincipal = elementos.navegacaoPrincipal;
    const { IntersectionObserver, ResizeObserver, Event } = window;
    let transacoesSelecionadas = [];
    let paginaAtual = 1;
    let totalPaginasTransacoes = 1;
    let transicaoPaginacao = null;
    const movimentoReduzidoPaginacao = window.matchMedia("(prefers-reduced-motion: reduce)");
    let transacoesPorPagina = larguraMobileTransacoes.matches ? 6 : 8;
    const acoesContextuais = new Map([
        [document.getElementById("editar-selecao-contextual"), botaoEditarCompleta],
        [document.getElementById("excluir-selecao-contextual"), botaoExcluirCompleta],
        [document.getElementById("cancelar-selecao-contextual"), document.getElementById("limpar-selecao-completa")]
    ]);
    let barraSuperiorVisivel = true;
    let observadorBarraSuperior = null;
    let alturaNavegacaoAcoes = 0;
    let inicializado = false;
    let classificacoesPreparadas = false;
    let observadorDimensoesAcoes = null;
    const removerListeners = [];
    const listenersLinhas = new Map();
    const quadrosFoco = new Set();
    const escutar = (alvo, tipo, callback, opcoes) => {
        alvo.addEventListener(tipo, callback, opcoes);
        removerListeners.push(() => alvo.removeEventListener(tipo, callback, opcoes));
    };
    const escutarLinha = (tabela, alvo, tipo, callback) => {
        alvo.addEventListener(tipo, callback);
        listenersLinhas.get(tabela).push(() => alvo.removeEventListener(tipo, callback));
    };
    const agendarFoco = (callback) => {
        const quadro = window.requestAnimationFrame(() => { quadrosFoco.delete(quadro); callback(); });
        quadrosFoco.add(quadro);
    };

    function renderizarTransacoes(tabelaDestino, limite=null, pesquisa="", tipo="todos", categoria="todas", dataInicial="", dataFinal="", classificacao="todas") {
        (listenersLinhas.get(tabelaDestino) ?? []).forEach((remover) => remover());
        listenersLinhas.set(tabelaDestino, []);
        tabelaDestino.innerHTML = "";

        const transacoesOrdenadas = disponibilidadeColecoes.consultarTransacoes().toSorted((a, b) => {
            return b.data.localeCompare(a.data);
        });
        const transacoesFiltradas = transacoesOrdenadas.filter((transacao) => {
            const investimento = ehMovimentacaoInvestimento(transacao) && !disponibilidadeColecoes.colecaoEstaBloqueada("investimentos")
                ? disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === transacao.investimentoId) : null;
            const correspondePesquisa = transacao.nome
                .toLowerCase()
                .includes(pesquisa.toLowerCase())
                || (investimento?.nome ?? "").toLowerCase().includes(pesquisa.toLowerCase());

            const correspondeTipo = tipo === "todos" || transacao.tipo === tipo;
            const categoriaTransacao = ehMovimentacaoInvestimento(transacao) ? "" : transacao.categoria;
            const correspondeCategoria = categoria === "todas" || categoriaTransacao.trim() === categoria.trim();
            const correspondeClassificacao = classificacao === "todas"
                || (transacao.tipo === "despesa" && transacao.classificacao === classificacao);
            const correspondeDataInicial = !dataInicial || transacao.data >= dataInicial;
            const correspondeDataFinal = !dataFinal || transacao.data <= dataFinal;

            return correspondePesquisa && correspondeTipo && correspondeCategoria && correspondeClassificacao && correspondeDataInicial && correspondeDataFinal;
        });

        let transacoesExibidas;

        if (tabelaDestino === listaTransacoesCompleta) {
            const totalPaginas = Math.max(
                1,
                Math.ceil(transacoesFiltradas.length / transacoesPorPagina)
            );
            totalPaginasTransacoes = totalPaginas;

            // Impede que a página atual ultrapasse a última disponível
            paginaAtual = Math.min(paginaAtual, totalPaginas);

            const inicio = (paginaAtual - 1) * transacoesPorPagina;
            const fim = inicio + transacoesPorPagina;

            transacoesExibidas = transacoesFiltradas.slice(inicio, fim);

            // Atualiza os controles
            infoPaginacao.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
            document.getElementById("total-resultados").textContent = disponibilidadeColecoes.colecaoEstaBloqueada("transacoes")
                ? "Dados indisponíveis"
                : `${transacoesFiltradas.length} ${transacoesFiltradas.length === 1 ? "transação" : "transações"}`;

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
            celula.textContent = disponibilidadeColecoes.colecaoEstaBloqueada("transacoes")
                ? "Dados de transações indisponíveis. Gravações bloqueadas nesta sessão."
                : "Nenhuma transação encontrada.";
            celula.classList.add("mensagem-sem-resultados");

            linha.appendChild(celula);
            tabelaDestino.appendChild(linha);
            if (tabelaDestino === listaTransacoesCompleta) sincronizarSelecaoPagina();
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
            checkbox.checked = transacoesSelecionadas.includes(transacao.id);

            if (tabelaDestino === listaTransacoesCompleta) {
                const rotuloSelecao = document.createElement("label");
                rotuloSelecao.className = "alvo-selecao";
                rotuloSelecao.appendChild(checkbox);
                celulaSelecao.appendChild(rotuloSelecao);
            } else {
                celulaSelecao.appendChild(checkbox);
            }
            linha.appendChild(celulaSelecao);

            escutarLinha(tabelaDestino, checkbox, "change", () => {
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
                ? disponibilidadeColecoes.consultarInvestimentos().find((item) => item.id === transacao.investimentoId) : null;
            celulaNome.textContent = tipoMovimento
                ? transacao.nome === `${tipoMovimento} - ${investimento?.nome}`
                    ? `${tipoMovimento} · ${investimento.nome}`
                    : `${tipoMovimento} · ${transacao.nome} (${investimento?.nome ?? "Investimento indisponível"})`
                : transacao.nome;
            checkbox.setAttribute("aria-label", `Selecionar ${celulaNome.textContent}`);
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
            const conta = disponibilidadeColecoes.consultarContas().find((conta) => conta.id === transacao.contaId);
            celulaConta.textContent = conta ? conta.nome : "Conta indisponível";
            linha.appendChild(celulaConta);

            const celulaValor = document.createElement("td");
            const sinal = movimentoBancarioCentavos(transacao) < 0 ? "-" : "+";
            celulaValor.textContent = `${sinal}${formatadorMoeda.format(transacao.valor)}`;
            celulaValor.classList.add(transacao.tipo);
            linha.appendChild(celulaValor);
            if (tabelaDestino === listaTransacoes) {
                linha.setAttribute("role", "row");
                ["selecao", "nome", "categoria", "data", "pagamento", "classificacao", "conta", "valor"].forEach((campo, indice) => {
                    linha.children[indice].classList.add(`recente-${campo}`);
                    linha.children[indice].setAttribute("role", "cell");
                });
                const rotuloSelecao = document.createElement("label");
                rotuloSelecao.className = "selecao-recente";
                rotuloSelecao.appendChild(checkbox);
                celulaSelecao.appendChild(rotuloSelecao);

                const categoriaDesktop = document.createElement("span");
                categoriaDesktop.className = "categoria-recente-desktop";
                categoriaDesktop.textContent = celulaCategoria.textContent;
                const contexto = document.createElement("span");
                contexto.className = "contexto-recente";
                const tipo = { receita: "Receita", despesa: "Despesa", aporte: "Aporte", resgate: "Resgate" }[transacao.tipo];
                const complemento = ehMovimentacaoInvestimento(transacao) ? celulaConta.textContent : transacao.categoria;
                contexto.textContent = `${tipo} · ${complemento}`;
                celulaCategoria.replaceChildren(categoriaDesktop, contexto);
            }
            if (tabelaDestino === listaTransacoesCompleta) {
                linha.setAttribute("role", "row");
                const nome = document.createElement("span");
                nome.className = "nome-transacao";
                nome.textContent = celulaNome.textContent;
                const tipo = document.createElement("span");
                tipo.className = `tipo-transacao tipo-${transacao.tipo}`;
                tipo.textContent = { receita: "Receita", despesa: "Despesa", aporte: "Aporte", resgate: "Resgate" }[transacao.tipo];
                celulaNome.replaceChildren(nome, tipo);
                ["selecionar", "nome", "categoria", "data", "pagamento", "classificacao", "conta", "valor"].forEach((campo, indice) => {
                    linha.children[indice].classList.add(`transacao-${campo}`);
                    linha.children[indice].setAttribute("role", "cell");
                });
                [[celulaCategoria, "Categoria"], [celulaPagamento, "Pagamento"], [celulaClassificacao, "Classificação"], [celulaConta, "Conta"]].forEach(([celula, rotulo]) => {
                    const texto = document.createElement("span");
                    texto.textContent = celula.textContent;
                    const label = document.createElement("span");
                    label.className = "rotulo-mobile";
                    label.textContent = rotulo;
                    label.setAttribute("aria-hidden", "true");
                    celula.replaceChildren(label, texto);
                });
                // A tabela desktop permanece completa; no mobile, agrupa apenas os dados aplicáveis.
                const complementos = document.createElement("div");
                complementos.className = "complementos-mobile";
                const movimentacao = ehMovimentacaoInvestimento(transacao);
                const dados = movimentacao
                    ? [[transacao.tipo === "aporte" ? "Origem" : "Destino", celulaConta.lastChild.textContent],
                        ["Investimento", investimento?.nome ?? "Investimento indisponível"]]
                    : [["Categoria", transacao.categoria], ["Conta", celulaConta.lastChild.textContent]];
                if (transacao.tipo === "despesa") {
                    dados.push(["Classificação", transacao.classificacao], ["Pagamento", transacao.pagamento]);
                }
                dados.forEach(([rotulo, valor]) => {
                    if (typeof valor !== "string" || !valor.trim() || valor.trim() === "-") return;
                    const detalhe = document.createElement("span");
                    const label = document.createElement("span");
                    label.className = "rotulo-complemento";
                    label.textContent = `${rotulo}: `;
                    detalhe.append(label, document.createTextNode(valor));
                    complementos.appendChild(detalhe);
                });
                celulaCategoria.appendChild(complementos);
                const tipoData = document.createElement("span");
                tipoData.className = "tipo-data-mobile";
                tipoData.textContent = `${tipo.textContent} · `;
                celulaData.prepend(tipoData);
                if (transacao.tipo === "resgate") {
                    const recebido = document.createElement("span");
                    recebido.className = "recebido-mobile";
                    recebido.textContent = "Recebido na conta";
                    celulaValor.appendChild(recebido);
                }
                linha.classList.toggle("selecionada", checkbox.checked);
            }
            tabelaDestino.appendChild(linha);
        })
        if (tabelaDestino === listaTransacoesCompleta) sincronizarSelecaoPagina();
    }

    function sincronizarCheckboxes() {
        document.querySelectorAll(".checkbox-transacao").forEach((checkbox) => {
            checkbox.checked = transacoesSelecionadas.includes(checkbox.value);
            checkbox.closest("tr").classList.toggle("selecionada", checkbox.checked);
        });
        sincronizarSelecaoPagina();
    }

    function sincronizarSelecaoPagina() {
        const controle = document.getElementById("selecionar-pagina");
        const caixas = [...listaTransacoesCompleta.querySelectorAll(".checkbox-transacao")];
        const selecionadas = caixas.filter((caixa) => caixa.checked).length;
        controle.disabled = caixas.length === 0;
        controle.checked = caixas.length > 0 && selecionadas === caixas.length;
        controle.indeterminate = selecionadas > 0 && selecionadas < caixas.length;
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
        atualizarBarraContextual();
    }

    function atualizarBarraContextual() {
        const temSelecaoMobile = larguraMobileTransacoes.matches && observadorBarraSuperior !== null && transacoesSelecionadas.length > 0
            && paginaTransacoes.classList.contains("ativa");
        const flutuante = temSelecaoMobile && !barraSuperiorVisivel;
        const focoAtual = document.activeElement;
        let proximoFoco = null;
        acoesContextuais.forEach((original, contextual) => {
            contextual.disabled = original.disabled || transacoesSelecionadas.length === 0;
            if (flutuante && focoAtual === original) proximoFoco = contextual;
            if (!flutuante && temSelecaoMobile && focoAtual === contextual) proximoFoco = original;
        });
        quantidadeContextual.textContent = quantidadeSelecionadasCompleta.textContent;
        barraAcoesCompleta.classList.toggle("acoes-superiores-ocultas", flutuante);
        barraAcoesCompleta.inert = flutuante || transacoesSelecionadas.length === 0;
        if (barraAcoesCompleta.inert) barraAcoesCompleta.setAttribute("aria-hidden", "true");
        else barraAcoesCompleta.removeAttribute("aria-hidden");
        barraContextual.classList.toggle("visivel", flutuante);
        barraContextual.inert = !flutuante;
        barraContextual.setAttribute("aria-hidden", String(!flutuante));
        paginaTransacoes.classList.toggle("tem-selecao-mobile", temSelecaoMobile);
        if (proximoFoco && !modais.obterModalAtivo() && !proximoFoco.disabled) {
            // Ao trocar a representação focada, não deixa o foco em controles ocultos.
            [barraAcoesCompleta, barraContextual].forEach((barra) => barra.classList.add("troca-foco-contextual"));
            proximoFoco.focus({ preventScroll: true });
            agendarFoco(() => {
                [barraAcoesCompleta, barraContextual].forEach((barra) => barra.classList.remove("troca-foco-contextual"));
            });
        }
    }

    function observarBarraSuperior() {
        if (!("IntersectionObserver" in window)) return; // Mantém a barra superior como alternativa.
        observadorBarraSuperior?.disconnect();
        observadorBarraSuperior = null;
        if (!larguraMobileTransacoes.matches) barraSuperiorVisivel = true;
        if (larguraMobileTransacoes.matches) {
            alturaNavegacaoAcoes = Math.ceil(navegacaoPrincipal.getBoundingClientRect().height);
            paginaTransacoes.style.setProperty("--altura-nav-acoes", `${alturaNavegacaoAcoes}px`);
            const observador = new IntersectionObserver(([entrada]) => {
                if (!inicializado || observador !== observadorBarraSuperior) return;
                barraSuperiorVisivel = entrada.isIntersecting && entrada.intersectionRatio >= .99;
                atualizarBarraContextual();
            }, { threshold: [0, .99, 1], rootMargin: `0px 0px -${alturaNavegacaoAcoes + 8}px 0px` });
            observadorBarraSuperior = observador;
            observadorBarraSuperior.observe(areaAcoesCompleta);
        }
        atualizarBarraContextual();
    }

    function cancelarTransicaoPaginacao() {
        if (!transicaoPaginacao) return;
        const anterior = transicaoPaginacao;
        transicaoPaginacao = null;
        anterior.animacoes.forEach((animacao) => animacao.cancel());
        anterior.animacaoAltura?.cancel();
        listaTransacoesCompleta.inert = anterior.inert;
        anterior.area.style.minHeight = anterior.alturaAnterior;
        anterior.area.style.height = anterior.alturaExplicitaAnterior;
        anterior.area.classList.remove("paginando-registros");
    }

    async function mudarPaginaTransacoes(direcao) {
        const destino = Math.max(1, Math.min(totalPaginasTransacoes, paginaAtual + direcao));
        if (destino === paginaAtual) return;
        cancelarTransicaoPaginacao();
        paginaAtual = destino;
        limparSelecao();
        const elementos = () => [...listaTransacoesCompleta.querySelectorAll(
            larguraMobileTransacoes.matches ? ":scope > tr" : "td"
        )];
        if (movimentoReduzidoPaginacao.matches || !paginaTransacoes.classList.contains("ativa")
            || !elementos().length || typeof elementos()[0].animate !== "function") {
            atualizarTabelaCompleta();
            return;
        }
        const area = listaTransacoesCompleta.closest(".tabela-transacoes");
        const estado = { area, alturaAnterior: area.style.minHeight,
            alturaExplicitaAnterior: area.style.height, alturaInicial: area.getBoundingClientRect().height,
            inert: listaTransacoesCompleta.inert, animacoes: [] };
        transicaoPaginacao = estado;
        area.style.minHeight = `${estado.alturaInicial}px`;
        area.classList.add("paginando-registros");
        if (listaTransacoesCompleta.contains(document.activeElement)) {
            (direcao > 0 ? botaoProximaPagina : botaoPaginaAnterior).focus({ preventScroll: true });
        }
        listaTransacoesCompleta.inert = true;
        const animar = (quadros, duracao) => {
            estado.animacoes = [];
            for (const elemento of elementos()) {
                const animacao = elemento.animate(quadros,
                    { duration: duracao, easing: "ease-out", fill: "both" });
                estado.animacoes.push(animacao);
                // Também cobre cancelamento se a criação de uma animação seguinte falhar.
                animacao.finished.catch(() => {});
            }
            return Promise.all(estado.animacoes.map((animacao) => animacao.finished));
        };
        try {
            await animar([{ opacity: 1, transform: "translateX(0)" },
                { opacity: 0, transform: `translateX(${-direcao * 8}px)` }], 100);
            if (transicaoPaginacao !== estado) return;
            atualizarTabelaCompleta(true);
            estado.animacoes.forEach((animacao) => animacao.cancel());
            // Mede o layout natural já com os novos registros, antes do próximo paint.
            area.style.minHeight = estado.alturaAnterior;
            area.style.height = estado.alturaExplicitaAnterior;
            // Inclui a barra de rolagem horizontal, quando o layout desktop precisar dela.
            area.classList.remove("paginando-registros");
            const alturaFinal = area.getBoundingClientRect().height;
            area.classList.add("paginando-registros");
            area.style.height = `${estado.alturaInicial}px`;
            let fimAltura = Promise.resolve();
            if (Math.abs(alturaFinal - estado.alturaInicial) > 0.5) {
                estado.animacaoAltura = area.animate([
                    { height: `${estado.alturaInicial}px` }, { height: `${alturaFinal}px` }
                ], { duration: 250, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" });
                fimAltura = estado.animacaoAltura.finished;
                fimAltura.catch(() => {});
            }
            await Promise.all([fimAltura,
                animar([{ opacity: 0, transform: `translateX(${direcao * 8}px)` },
                    { opacity: 1, transform: "translateX(0)" }], 180)]);
            if (transicaoPaginacao === estado) cancelarTransicaoPaginacao();
        } catch {
            // Cancelamentos antigos não podem sobrescrever uma navegação mais recente.
            if (transicaoPaginacao === estado) atualizarTabelaCompleta();
        }
    }

    function atualizarTabelaCompleta(preservarTransicao = false) {
        if (!preservarTransicao) cancelarTransicaoPaginacao();
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

        renderizarTransacoes(listaTransacoesCompleta, null, pesquisa, tipo, categoria, dataInicial, dataFinal, filtroClassificacao.value);
    }

    function atualizarCategorias() {
        const categoriaAtual = filtroCategoria.value;

        const categorias = [...new Set(
            disponibilidadeColecoes.consultarTransacoes().filter((transacao) => !ehMovimentacaoInvestimento(transacao))
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

    function prepararClassificacoes() {
        if (classificacoesPreparadas) return;
        classificacoesPreparadas = true;
        Object.entries(CLASSIFICACOES_DESPESAS).forEach(([id, definicao]) => {
            const opcao = document.createElement("option");
            opcao.value = id;
            opcao.textContent = definicao.nome;
            filtroClassificacao.appendChild(opcao);
        });
    }

    function inicializar() {
        if (inicializado) return;
        inicializado = true;
        escutar(movimentoReduzidoPaginacao, "change", () => {
            if (movimentoReduzidoPaginacao.matches && transicaoPaginacao) atualizarTabelaCompleta();
        });
        escutar(window, "resize", () => {
            if (transicaoPaginacao) atualizarTabelaCompleta();
        }, { passive: true });
        escutar(campoPesquisa, "input", aplicarFiltros);
        escutar(document.getElementById("selecionar-pagina"), "change", (evento) => {
            const selecionar = evento.target.checked;
            listaTransacoesCompleta.querySelectorAll(".checkbox-transacao").forEach((caixa) => {
                caixa.checked = selecionar;
                caixa.dispatchEvent(new Event("change"));
            });
        });
        escutar(document.getElementById("limpar-selecao-completa"), "click", () => {
            const veioDaContextual = barraContextual.contains(document.activeElement);
            const destino = veioDaContextual ? [...listaTransacoesCompleta.querySelectorAll("input"),
                botaoPaginaAnterior, botaoProximaPagina, campoPesquisa].find((elemento) => {
                const posicao = elemento.getBoundingClientRect();
                return !elemento.disabled && posicao.height > 0 && posicao.top >= 0
                    && posicao.bottom <= window.innerHeight - alturaNavegacaoAcoes - 110;
            }) : null;
            limparSelecao();
            if (destino) destino.focus({ preventScroll: true });
            else document.getElementById("selecionar-pagina").focus();
        });
        escutar(filtroTipo, "change", aplicarFiltros);
        escutar(filtroCategoria, "change", aplicarFiltros);
        escutar(filtroClassificacao, "change", aplicarFiltros);
        escutar(filtroDataInicial, "change", aplicarFiltros);
        escutar(filtroDataFinal, "change", aplicarFiltros);

        escutar(botaoLimparFiltros, "click", () => {
            campoPesquisa.value = "";
            filtroTipo.value = "todos";
            filtroCategoria.value = "todas";
            filtroClassificacao.value = "todas";

            filtroDataInicial.value = "";
            filtroDataFinal.value = "";
            aplicarFiltros();
        });

        escutar(botaoPaginaAnterior, "click", () => {
            mudarPaginaTransacoes(-1);
        });

        escutar(botaoProximaPagina, "click", () => {
            mudarPaginaTransacoes(1);
        });

        escutar(larguraMobileTransacoes, "change", ({ matches }) => {
            const primeiroIndice = (paginaAtual - 1) * transacoesPorPagina;
            transacoesPorPagina = matches ? 6 : 8;
            paginaAtual = Math.floor(primeiroIndice / transacoesPorPagina) + 1;
            // A lista visível muda de bloco; o Resumo mantém seus cinco registros e a seleção.
            if (document.getElementById("pagina-transacoes").classList.contains("ativa")) limparSelecao();
            atualizarTabelaCompleta();
            observarBarraSuperior();
        });

        [botaoEditar, botaoEditarCompleta].forEach((botao) => escutar(botao, "click", () => aoEditar()));
        [botaoExcluir, botaoExcluirCompleta].forEach((botao) => escutar(botao, "click", () => aoExcluir()));
        acoesContextuais.forEach((original, contextual) => {
            escutar(contextual, "click", () => original.click());
        });
        observarBarraSuperior();
        if ("ResizeObserver" in window) {
            observadorDimensoesAcoes = new ResizeObserver((entradas) => {
                if (!inicializado) return;
                for (const entrada of entradas) {
                    if (entrada.target === navegacaoPrincipal && larguraMobileTransacoes.matches
                        && Math.ceil(navegacaoPrincipal.getBoundingClientRect().height) !== alturaNavegacaoAcoes) {
                        observarBarraSuperior();
                    }
                }
            });
            observadorDimensoesAcoes.observe(navegacaoPrincipal);
        }
    }

    function concluirPaginacaoSeAtiva() {
        if (transicaoPaginacao) atualizarTabelaCompleta();
    }

    function encerrar() {
        cancelarTransicaoPaginacao();
        removerListeners.splice(0).forEach((remover) => remover());
        for (const remover of listenersLinhas.values()) remover.forEach((acao) => acao());
        listenersLinhas.clear();
        observadorBarraSuperior?.disconnect();
        observadorBarraSuperior = null;
        observadorDimensoesAcoes?.disconnect();
        observadorDimensoesAcoes = null;
        for (const quadro of quadrosFoco) window.cancelAnimationFrame(quadro);
        quadrosFoco.clear();
        [barraAcoesCompleta, barraContextual].forEach((barra) => barra.classList.remove("troca-foco-contextual"));
        inicializado = false;
    }

    return { inicializar, prepararClassificacoes, renderizarTransacoes, atualizarTabelaCompleta,
        atualizarCategorias, limparSelecao, atualizarBarraAcoes, concluirPaginacaoSeAtiva,
        consultarSelecao: () => [...transacoesSelecionadas],
        // Os coordenadores preservam a ordem atual: trocar IDs e só depois renderizar/atualizar ações.
        definirSelecao: (ids) => { transacoesSelecionadas = [...ids]; }, encerrar };
}
