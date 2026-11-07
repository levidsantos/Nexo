'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { criarApresentacaoInvestimentos } = require('../../frontend/js/funcionalidades/investimentos.js');
const valores = require('../../frontend/js/dominio/valores-datas.js');
const { investimento, aporte, resgate, congelar } = require('./support/fixtures.cjs');

// Double da árvore e dos eventos utilizados; não simula CSS/layout do navegador.
function eventos(obj = {}) {
    const listeners = new Map();
    return Object.assign(obj, { listeners,
        addEventListener(tipo, fn) { if (!listeners.has(tipo)) listeners.set(tipo, new Set()); listeners.get(tipo).add(fn); },
        removeEventListener(tipo, fn) { listeners.get(tipo)?.delete(fn); },
        emitir(tipo, evento = {}) { for (const fn of [...listeners.get(tipo) ?? []]) fn(evento); },
        quantidade() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); }
    });
}
function ambiente(t, reduzido = true) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const document = eventos({ activeElement: null });
    function elemento(tag = 'div') {
        const classes = new Set(); let texto = '';
        const e = eventos({ tag, dataset: {}, children: [], atributos: {}, parentElement: null, open: false, inert: false,
            retangulo: { top: 100, bottom: 130, height: 80 },
            classList: { add: (...ns) => ns.forEach(n => classes.add(n)), remove: (...ns) => ns.forEach(n => classes.delete(n)),
                contains: n => classes.has(n), toggle(n, on = !classes.has(n)) { if (on) classes.add(n); else classes.delete(n); return on; } },
            append(...filhos) { for (const f of filhos) { this.children.push(f); if (typeof f !== 'string') f.parentElement = this; } },
            appendChild(f) { this.append(f); return f; },
            replaceChildren(...filhos) { this.children.forEach(f => { if (typeof f !== 'string') f.parentElement = null; }); this.children = []; texto = ''; this.append(...filhos); },
            setAttribute(k, v) { this.atributos[k] = v; }, getAttribute(k) { return this.atributos[k] ?? null; },
            matches(sel) { const aberto = sel.endsWith('[open]'); if (aberto && !this.open) return false;
                sel = sel.replace('[open]', '');
                const dado = sel.match(/^\[data-acao="(.+)"\]$/); if (dado) return this.dataset.acao === dado[1];
                return sel.startsWith('.') ? this.classList.contains(sel.slice(1)) : this.tag === sel;
            },
            closest(sel) { return this.matches(sel) ? this : this.parentElement?.closest(sel) ?? null; },
            querySelectorAll(sel) { const resultado = []; for (const f of this.children) if (typeof f !== 'string') { if (f.matches(sel)) resultado.push(f); resultado.push(...f.querySelectorAll(sel)); } return resultado; },
            querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; },
            contains(f) { return f === this || this.children.some(c => typeof c !== 'string' && c.contains(f)); },
            focus() { document.activeElement = this; },
            getBoundingClientRect() { return this.retangulo; }
        });
        Object.defineProperty(e, 'className', { get: () => [...classes].join(' '), set: v => { classes.clear(); v.split(/\s+/).filter(Boolean).forEach(n => classes.add(n)); } });
        Object.defineProperty(e, 'textContent', { get: () => texto + e.children.map(c => typeof c === 'string' ? c : c.textContent).join(''), set: v => { texto = v; e.children = []; } });
        return e;
    }
    document.createElement = elemento;
    const window = eventos({ innerHeight: 900 }), movimento = eventos({ matches: reduzido }), mobile = { matches: false };
    const refs = Object.fromEntries(['listaInvestimentos', 'historicoInvestimentos', 'totalCapital', 'totalValor', 'botaoNovoInvestimento', 'navegacaoPrincipal'].map(n => [n, elemento()]));
    const chamadas = [], retornos = []; let modal = null;
    const opcoes = { document, window, ...refs, ...valores, formatarDataInvestimento: data => data.split('-').reverse().join('/'),
        larguraMobileTransacoes: mobile, movimentoReduzidoMenus: movimento, obterModalAtivo: () => modal,
        definirFocoRetorno: alvo => retornos.push(alvo), acoes: Object.fromEntries(['aporte', 'resgate', 'atualizar', 'editar', 'excluir'].map(n => [n, id => chamadas.push([n, id])])) };
    const ui = criarApresentacaoInvestimentos(opcoes); t.after(() => ui.encerrar());
    const acompanhamento = { totalCapitalCentavos: 10000, capitais: { disponivel: true, capitaisPorInvestimentoCentavos: new Map([[investimento().id, 10000]]) }, valores: { disponivel: true, totalValorCentavos: 12000, valoresPorInvestimento: new Map([[investimento().id, { disponivel: true, valorCentavos: 12000 }]]) } };
    const renderizar = (lista = [investimento()], extras = {}) => ui.renderizarCards({ investimentos: lista, indisponivel: false, acompanhamento, restricaoMovimentacao: null, ...extras });
    const menu = () => refs.listaInvestimentos.querySelector('.gerenciar-investimento');
    const clicar = alvo => { const evento = { target: alvo, preventDefault() { this.defaultPrevented = true; } }; alvo.emitir('click', evento); document.emitir('click', evento); return evento; };
    return { ui, refs, document, window, movimento, mobile, elemento, acompanhamento, renderizar, menu, clicar, chamadas, retornos, modal: v => { modal = v; } };
}

