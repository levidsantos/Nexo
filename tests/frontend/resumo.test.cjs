'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { Script, createContext } = require('node:vm');
const { criarResumo } = require('../../frontend/js/funcionalidades/resumo.js');
const { formatarCentavos } = require('../../frontend/js/dominio/valores-datas.js');
const { calcularTotaisResumo } = require('../../frontend/js/dominio/calculos.js');
const { transacao, aporte } = require('./support/fixtures.cjs');

// Apenas a árvore, os atributos e os eventos usados pela apresentação; sem simular layout.
function preparar() {
    let aberturas = 0;
    const document = { createElement: (tag) => elemento(tag) };
    function elemento(tag = 'div') {
        const classes = new Set(), eventos = new Map();
        return { tag, ownerDocument: document, textContent: '', children: [],
            atributos: new Map([['aria-describedby', 'ajuda-preservada']]),
            classList: { add: (nome) => classes.add(nome), contains: (nome) => classes.has(nome) },
            append(...filhos) { this.children.push(...filhos); },
            appendChild(filho) { this.children.push(filho); },
            replaceChildren(...filhos) { this.children = filhos; },
            addEventListener(tipo, callback) {
                if (!eventos.has(tipo)) eventos.set(tipo, []);
                eventos.get(tipo).push(callback);
            },
            click() { for (const callback of eventos.get('click') ?? []) callback(); },
            quantidadeListeners() { return [...eventos.values()].reduce((n, itens) => n + itens.length, 0); }
        };
    }
    const refs = { valorRecebido: elemento(), valorDespesas: elemento(), valorSaldo: elemento(), listaContas: elemento() };
    refs.valorSaldo.classList.add('classe-preservada');
    const ui = criarResumo({ ...refs, abrirCadastroConta: () => { aberturas++; } });
    return { refs, ui, aberturas: () => aberturas };
}
const saldos = (valores = [], outros = {}) => ({ disponivel: true,
    saldoDisponivelCentavos: 0, saldosPorContaCentavos: new Map(valores), ...outros });

