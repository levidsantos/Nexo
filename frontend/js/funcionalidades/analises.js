import { dataValida, obterDataLocal, formatarCentavos, formatadorMoeda } from "../dominio/valores-datas.js";
import { definirPeriodoDespesas, distribuicaoDespesasIndisponivel } from "../dominio/calculos.js";
import { mostrarErro, limparErroCampo } from "../ui/formularios.js";

// Controlador visual único dos gráficos de Análises e do histórico compacto do Resumo.
export function criarAnalises({ document, window, elementos, botoesDuracao,
    obterHistoricoMensal, obterDistribuicaoDespesas, obterChart,
    movimentoReduzidoGraficos }) {
    const obterElemento = (id) => elementos[id];
    let inicializado = false;
    let observador = null;
    const removerListeners = [];
    function escutar(alvo, tipo, callback, opcoes) {
        alvo.addEventListener(tipo, callback, opcoes);
        removerListeners.push(() => alvo.removeEventListener(tipo, callback, opcoes));
    }
    let duracaoHistoricoAnalises = 6;
    let mesFinalHistoricoAnalises = null;
    const graficosHistorico = { resumo: null, analises: null };
    let graficoDistribuicao = null;
    // Estado visual da sessão: a criação de uma instância oculta não consome a entrada.
    const formacoesAnalises = {
        resumo: { exibido: false, ultimoInicio: null, iniciou: false, quadro: null, grafico: null, inicio: null, progresso: 1, geracao: 0, assinatura: null },
        historico: { exibido: false, ultimoInicio: null, iniciou: false, quadro: null, grafico: null, inicio: null, progresso: 1, geracao: 0 },
        distribuicao: { exibido: false, ultimoInicio: null, iniciou: false, quadro: null, grafico: null, inicio: null, progresso: 1, geracao: 0 }
    };
    const recortesFormacaoAnalises = new WeakSet();

    function corAparencia(nome, padrao) {
        return window.getComputedStyle?.(document.body).getPropertyValue(nome).trim() || padrao;
    }

    function aplicarAparenciaGrafico(grafico, compacto = false) {
        const opcoes = grafico.options;
        const historico = Boolean(opcoes.scales?.x);
        const tooltip = opcoes.plugins.tooltip;
        Object.assign(tooltip, {
            backgroundColor: corAparencia("--grafico-tooltip-fundo", historico && !compacto ? "#302738" : "rgba(0, 0, 0, 0.8)"),
            titleColor: corAparencia("--grafico-tooltip-texto", "#fff"),
            bodyColor: corAparencia("--grafico-tooltip-texto", "#fff")
        });
        if (historico) {
            const texto = corAparencia("--grafico-texto", compacto ? "#666" : "#6d6278");
            opcoes.scales.x.ticks.color = texto;
            opcoes.scales.y.ticks.color = texto;
            opcoes.scales.x.border = { ...opcoes.scales.x.border,
                color: corAparencia("--grafico-borda-eixo", "rgba(0, 0, 0, 0.1)") };
            opcoes.scales.y.grid.color = corAparencia("--grafico-grade", compacto ? "#edf0f5" : "#eeeaf3");
            opcoes.plugins.legend.labels.color = corAparencia("--grafico-legenda", compacto ? "#666" : "#62566f");
        } else {
            grafico.data.datasets[0].borderColor = corAparencia("--grafico-borda-rosca", "#ffffff");
        }
    }

    function atualizarAparenciaGraficos() {
        concluirFormacoesAnalises();
        for (const [grafico, compacto] of [[graficosHistorico.resumo, true], [graficosHistorico.analises, false], [graficoDistribuicao, false]]) {
            if (!grafico) continue;
            try {
                aplicarAparenciaGrafico(grafico, compacto);
                grafico.update("none");
            } catch { /* Uma falha visual não pode interromper a troca de tema. */ }
        }
    }

    function restaurarRecorteFormacao(grafico) {
        if (recortesFormacaoAnalises.delete(grafico)) grafico.ctx.restore();
    }

    function graficoDaFormacao(chave) {
        if (chave === "distribuicao") return graficoDistribuicao;
        return chave === "resumo" ? graficosHistorico.resumo : graficosHistorico.analises;
    }

    // Apenas a entrada na seção pode liberar uma repetição, nunca uma atualização de dados.
    function prepararFormacoesPagina(pagina) {
        const agora = window.performance.now();
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
        estado.geracao++;
        if (estado.quadro !== null) window.cancelAnimationFrame(estado.quadro);
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
        if (!inicializado || !("IntersectionObserver" in window)) return;
        const estado = formacoesAnalises[chave];
        const grafico = graficoDaFormacao(chave);
        if (estado.exibido || estado.quadro !== null || !formacaoEstaVisivel(grafico)) return;
        estado.grafico = grafico;
        const duracao = chave === "historico" ? 500 : 450;
        const geracao = estado.geracao;
        const desenhar = (tempo) => {
            if (estado.geracao !== geracao || !inicializado) return;
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
                estado.ultimoInicio = tempo; // Mesmo relógio monotônico de window.performance.now().
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
            if (fracao < 1) estado.quadro = window.requestAnimationFrame(desenhar);
            else finalizarFormacaoAnalises(chave);
        };
        estado.quadro = window.requestAnimationFrame(desenhar);
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
        const observadorAtual = new window.IntersectionObserver((entradas) => {
            if (!inicializado || observador !== observadorAtual) return;
            for (const entrada of entradas) {
                const chave = entrada.target.id === "area-historico-resumo" ? "resumo"
                    : entrada.target.id === "area-historico-analises" ? "historico" : "distribuicao";
                if (entrada.isIntersecting) agendarFormacaoAnalises(chave);
                else finalizarFormacaoAnalises(chave, true);
            }
        });
        observador = observadorAtual;
        ["area-historico-resumo", "area-historico-analises", "area-distribuicao"]
            .forEach((id) => observador.observe(obterElemento(id)));
        escutar(movimentoReduzidoGraficos, "change", () => {
            if (movimentoReduzidoGraficos.matches) concluirFormacoesAnalises();
        });
    }

    function configurarGraficoDistribuicao(classificacoes) {
        const configuracao = {
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
        aplicarAparenciaGrafico(configuracao);
        return configuracao;
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
            const grafico = instancia || obterChart()?.getChart?.(canvas);
            if (grafico) grafico.destroy();
            return true;
        } catch (erro) {
            // A falha visual não pode interromper operações já persistidas.
            return false;
        }
    }

    function limparGraficoDistribuicao() {
        const canvas = obterElemento("grafico-distribuicao");
        obterElemento("area-distribuicao").hidden = true;
        const instancia = graficoDistribuicao;
        graficoDistribuicao = null;
        destruirInstanciaGrafico(canvas, instancia);
    }

    function atualizarDistribuicaoDespesas() {
        finalizarFormacaoAnalises("distribuicao");
        const tipo = obterElemento("periodo-distribuicao").value;
        const inicial = obterElemento("mes-inicial-distribuicao");
        const final = obterElemento("mes-final-distribuicao");
        const estado = obterElemento("estado-distribuicao");
        const total = obterElemento("total-distribuicao");
        const intervalo = obterElemento("intervalo-distribuicao");
        const legenda = obterElemento("legenda-distribuicao");
        obterElemento("meses-distribuicao").hidden = tipo !== "personalizado";
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
        obterElemento("valor-total-distribuicao").textContent = distribuicao.disponivel
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
            if (typeof obterChart() !== "function") {
                mensagem = "Gráfico indisponível: não foi possível carregar a biblioteca. Os valores estão disponíveis na legenda.";
            } else {
                try {
                    obterElemento("area-distribuicao").hidden = false;
                    const configuracao = configurarGraficoDistribuicao(itens);
                    if (graficoDistribuicao) {
                        graficoDistribuicao.data = configuracao.data;
                        graficoDistribuicao.options = configuracao.options;
                        graficoDistribuicao.update("none");
                        graficoDistribuicao.resize();
                    } else {
                        const canvas = obterElemento("grafico-distribuicao");
                        if (!destruirInstanciaGrafico(canvas)) throw new Error("Não foi possível liberar o gráfico anterior.");
                        graficoDistribuicao = new (obterChart())(canvas, configuracao);
                    }
                } catch (erro) {
                    mensagem = "Gráfico indisponível: não foi possível renderizar a distribuição. Consulte os valores na legenda.";
                }
            }
        }
        if (mensagem) limparGraficoDistribuicao();
        estado.textContent = mensagem;
        // Se a visita começou sem gráfico válido, novos lançamentos continuam instantâneos.
        if (mensagem && obterElemento("grafico-distribuicao").closest(".pagina").classList.contains("ativa")) {
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
                ctx.strokeStyle = corAparencia("--grafico-guia", "#d8d2df");
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
        aplicarAparenciaGrafico(configuracao, compacto);
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
        const area = obterElemento(`area-historico-${destino}`);
        const estado = obterElemento(`estado-historico-${destino}`);
        const periodo = obterElemento(`periodo-historico-${destino}`);
        const descricao = obterElemento(`dados-historico-${destino}`);
        const canvas = obterElemento(`grafico-historico-${destino}`);
        let mensagem = !historico.disponivel ? `Histórico indisponível. ${historico.motivo}`
            : historico.vazio ? "Nenhuma transação até a data atual para exibir no histórico."
            : typeof obterChart() !== "function" ? "Gráfico indisponível: não foi possível carregar a biblioteca. Verifique sua conexão e recarregue a página." : "";

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
                    graficosHistorico[destino] = new (obterChart())(canvas, configuracao);
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
        const seletor = obterElemento("mes-final-historico");
        const disponivel = historico.disponivel && !historico.vazio;
        botoesDuracao.forEach((botao) => {
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

    function inicializar() {
        if (inicializado) return;
        inicializado = true;
        // Um único listener atende as instâncias atuais, sem listeners retidos após destroy().
        escutar(document, "pointerdown", (evento) => {
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

        botoesDuracao.forEach((botao) => {
            escutar(botao, "click", () => {
                duracaoHistoricoAnalises = Number(botao.dataset.duracaoHistorico);
                atualizarGraficosHistorico();
            });
        });
        escutar(obterElemento("mes-final-historico"), "change", (evento) => {
            mesFinalHistoricoAnalises = evento.target.value;
            atualizarGraficosHistorico();
        });

        const mesAtualDistribuicao = obterDataLocal().slice(0, 7);
        obterElemento("mes-inicial-distribuicao").value = mesAtualDistribuicao;
        obterElemento("mes-final-distribuicao").value = mesAtualDistribuicao;
        ["periodo-distribuicao", "mes-inicial-distribuicao", "mes-final-distribuicao"].forEach((id) => {
            escutar(obterElemento(id), "change", atualizarDistribuicaoDespesas);
        });

        observarFormacoesAnalises();
    }
    function encerrar() {
        inicializado = false;
        observador?.disconnect();
        observador = null;
        for (const remover of removerListeners.splice(0)) remover();
        concluirFormacoesAnalises();
        for (const destino of ["resumo", "analises"]) {
            const grafico = graficosHistorico[destino];
            graficosHistorico[destino] = null;
            destruirInstanciaGrafico(obterElemento(`grafico-historico-${destino}`), grafico);
        }
        limparGraficoDistribuicao();
    }
    return { inicializar, atualizarGraficosHistorico, atualizarDistribuicaoDespesas, atualizarAparenciaGraficos,
        prepararFormacoesPagina, concluirFormacoesAnalises, agendarFormacaoAnalises, encerrar };
}
