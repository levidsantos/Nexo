'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { criarAparencia } = require('../../frontend/js/ui/aparencia.js');

const html = fs.readFileSync(require.resolve('../../frontend/index.html'), 'utf8');
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const [valor, esperado] of [[null, 'claro'], ['claro', 'claro'], ['escuro', 'escuro'], ['automatico', 'claro'], ['"escuro"', 'claro']]) {
    test(`aparência inicial antes do CSS: ${valor} → ${esperado}`, () => {
        const raiz = { dataset: { tema: 'claro' } }, chaves = [];
        vm.runInNewContext(bootstrap, { document: { documentElement: raiz }, localStorage: { getItem(chave) { chaves.push(chave); return valor; } } });
        assert.equal(raiz.dataset.tema, esperado);
        assert.deepEqual(chaves, ['nexo-tema']);
        assert.ok(html.indexOf('<script>') < html.indexOf('<link rel="stylesheet"'));
    });
}
test('aparência inicial tolera indisponibilidade até no acesso ao localStorage', () => {
    const document = { documentElement: { dataset: { tema: 'claro' } } };
    const contexto = { document };
    Object.defineProperty(contexto, 'localStorage', { get() { throw Error('Bloqueado'); } });
    assert.doesNotThrow(() => vm.runInNewContext(bootstrap, contexto));
    assert.equal(document.documentElement.dataset.tema, 'claro');
});

function alvo(extra = {}) {
    const listeners = new Map();
    return Object.assign({
        addEventListener(tipo, fn) { if (!listeners.has(tipo)) listeners.set(tipo, new Set()); listeners.get(tipo).add(fn); },
        removeEventListener(tipo, fn) { listeners.get(tipo)?.delete(fn); },
        emitir(tipo, evento = {}) { evento.target ??= this; for (const fn of [...listeners.get(tipo) ?? []]) fn(evento); },
        quantidade() { return [...listeners.values()].reduce((n, itens) => n + itens.size, 0); }
    }, extra);
}
function ambiente({ tema = 'claro', falhar = false } = {}) {
    const classes = new Set(), gravacoes = [], alteracoes = [];
    const raiz = { dataset: { tema }, classList: { add: n => classes.add(n), remove: n => classes.delete(n) } };
    const document = alvo({ documentElement: raiz, activeElement: null });
    const opcoes = ['desktop', 'mobile'].flatMap(local => ['claro', 'escuro'].map(value => alvo({
        name: `tema-${local}`, value, checked: false,
        focus() { document.activeElement = this; }
    })));
    const painel = { hidden: true, contains: el => opcoes.slice(2).includes(el) };
    const configuracoes = { contains: el => el === botao || el === painel || painel.contains(el) };
    const botao = alvo({ parentElement: configuracoes, atributos: {}, setAttribute(n, v) { this.atributos[n] = v; }, focus() { document.activeElement = this; } });
    document.querySelectorAll = () => opcoes;
    document.getElementById = id => id === 'abrir-configuracoes' ? botao : painel;
    const larguraMobile = alvo({ matches: true });
    const api = criarAparencia({ document, larguraMobile, aoAlterarTema: () => alteracoes.push(raiz.dataset.tema),
        gravarPreferencia(valor) { if (falhar) throw Error('Sem espaço'); gravacoes.push(valor); } });
    const escolher = (local, tema) => {
        const opcao = opcoes.find(o => o.name === `tema-${local}` && o.value === tema);
        opcao.checked = true; opcao.emitir('change');
    };
    return { api, document, raiz, opcoes, painel, botao, larguraMobile, gravacoes, alteracoes, escolher, classes };
}
for (const tema of ['claro', 'escuro']) test(`controles inicializam sincronizados em ${tema}, sem gravar ou notificar gráficos`, () => {
    const a = ambiente({ tema });
    assert.equal(a.document.quantidade(), 0);
    a.api.inicializar(); a.api.inicializar();
    assert.deepEqual(a.opcoes.map(o => o.checked), a.opcoes.map(o => o.value === tema));
    assert.equal(a.document.quantidade(), 2);
    assert.equal(a.gravacoes.length, 0); assert.equal(a.alteracoes.length, 0);
});
test('desktop e mobile aplicam a mesma escolha e notificam uma vez, sem gravar coleções financeiras', () => {
    const a = ambiente(); a.api.inicializar();
    a.escolher('mobile', 'escuro');
    assert.deepEqual(a.opcoes.map(o => o.checked), [false, true, false, true]);
    a.escolher('desktop', 'claro');
    assert.deepEqual(a.opcoes.map(o => o.checked), [true, false, true, false]);
    a.escolher('desktop', 'claro');
    assert.deepEqual(a.gravacoes, ['escuro', 'claro']);
    assert.deepEqual(a.alteracoes, ['escuro', 'claro']);
});
test('falha de escrita preserva tema e sincronização durante a sessão', () => {
    const a = ambiente({ falhar: true }); a.api.inicializar();
    assert.doesNotThrow(() => a.escolher('mobile', 'escuro'));
    assert.equal(a.raiz.dataset.tema, 'escuro');
    assert.equal(a.opcoes[1].checked, true);
    assert.deepEqual(a.alteracoes, ['escuro']);
});
test('painel alterna, preserva cliques internos e fecha por fora e Escape restaurando foco', () => {
    const a = ambiente(); a.api.inicializar(); a.botao.emitir('click');
    assert.equal(a.painel.hidden, false); assert.equal(a.botao.atributos['aria-expanded'], 'true');
    a.document.emitir('click', { target: a.opcoes[2] }); assert.equal(a.painel.hidden, false);
    let prevenido = false;
    a.document.emitir('keydown', { key: 'Escape', preventDefault() { prevenido = true; } });
    assert.equal(prevenido, true); assert.equal(a.painel.hidden, true); assert.equal(a.document.activeElement, a.botao);
    a.botao.emitir('click'); a.botao.emitir('click'); assert.equal(a.painel.hidden, true);
    a.botao.emitir('click'); a.document.emitir('click', { target: {} });
    assert.equal(a.painel.hidden, true); assert.equal(a.botao.atributos['aria-expanded'], 'false');
});
test('breakpoint fecha painel e transfere foco para a opção desktop equivalente', () => {
    const a = ambiente({ tema: 'escuro' }); a.api.inicializar(); a.botao.emitir('click');
    a.document.activeElement = a.opcoes[3]; a.larguraMobile.matches = false; a.larguraMobile.emitir('change');
    assert.equal(a.painel.hidden, true); assert.equal(a.document.activeElement, a.opcoes[1]);
    a.botao.emitir('click'); assert.equal(a.painel.hidden, true);
});
test('fechamento coordenado com modal e encerramento não deixam listeners duplicados', () => {
    const a = ambiente(); a.api.inicializar(); a.botao.emitir('click'); a.api.fecharConfiguracoes();
    assert.equal(a.painel.hidden, true);
    a.api.encerrar(); assert.equal(a.document.quantidade(), 0); assert.equal(a.botao.quantidade(), 0);
    assert.equal(a.larguraMobile.quantidade(), 0); assert.ok(a.opcoes.every(o => o.quantidade() === 0));
    a.api.inicializar(); a.escolher('desktop', 'escuro'); assert.equal(a.alteracoes.length, 1);
});