test('Resumo: importação não acessa DOM, storage, eventos ou temporizadores', () => {
    const url = pathToFileURL(resolve(__dirname, '../../frontend/js/funcionalidades/resumo.js')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        for (const nome of ['document', 'window', 'localStorage']) {
            Object.defineProperty(globalThis, nome, { get() { throw new Error(nome); } });
        }
        globalThis.setTimeout = globalThis.requestAnimationFrame = globalThis.addEventListener = () => { throw new Error('efeito colateral'); };
        await import(${JSON.stringify(url)});
    `]);
});

test('Resumo: fábrica não renderiza, não registra eventos e expõe somente três operações', () => {
    const { refs, ui } = preparar();
    assert.deepEqual(Object.keys(ui).sort(), ['renderizarContas', 'renderizarIndicadores', 'renderizarSaldo']);
    for (const ref of Object.values(refs)) {
        assert.equal(ref.textContent, '');
        assert.equal(ref.children.length, 0);
        assert.equal(ref.quantidadeListeners(), 0);
    }
});

test('Resumo: indicadores preservam positivos, negativos, zero e centavos', () => {
    const { refs, ui } = preparar();
    for (const valor of [12345, -1, 0, Number.MAX_SAFE_INTEGER]) {
        ui.renderizarIndicadores({ receitasCentavos: valor, despesasCentavos: valor });
        assert.equal(refs.valorRecebido.textContent, formatarCentavos(valor));
        assert.equal(refs.valorDespesas.textContent, formatarCentavos(valor));
    }
});

test('Resumo: indisponibilidade de um indicador não mascara o outro', () => {
    const { refs, ui } = preparar();
    ui.renderizarIndicadores({ receitasCentavos: null, despesasCentavos: 0 });
    assert.equal(refs.valorRecebido.textContent, 'Indisponível');
    assert.equal(refs.valorDespesas.textContent, formatarCentavos(0));
    ui.renderizarIndicadores({ receitasCentavos: 100, despesasCentavos: NaN });
    assert.equal(refs.valorRecebido.textContent, formatarCentavos(100));
    assert.equal(refs.valorDespesas.textContent, 'Indisponível');
});

test('Resumo: saldo disponível preserva zero, negativos, indisponibilidade e atributos', () => {
    const { refs, ui } = preparar();
    for (const valor of [0, -12345, 12345]) {
        ui.renderizarSaldo(saldos([], { saldoDisponivelCentavos: valor }));
        assert.equal(refs.valorSaldo.textContent, formatarCentavos(valor));
    }
    ui.renderizarSaldo({ disponivel: false, saldoDisponivelCentavos: 100 });
    assert.equal(refs.valorSaldo.textContent, 'Indisponível');
    assert.equal(refs.valorSaldo.classList.contains('classe-preservada'), true);
    for (const ref of Object.values(refs)) assert.equal(ref.atributos.get('aria-describedby'), 'ajuda-preservada');
});

test('Resumo: contas mantêm ordem, limite de três, classes e saldos por ID sem mutação', () => {
    const { refs, ui } = preparar();
    const contas = Object.freeze(['c', 'a', 'd', 'b'].map((id) => Object.freeze({ id, nome: `Conta ${id}` })));
    ui.renderizarContas({ contas, saldos: saldos([['a', 0], ['b', 500], ['c', -1], ['d', 12345]]) });
    const lista = refs.listaContas.children[0];
    assert.equal(lista.tag, 'ul');
    assert.equal(lista.classList.contains('lista-contas-resumo'), true);
    assert.deepEqual(lista.children.map((li) => li.children[0].textContent), ['Conta c', 'Conta a', 'Conta d']);
    assert.deepEqual(lista.children.map((li) => li.children[1].textContent), [-1, 0, 12345].map(formatarCentavos));
    assert.equal(lista.children.every((li) => li.tag === 'li' && li.children[0].tag === 'span' && li.children[1].tag === 'strong'), true);
    assert.equal(contas.length, 4);
});

test('Resumo: lista vazia preserva mensagem, botão e callback sem abertura antecipada', () => {
    const { refs, ui, aberturas } = preparar();
    ui.renderizarContas({ contas: [], saldos: saldos() });
    const [mensagem, botao] = refs.listaContas.children;
    assert.equal(mensagem.textContent, 'Cadastre sua primeira conta para acompanhar seus saldos.');
    assert.equal(mensagem.classList.contains('mensagem-vazia'), true);
    assert.equal(botao.type, 'button');
    assert.equal(botao.textContent, 'Cadastrar primeira conta');
    assert.equal(botao.classList.contains('btn-primario'), true);
    assert.equal(aberturas(), 0);
    botao.click();
    assert.equal(aberturas(), 1);
});

test('Resumo: saldos indisponíveis mostram motivo sem botão ou valores parciais', () => {
    const { refs, ui } = preparar();
    for (const contas of [[], [{ id: 'a', nome: 'Conta' }]]) {
        ui.renderizarContas({ contas, saldos: { disponivel: false, motivo: 'Dados bloqueados.' } });
        assert.equal(refs.listaContas.children.length, 1);
        assert.equal(refs.listaContas.children[0].textContent, 'Dados de saldo indisponíveis. Dados bloqueados.');
    }
});

test('Resumo: nova renderização substitui dados e não acumula botões ou listeners', () => {
    const { refs, ui, aberturas } = preparar();
    for (let i = 0; i < 3; i++) ui.renderizarContas({ contas: [], saldos: saldos() });
    assert.equal(refs.listaContas.children.length, 2);
    assert.equal(refs.listaContas.children[1].quantidadeListeners(), 1);
    refs.listaContas.children[1].click();
    assert.equal(aberturas(), 1);
    ui.renderizarContas({ contas: [{ id: 'a', nome: 'Renomeada' }], saldos: saldos([['a', 500]]) });
    assert.equal(refs.listaContas.children.length, 1);
    assert.equal(refs.listaContas.children[0].children[0].children[0].textContent, 'Renomeada');
    ui.renderizarContas({ contas: [], saldos: { disponivel: false, motivo: 'Falha.' } });
    assert.equal(refs.listaContas.children.length, 1);
});

test('Resumo: instâncias não compartilham referências ou dados de apresentação', () => {
    const a = preparar(), b = preparar();
    a.ui.renderizarIndicadores({ receitasCentavos: 100, despesasCentavos: 0 });
    assert.equal(b.refs.valorRecebido.textContent, '');
    b.ui.renderizarContas({ contas: [], saldos: saldos() });
    b.refs.listaContas.children[1].click();
    assert.equal(a.aberturas(), 0);
    assert.equal(b.aberturas(), 1);
});

test('Resumo: coordenadores reais mantêm cálculo, disponibilidade e ordem das atualizações no script', () => {
    const fonte = readFileSync(resolve(__dirname, '../../frontend/js/script.js'), 'utf8');
    const nomes = ['atualizarResumo', 'atualizarVisualizacoesSaldos', 'renderizarContasResumo'];
    const trechos = nomes.map((nome) => {
        const resultado = [...fonte.matchAll(new RegExp(`^function ${nome}\\([^]*?^\\}`, 'gm'))];
        assert.equal(resultado.length, 1);
        return resultado[0][0];
    });
    const app = preparar(), efeitos = [];
    let bloqueada = false;
    const contas = [{ id: 'a', nome: 'Conta atual' }];
    const resultado = saldos([['a', -100]], { saldoTotalCentavos: -100, saldoDisponivelCentavos: -100 });
    const contexto = createContext({ resumo: app.ui, formatarCentavos,
        saldoTotalContas: { textContent: '' }, obterSaldosContas: () => { efeitos.push('saldos'); return resultado; },
        renderizarContas: (recebido) => { assert.strictEqual(recebido, resultado); efeitos.push('contas'); },
        atualizarGraficosHistorico: () => efeitos.push('historico'), atualizarDistribuicaoDespesas: () => efeitos.push('distribuicao'),
        calcularTotaisResumo: (dados) => { efeitos.push('totais'); return calcularTotaisResumo(dados); },
        disponibilidadeColecoes: { colecaoEstaBloqueada: () => bloqueada, consultarContas: () => contas,
            consultarTransacoes: () => [transacao({ data: '2099-01-01' }),
                transacao({ id: 'despesa-a', tipo: 'despesa', valor: 2 }), aporte({ valor: 999 })] }
    });
    const api = new Script(trechos.join('\n') + '\n({ atualizarResumo })').runInContext(contexto);
    api.atualizarResumo();
    assert.deepEqual(efeitos, ['saldos', 'contas', 'historico', 'distribuicao', 'totais']);
    assert.equal(app.refs.valorRecebido.textContent, formatarCentavos(1000));
    assert.equal(app.refs.valorDespesas.textContent, formatarCentavos(200));
    assert.equal(app.refs.valorSaldo.textContent, formatarCentavos(-100));
    efeitos.length = 0;
    bloqueada = true;
    api.atualizarResumo();
    assert.deepEqual(efeitos, ['saldos', 'contas', 'historico', 'distribuicao']);
    assert.equal(app.refs.valorRecebido.textContent, 'Indisponível');
    assert.equal(app.refs.valorDespesas.textContent, 'Indisponível');
});
