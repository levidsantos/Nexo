import { INDICADORES } from '../dominio/indicadores-economicos.js';

export function criarIndicadoresEconomicos({ document, cache, obterChart = () => globalThis.Chart, obterEstilo = elemento => globalThis.getComputedStyle(elemento), ambiente = globalThis }) {
    let carregamento;
    let grafico, selecao = 'selic', meses = 12, versao = 0, resultadoAtual, inicializado = false;
    const seletor = document.getElementById('selecao-indicador');
    const periodo = document.getElementById('periodo-indicador');
    const mensagem = document.getElementById('estado-historico-indicador');
    const canvas = document.getElementById('grafico-indicadores');
    const tabela = document.getElementById('valores-historico-indicador');
    const movimentoReduzido = ambiente.matchMedia?.('(prefers-reduced-motion: reduce)');
    let quadro = null, progresso = 1, ultimaApresentacao = '', dimensoes;
    const recortes = new WeakSet();
    const podeAnimar = () => !movimentoReduzido?.matches && typeof ambiente.requestAnimationFrame === 'function' && !document.hidden;
    function concluirAnimacao(redesenhar = true) {
        if (quadro !== null) ambiente.cancelAnimationFrame(quadro);
        quadro = null;
        progresso = 1;
        if (!grafico) return;
        try {
            grafico.stop?.();
            grafico.options.animation = false;
            if (redesenhar) grafico.update('none');
        } catch { /* O próximo desenho usa a recuperação existente. */ }
    }
    const formacaoIndicadores = {
        id: 'formacaoIndicadoresEconomicos',
        beforeDatasetsDraw(instancia) {
            if (progresso >= 1 || instancia.config.type !== 'line' || !instancia.chartArea) return;
            const {ctx, chartArea: area} = instancia;
            ctx.save();
            try {
                ctx.beginPath();
                ctx.rect(area.left, area.top, (area.right - area.left) * progresso, area.bottom - area.top);
                ctx.clip();recortes.add(instancia);
            } catch { ctx.restore(); }
        },
        afterDatasetsDraw(instancia) {
            if (recortes.delete(instancia)) instancia.ctx.restore();
        },
        resize(instancia, {size}) {
            if (instancia === grafico && dimensoes && (size.width !== dimensoes.width || size.height !== dimensoes.height)) concluirAnimacao(false);
            dimensoes = {width:size.width, height:size.height};
        }
    };
    function revelarLinha(instancia) {
        let inicio;
        const avancar = tempo => {
            if (grafico !== instancia) return;
            if (!podeAnimar() || document.getElementById('pagina-indicadores')?.classList?.contains('ativa') === false) { concluirAnimacao(); return; }
            inicio ??= tempo;
            const fracao = Math.min(1, (tempo - inicio) / 600);
            progresso = 1 - Math.pow(1 - fracao, 3);
            try { instancia.draw(); } catch { concluirAnimacao(false); return; }
            quadro = fracao < 1 ? ambiente.requestAnimationFrame(avancar) : null;
        };
        quadro = ambiente.requestAnimationFrame(avancar);
    }
    const dataReferencia = (data, mensal) => new Intl.DateTimeFormat('pt-BR', mensal ? { month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${data}T12:00:00`));
    function apresentar(chave, resultado) {
        const alvo = document.getElementById(`indicador-${chave}`);
        alvo.replaceChildren();
        const adicionar = (tag, texto, classe) => {
            const elemento = document.createElement(tag);
            elemento.textContent = texto;
            if (classe) elemento.className = classe;
            alvo.appendChild(elemento);
        };
        if (resultado.estado === 'indisponivel') {
            adicionar('p', 'Dados indisponíveis. Tente novamente mais tarde.', 'estado-indicador');
            return;
        }
        const indicador = INDICADORES[chave];
        const numero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: chave === 'dolar' ? 4 : 2, maximumFractionDigits: chave === 'dolar' ? 4 : 2 }).format(Number(resultado.observacao.valor));
        adicionar('p', numero, chave === 'ipca12' ? 'valor-indicador-complementar' : 'valor-indicador');
        adicionar('p', indicador.unidade, 'unidade-indicador');
        adicionar('p', `Referência: ${dataReferencia(resultado.observacao.data, indicador.mensal)}`);
        adicionar('p', `Consultado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(resultado.consultadoEm))}`, 'consulta-indicador');
        if (resultado.estado === 'anterior') adicionar('p', 'Dados anteriores em cache. Não foi possível atualizar.', 'estado-indicador');
    }
    async function carregar() {
        if (seletor && !inicializado) inicializar();
        if (seletor) void carregarHistorico();
        if (carregamento) return carregamento;
        carregamento = Promise.all(Object.keys(INDICADORES).map(async chave => apresentar(chave, await cache.obter(chave))));
        try { await carregamento; } finally { carregamento = null; }
    }
    function destruir() {
        concluirAnimacao(false);
        const instancia = grafico;
        grafico = null;
        try { (instancia || obterChart()?.getChart?.(canvas))?.destroy(); } catch { /* A alternativa textual continua disponível. */ }
    }
    function pontosAtuais() {
        return (resultadoAtual?.dados ?? []).map(p => ({ data: p.data.split('/').reverse().join('-'), valor: Number(p.valor) }));
    }
    function formatarValor(valor) {
        return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: selecao === 'dolar' ? 4 : 2 }).format(valor)} ${INDICADORES[selecao].unidade}`;
    }
    function desenhar(animarMudanca = false) {
        if (!canvas || !resultadoAtual || resultadoAtual.estado === 'indisponivel') return;
        if (document.getElementById('pagina-indicadores')?.classList?.contains('ativa') === false) return;
        const pontos = pontosAtuais();
        if (!pontos.length) return;
        const assinatura = JSON.stringify([selecao, meses, pontos]);
        const animar = animarMudanca && (!grafico || assinatura !== ultimaApresentacao) && podeAnimar();
        concluirAnimacao(false);
        const indicador = INDICADORES[selecao];
        const estilo = obterEstilo(document.body);
        const cor = estilo.getPropertyValue('--nexo-primaria').trim() || '#6840b5';
        const texto = estilo.getPropertyValue('--nexo-texto-secundario').trim() || '#6d6278';
        const borda = estilo.getPropertyValue('--nexo-borda').trim() || '#ded9e5';
        const mensal = indicador.mensal;
        const tipo = selecao === 'ipca' ? 'bar' : 'line';
        const instante = data => Date.parse(`${data}T12:00:00Z`);
        const dataCurta = valor => {
            const data = new Date(valor);
            return mensal
                ? new Intl.DateTimeFormat('pt-BR', {timeZone:'UTC',month:'short'}).format(data).replace('.', '') + '/' + String(data.getUTCFullYear()).slice(-2)
                : new Intl.DateTimeFormat('pt-BR', {timeZone:'UTC',day:'2-digit',month:'2-digit',year:'2-digit'}).format(data);
        };
        const dataset = { label: indicador.titulo, data: pontos.map(p => ({x: instante(p.data), y:p.valor})),
            borderColor: cor, backgroundColor: cor, borderWidth: tipo === 'bar' ? 0 : 2,
            stepped: selecao === 'selic' ? 'after' : false, tension: 0,
            pointRadius: pontos.length === 1 ? 3 : 0, pointHoverRadius: 4, pointHitRadius: 12,
            maxBarThickness: 28, spanGaps: false,
            segment: { borderColor: contexto => contexto.p1.parsed.x - contexto.p0.parsed.x > (mensal ? 45 : 4) * 86400000 ? 'transparent' : cor }
        };
        // Eixo numérico de datas evita depender de adaptadores de calendário externos.
        const configuracao = { type: tipo, plugins: [formacaoIndicadores], data: { datasets: [dataset] }, options: {
            responsive: true, maintainAspectRatio: false, animation: animar && tipo === 'bar' ? {
                duration: 600, easing: 'easeOutCubic',
                onComplete: ({chart}) => { chart.options.animation = false; }
            } : false,
            animations: animar && tipo === 'bar' ? {
                x: {duration:0}, base: {duration:0}, colors: {duration:0},
                y: {type:'number', duration:600, easing:'easeOutCubic', from:contexto=>contexto.chart.scales.y.getPixelForValue(0)}
            } : {}, parsing: false,
            interaction: {mode: 'nearest', axis: 'x', intersect: false},
            onResize: instancia => { instancia.options.scales.x.ticks.maxTicksLimit = instancia.width < 500 ? 4 : 6; },
            plugins: { legend: {display:false}, tooltip: { callbacks: {
                title: itens => itens.length ? dataReferencia(new Date(itens[0].parsed.x).toISOString().slice(0,10), mensal) : '',
                label: item => formatarValor(item.parsed.y)
            } } },
            scales: { x: {type:'linear', bounds:'data', offset:tipo==='bar', grid:{display:false}, border:{color:borda},
                afterBuildTicks: eixo => {
                    // Os rótulos também correspondem a observações reais, inclusive nas séries diárias.
                    const limite = eixo.chart.width < 500 ? 4 : 6;
                    const indices = new Set(Array.from({length:Math.min(limite,pontos.length)},(_,i)=>Math.round(i*(pontos.length-1)/Math.max(1,Math.min(limite,pontos.length)-1))));
                    eixo.ticks = [...indices].map(i=>({value:instante(pontos[i].data)}));
                }, ticks:{color:texto,maxRotation:0,maxTicksLimit:6,callback:dataCurta} },
                y: {beginAtZero:tipo==='bar', grid:{color:borda}, border:{display:false}, ticks:{color:texto,maxTicksLimit:6,callback:valor=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:selecao==='dolar'?4:2}).format(valor)},title:{display:true,text:indicador.unidade,color:texto}}
            }
        } };
        try {
            if (typeof obterChart() !== 'function') throw new Error('Chart indisponível');
            canvas.hidden = false;
            progresso = animar && tipo === 'line' ? 0 : 1;
            if (grafico) {
                grafico.config.type = tipo;
                grafico.data = configuracao.data;
                grafico.options = configuracao.options;
                grafico.update(animar && tipo === 'bar' ? undefined : 'none');
            } else grafico = new (obterChart())(canvas, configuracao);
            canvas.hidden = false;
            ultimaApresentacao = assinatura;
            if (animar && tipo === 'line') { progresso = 0; revelarLinha(grafico); }
        } catch {
            destruir(); canvas.hidden = true;
            mensagem.textContent = `${resultadoAtual.estado === 'anterior' ? 'Dados anteriores em cache. ' : ''}Gráfico indisponível. Consulte os valores na tabela abaixo.`;
        }
    }
    function apresentarHistorico(resultado) {
        resultadoAtual = resultado;
        tabela.replaceChildren();
        if (resultado.estado === 'indisponivel') {
            destruir(); canvas.hidden = true;
            mensagem.textContent = 'Não foi possível consultar o histórico. Tente novamente mais tarde.';
            return;
        }
        const pontos = pontosAtuais();
        const indicador = INDICADORES[selecao];
        canvas.setAttribute('aria-label', `${indicador.titulo} — ${indicador.unidade}`);
        mensagem.textContent = !pontos.length ? 'Nenhuma observação disponível neste intervalo.' : resultado.estado === 'anterior' ? 'Dados anteriores em cache. Não foi possível atualizar.' : '';
        document.getElementById('referencia-historico-indicador').textContent = `Intervalo consultado: ${dataReferencia(resultado.inicio,false)} — ${dataReferencia(resultado.fim,false)}. ${pontos.length ? `Última referência: ${dataReferencia(pontos.at(-1).data,indicador.mensal)}. ` : ''}Consultado em ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(resultado.consultadoEm))}.`;
        for (const ponto of pontos) {
            const linha = document.createElement('tr'), data = document.createElement('th'), valor = document.createElement('td');
            data.scope = 'row'; data.textContent = dataReferencia(ponto.data,indicador.mensal); valor.textContent = formatarValor(ponto.valor);
            linha.appendChild(data);linha.appendChild(valor);tabela.appendChild(linha);
        }
        if (!pontos.length) {destruir();canvas.hidden=true;return;}
        desenhar(true);
    }
    async function carregarHistorico() {
        const atual = ++versao;
        concluirAnimacao();
        resultadoAtual = null;
        canvas.hidden = true;
        tabela.replaceChildren();
        mensagem.textContent = 'Consultando histórico…';
        document.getElementById('referencia-historico-indicador').textContent = '';
        const indicador = INDICADORES[selecao];
        document.getElementById('contexto-historico-indicador').textContent = indicador.contexto;
        const fonte = document.getElementById('fonte-historico-indicador');
        fonte.href = `https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?method=consultarGraficoPorId&hdOidSeriesSelecionadas=${indicador.codigo}`;
        fonte.textContent = `Fonte: ${indicador.mensal ? 'IBGE via ' : ''}Banco Central · SGS ${indicador.codigo}`;
        const resultado = await cache.obter(selecao,meses);
        if (atual !== versao) return;
        apresentarHistorico(resultado);
    }
    function preencherPeriodos() {
        periodo.replaceChildren();
        for (const quantidade of INDICADORES[selecao].periodos) {
            const opcao=document.createElement('option');opcao.value=String(quantidade);opcao.textContent=`${quantidade} ${quantidade === 1 ? 'mês' : 'meses'}`;periodo.appendChild(opcao);
        }
        periodo.value=String(meses);
    }
    function inicializar() {
        if (inicializado || !seletor) return;
        inicializado=true;preencherPeriodos();
        movimentoReduzido?.addEventListener('change', () => { if (movimentoReduzido.matches) concluirAnimacao(); });
        document.addEventListener?.('visibilitychange', () => { if (document.hidden) concluirAnimacao(); });
        seletor.addEventListener('change',()=>{selecao=seletor.value;meses=INDICADORES[selecao].padrao;preencherPeriodos();void carregarHistorico();});
        periodo.addEventListener('change',()=>{meses=Number(periodo.value);void carregarHistorico();});
    }
    return { carregar, atualizarAparencia: () => { concluirAnimacao(false); desenhar(); }, concluirAnimacao };
}