test('Investimentos: importação sem DOM, storage, listeners ou temporizadores', () => {
    const url = pathToFileURL(resolve(__dirname, '../../frontend/js/funcionalidades/investimentos.js')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `for (const n of ['document','window','localStorage']) Object.defineProperty(globalThis,n,{get(){throw Error(n)}}); globalThis.setTimeout=globalThis.addEventListener=()=>{throw Error('efeito')}; await import(${JSON.stringify(url)});`]);
});
test('Investimentos: fábrica inerte e inicialização idempotente', t => {
    const a = ambiente(t); assert.equal(a.document.quantidade(), 0); assert.equal(a.window.quantidade(), 0); assert.equal(a.refs.listaInvestimentos.children.length, 0);
    a.ui.inicializar(); a.ui.inicializar(); assert.equal(a.document.quantidade(), 2); assert.equal(a.window.quantidade(), 2); assert.equal(a.movimento.quantidade(), 1);
});
test('Investimentos: indicadores preservam centavos, zero, negativos e indisponibilidade independente', t => {
    const a = ambiente(t);
    for (const valor of [0, 12345, -1, Number.MAX_SAFE_INTEGER, null]) {
        a.ui.renderizarIndicadores({ totalCapitalCentavos: valor, valores: { disponivel: true, totalValorCentavos: valor } });
        assert.equal(a.refs.totalCapital.textContent, valores.formatarCentavos(valor)); assert.equal(a.refs.totalValor.textContent, valores.formatarCentavos(valor));
    }
    a.ui.renderizarIndicadores({ totalCapitalCentavos: 0, valores: { disponivel: false } });
    assert.equal(a.refs.totalCapital.textContent, valores.formatarCentavos(0)); assert.equal(a.refs.totalValor.textContent, 'Indisponível');
});
test('Investimentos: cards preservam ordem, valores preparados, referências, notas e ARIA', t => {
    const a = ambiente(t), primeiro = congelar(investimento({ nome: 'Nome longo', instituicao: 'Banco', observacoes: 'Nota' }));
    a.renderizar([primeiro, investimento({ id: 'segundo', nome: 'Segundo' })]);
    const card = a.refs.listaInvestimentos.children[0];
    assert.deepEqual(a.refs.listaInvestimentos.children.map(c => c.dataset.investimentoId), [primeiro.id, 'segundo']);
    // O instante UTC da fixture pode corresponder a outro dia no fuso local.
    const dataAtualizacaoEsperada = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(new Date(primeiro.atualizadoEm));
    for (const trecho of ['Nome longo', 'Tipo livre · Banco', 'Capital aplicado atual', valores.formatarCentavos(10000), 'Valor estimado atual', valores.formatarCentavos(12000), 'Inicial: ', 'Manual: ', 'fim de 31/10/2026', `Atualização manual: ${dataAtualizacaoEsperada}`, 'Nota']) assert.ok(card.textContent.includes(trecho), trecho);
    assert.equal(a.menu().querySelector('summary').getAttribute('aria-controls'), `administracao-investimento-${primeiro.id}`);
    assert.equal(card.querySelector('[data-acao="editar"]').getAttribute('aria-label'), 'Editar investimento Nome longo');
    assert.equal(card.classList.contains('entrada-investimento'), false);
});
for (const indisponivel of [false, true]) test(`Investimentos: estado ${indisponivel ? 'indisponível' : 'vazio'}`, t => {
    const a = ambiente(t); a.renderizar([], { indisponivel }); const msg = a.refs.listaInvestimentos.children[0];
    assert.ok(msg.classList.contains('mensagem-vazia')); assert.ok(msg.textContent.includes(indisponivel ? 'conteúdo armazenado foi preservado' : 'Nenhum investimento cadastrado'));
});
test('Investimentos: avisos parciais e restrição de movimentação não desabilitam edição', t => {
    const a = ambiente(t); a.acompanhamento.capitais = { disponivel: false, motivo: 'Capital indisponível' };
    a.acompanhamento.valores.valoresPorInvestimento.set(investimento().id, { disponivel: false, motivo: 'Posição indisponível' });
    a.renderizar(undefined, { restricaoMovimentacao: { mensagem: 'Sem contas' } }); const card = a.refs.listaInvestimentos.children[0];
    assert.ok(card.textContent.includes('Posição indisponível')); assert.equal(card.querySelector('[data-acao="aporte"]').disabled, true);
    assert.equal(card.querySelector('[data-acao="resgate"]').getAttribute('aria-describedby'), `restricao-movimentacao-${investimento().id}`);
    assert.notEqual(card.querySelector('[data-acao="editar"]').disabled, true);
});
for (const disponivel of [false, true]) test(`Investimentos: histórico ${disponivel ? 'vazio' : 'indisponível'}`, t => {
    const a = ambiente(t); a.ui.renderizarHistorico({ disponivel, movimentos: [] });
    assert.equal(a.refs.historicoInvestimentos.textContent, disponivel ? 'Nenhum aporte ou resgate registrado.' : 'Histórico indisponível: não foi possível validar os dados e seus vínculos.');
});
test('Investimentos: histórico preserva ordem preparada, sinais e valores distintos do resgate', t => {
    const a = ambiente(t), movimentos = congelar([{ movimento: resgate({ observacoes: 'Resgate parcial' }), nomeInvestimento: 'Renomeado', nomeConta: 'Destino', futura: true }, { movimento: aporte(), nomeInvestimento: 'Outro', nomeConta: 'Origem', futura: false }]);
    a.ui.renderizarHistorico({ disponivel: true, movimentos }); const itens = a.refs.historicoInvestimentos.children[0].children;
    assert.ok(itens[0].textContent.startsWith('Resgate · Renomeado')); assert.ok(itens[1].textContent.startsWith('Aporte · Outro'));
    for (const texto of ['Destino · Data futura', `−${valores.formatadorMoeda.format(25)} da posição`, `Recebido na conta: ${valores.formatadorMoeda.format(30)}`, `Capital retirado: ${valores.formatadorMoeda.format(10)}`, 'Detalhes do resgate', 'Resgate parcial']) assert.ok(itens[0].textContent.includes(texto), texto);
    assert.equal(itens[1].querySelector('details'), null); assert.ok(itens[1].textContent.includes(`+${valores.formatadorMoeda.format(20)} na posição`));
});
for (const acao of ['aporte','resgate','atualizar','editar','excluir']) test(`Investimentos: callback imediato de ${acao} por ID`, t => {
    const a = ambiente(t, false); a.renderizar(); a.ui.inicializar(); const botao = a.refs.listaInvestimentos.querySelector(`[data-acao="${acao}"]`);
    a.clicar(botao); assert.deepEqual(a.chamadas, [[acao, investimento().id]]);
});
test('Investimentos: clique externo e Escape fecham menu e restauram foco', t => {
    const a = ambiente(t); a.renderizar(); a.ui.inicializar(); const menu = a.menu(), resumo = menu.querySelector('summary');
    a.clicar(resumo); assert.equal(menu.open, true); menu.querySelector('[data-acao="editar"]').focus();
    const evento = { key: 'Escape', target: a.document.activeElement, preventDefault() { this.impedido = true; } }; a.document.emitir('keydown', evento);
    assert.equal(menu.open, false); assert.strictEqual(a.document.activeElement, resumo); assert.equal(evento.impedido, true);
    a.clicar(resumo); a.clicar(a.elemento()); assert.equal(menu.open, false);
});
test('Investimentos: timers e reabertura rápida preservam menu mais recente', t => {
    const a = ambiente(t, false); a.renderizar(); a.ui.inicializar(); const menu = a.menu(), painel = menu.querySelector('.painel-menu-acoes'), resumo = menu.querySelector('summary');
    a.clicar(resumo); t.mock.timers.tick(220); a.clicar(a.elemento()); assert.equal(painel.inert, true); assert.equal(menu.open, true);
    a.clicar(resumo); assert.equal(painel.inert, false); t.mock.timers.tick(220); assert.equal(menu.open, true); assert.equal(painel.quantidade(), 0);
    a.clicar(a.elemento()); painel.emitir('transitionend', { target: painel, propertyName: 'opacity' }); assert.equal(menu.open, false); t.mock.timers.tick(1000); assert.equal(menu.open, false);
});
test('Investimentos: alternância entre menus e bloqueio por modal', t => {
    const a = ambiente(t); a.renderizar([investimento(), investimento({id:'outro'})]); a.ui.inicializar(); const menus = a.refs.listaInvestimentos.querySelectorAll('.gerenciar-investimento');
    a.clicar(menus[0].querySelector('summary')); a.clicar(menus[1].querySelector('summary')); assert.equal(menus[0].open, false); assert.equal(menus[1].open, true);
    a.modal({}); a.clicar(a.elemento()); a.window.emitir('scroll'); assert.equal(menus[1].open, true);
    a.modal(null); a.window.emitir('resize'); assert.equal(menus[1].open, false);
});
test('Investimentos: posicionamento considera navegação mobile e borda inferior', t => {
    const a = ambiente(t); a.renderizar(); a.ui.inicializar(); a.mobile.matches = true; a.refs.navegacaoPrincipal.retangulo.top = 210;
    a.clicar(a.menu().querySelector('summary')); assert.equal(a.menu().classList.contains('abre-acima'), true);
});
test('Investimentos: retorno de foco resolve card recriado e reabre administração sem animação', t => {
    const a = ambiente(t); a.renderizar(); const antigo = a.refs.listaInvestimentos.querySelector('[data-acao="editar"]');
    a.renderizar([investimento({nome:'Atualizado'})]); a.ui.prepararRetornoFocoInvestimento(investimento().id, 'editar');
    const novo = a.refs.listaInvestimentos.querySelector('[data-acao="editar"]'); assert.notStrictEqual(novo, antigo); assert.strictEqual(a.retornos[0], novo); assert.equal(a.menu().open, true);
    a.ui.prepararRetornoFocoInvestimento('ausente', 'editar'); assert.strictEqual(a.retornos[1], a.refs.botaoNovoInvestimento); assert.ok(novo.getAttribute('aria-label').includes('Atualizado'));
});
test('Investimentos: rerender limpa listeners e transições de cards antigos', t => {
    const a = ambiente(t, false); a.renderizar(); a.ui.inicializar(); const antigo = a.menu(), botao = antigo.querySelector('[data-acao="editar"]'); a.clicar(antigo.querySelector('summary'));
    a.renderizar(); botao.emitir('click'); assert.deepEqual(a.chamadas, []); assert.equal(botao.quantidade(), 0); assert.equal(antigo.querySelector('.painel-menu-acoes').quantidade(), 0);
    t.mock.timers.tick(1000); assert.equal(a.menu().open, false); assert.equal(a.document.quantidade(), 2);
});
test('Investimentos: movimento reduzido conclui transição sem espera restante', t => {
    const a = ambiente(t, false); a.renderizar(); a.ui.inicializar(); a.clicar(a.menu().querySelector('summary')); a.clicar(a.elemento());
    a.movimento.matches = true; a.movimento.emitir('change'); assert.equal(a.menu().open, false); assert.equal(a.menu().querySelector('.painel-menu-acoes').quantidade(), 0);
    t.mock.timers.tick(1000); a.clicar(a.menu().querySelector('summary')); assert.equal(a.menu().classList.contains('menu-acoes-animando'), false);
});
test('Investimentos: encerramento repetido limpa recursos e permite inicialização explícita', t => {
    const a = ambiente(t, false); a.renderizar(); a.ui.inicializar(); a.clicar(a.menu().querySelector('summary')); a.ui.encerrar(); a.ui.encerrar();
    assert.equal(a.document.quantidade(), 0); assert.equal(a.window.quantidade(), 0); assert.equal(a.movimento.quantidade(), 0); assert.equal(a.menu().open, false);
    t.mock.timers.tick(1000); assert.equal(a.menu().querySelector('.painel-menu-acoes').quantidade(), 0); a.ui.inicializar(); assert.equal(a.document.quantidade(), 2);
});
