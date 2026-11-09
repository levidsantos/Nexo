'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { criarAjuda } = require('../../frontend/js/ui/ajuda.js');

function alvo(extra = {}) {
    const listeners = new Map();
    return Object.assign({
        addEventListener(tipo, fn) { if (!listeners.has(tipo)) listeners.set(tipo, new Set()); listeners.get(tipo).add(fn); },
        removeEventListener(tipo, fn) { listeners.get(tipo)?.delete(fn); },
        emitir(tipo, evento = {}) { evento.target ??= this; for (const fn of [...listeners.get(tipo) ?? []]) fn(evento); },
        quantidade() { return [...listeners.values()].reduce((n, fs) => n + fs.size, 0); },
        atributos: {}, setAttribute(n, v) { this.atributos[n] = v; }
    }, extra);
}
function ambiente(mobile = false) {
    const chamadas = [], document = { activeElement: null }, elementos = {};
    for (const id of ['modal-ajuda', 'fechar-ajuda', 'abrir-ajuda-desktop', 'abrir-ajuda-mobile', 'abrir-configuracoes', 'categoria-ajuda']) {
        elementos[id] = alvo({ id, focus() { document.activeElement = this; } });
    }
    const nomes = ['resumo', 'transacoes', 'contas', 'analises', 'investimentos'];
    const categorias = nomes.map(n => ({ id: `ajuda-${n}`, hidden: n !== 'resumo' }));
    const botoes = nomes.map(n => alvo({ dataset: { categoriaAjuda: n } }));
    const conteudo = { scrollTop: 50 };
    elementos['categoria-ajuda'].value = 'resumo';
    const modal = elementos['modal-ajuda'];
    modal.querySelector = () => conteudo;
    modal.querySelectorAll = s => s === '.ajuda-categoria' ? categorias : botoes;
    document.getElementById = id => elementos[id];
    const larguraMobile = alvo({ matches: mobile });
    let ativo = null, retorno = null;
    const modais = {
        obterModalAtivo: () => ativo,
        abrirModal(m, foco) { chamadas.push('abrir'); ativo = m; foco.focus(); },
        definirFocoRetorno(el) { chamadas.push(['retorno', el.id]); retorno = el; },
        fecharModal(m) { chamadas.push('fechar'); if (ativo === m) { ativo = null; retorno.focus(); } }
    };
    const api = criarAjuda({ document, modais, larguraMobile, fecharConfiguracoes() { chamadas.push('configuracoes-fechadas'); } });
    return { api, document, elementos, chamadas, categorias, botoes, conteudo, larguraMobile, modais, ativo: m => { ativo = m; } };
}

test('Ajuda: importação não consulta DOM, armazenamento ou listeners', () => {
    const url = pathToFileURL(require.resolve('../../frontend/js/ui/ajuda.js')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `for(const n of ['document','window','localStorage'])Object.defineProperty(globalThis,n,{get(){throw Error(n)}});await import(${JSON.stringify(url)});`]);
});
test('Ajuda: inicialização explícita e idempotente; encerramento remove todos os listeners', () => {
    const a = ambiente(); assert.equal(a.elementos['abrir-ajuda-desktop'].quantidade(), 0);
    a.api.inicializar(); a.api.inicializar();
    assert.equal(a.elementos['abrir-ajuda-desktop'].quantidade(), 1);
    a.api.encerrar();
    assert.ok(Object.values(a.elementos).every(e => e.quantidade() === 0));
    assert.ok(a.botoes.every(e => e.quantidade() === 0)); assert.equal(a.larguraMobile.quantidade(), 0);
    a.api.inicializar(); a.elementos['abrir-ajuda-desktop'].emitir('click');
    assert.equal(a.chamadas.filter(c => c === 'abrir').length, 1);
});
for (const mobile of [false, true]) test(`Ajuda: acesso ${mobile ? 'mobile' : 'desktop'} fecha configurações antes de abrir e restaura foco adequado`, () => {
    const a = ambiente(mobile); a.api.inicializar();
    a.elementos[mobile ? 'abrir-ajuda-mobile' : 'abrir-ajuda-desktop'].emitir('click');
    assert.deepEqual(a.chamadas.slice(0, 2), ['configuracoes-fechadas', 'abrir']);
    assert.equal(a.document.activeElement.id, 'fechar-ajuda');
    a.elementos['fechar-ajuda'].emitir('click');
    assert.equal(a.document.activeElement.id, mobile ? 'abrir-configuracoes' : 'abrir-ajuda-desktop');
});
test('Ajuda: categoria por botão e select sincroniza painéis, ARIA e rolagem sem recriar conteúdo', () => {
    const a = ambiente(); a.api.inicializar();
    a.botoes[4].emitir('click');
    assert.deepEqual(a.categorias.map(c => c.hidden), [true, true, true, true, false]);
    assert.equal(a.elementos['categoria-ajuda'].value, 'investimentos');
    assert.equal(a.botoes[4].atributos['aria-pressed'], 'true'); assert.equal(a.conteudo.scrollTop, 0);
    a.elementos['categoria-ajuda'].value = 'contas'; a.elementos['categoria-ajuda'].emitir('change');
    assert.equal(a.categorias[2].hidden, false); assert.equal(a.botoes[4].atributos['aria-pressed'], 'false');
    a.elementos['categoria-ajuda'].value = 'inexistente'; a.elementos['categoria-ajuda'].emitir('change');
    assert.equal(a.categorias.filter(c => !c.hidden).length, 1); assert.equal(a.categorias[2].hidden, false);
});
test('Ajuda: cliques internos preservam diálogo; somente o fundo fecha', () => {
    const a = ambiente(); a.api.inicializar(); a.api.abrirAjuda();
    a.elementos['modal-ajuda'].emitir('click', { target: a.botoes[0] });
    assert.equal(a.modais.obterModalAtivo(), a.elementos['modal-ajuda']);
    a.elementos['modal-ajuda'].emitir('click'); assert.equal(a.modais.obterModalAtivo(), null);
});
for (const mobile of [false, true]) test(`Ajuda: mudar breakpoint ${mobile ? 'para desktop' : 'para mobile'} atualiza retorno antes do fechamento`, () => {
    const a = ambiente(mobile); a.api.inicializar(); a.api.abrirAjuda();
    a.larguraMobile.matches = !mobile; a.larguraMobile.emitir('change'); a.api.fecharAjuda();
    assert.equal(a.document.activeElement.id, mobile ? 'abrir-ajuda-desktop' : 'abrir-configuracoes');
});
test('Ajuda: não substitui formulário financeiro ativo nem fecha outro modal', () => {
    const a = ambiente(); a.api.inicializar(); const financeiro = { id: 'modal-conta' }; a.ativo(financeiro);
    a.api.abrirAjuda(); a.api.fecharAjuda(); assert.equal(a.chamadas.length, 0);
    assert.equal(a.modais.obterModalAtivo(), financeiro);
});

const html = readFileSync(require.resolve('../../frontend/index.html'), 'utf8');
const ajuda = html.split('<div id="modal-ajuda"')[1].split('<div id="modal-overlay"')[0];
test('Ajuda: conteúdo aprovado mantém 17 perguntas, cinco categorias e summaries no fluxo de foco', () => {
    const perguntas = [...ajuda.matchAll(/<details class="pergunta-ajuda" id="pergunta-ajuda-(\d+)"><summary tabindex="0">([^<]+)<\/summary>/g)];
    assert.equal(perguntas.length, 17);
    assert.deepEqual(perguntas.map(p => Number(p[1])), Array.from({ length: 17 }, (_, i) => i + 1));
    assert.deepEqual([...ajuda.matchAll(/<section class="ajuda-categoria" id="ajuda-([^"]+)"/g)].map(m => m[1]), ['resumo', 'transacoes', 'contas', 'analises', 'investimentos']);
    assert.ok(ajuda.includes('aria-modal="true"')); assert.ok(ajuda.includes('aria-describedby="descricao-ajuda"'));
    assert.doesNotMatch(ajuda, /frontend\/|calcularSaldos|prepararHistoricoMensal|Referência técnica/);
});
test('Ajuda: quatro exemplos associados às perguntas corretas, com datas fixas e relações entre cenários', () => {
    for (const [numero, exemplo] of [[1, 'e1'], [14, 'e2'], [15, 'e3'], [16, 'e4']]) {
        const resposta = ajuda.split(`id="pergunta-ajuda-${numero}"`)[1].split('</details>')[0];
        assert.ok(resposta.includes(`id="exemplo-ajuda-${exemplo}"`));
        assert.ok(resposta.includes('hoje como 09/11/2026'));
        assert.ok(resposta.includes('final do dia informado'));
    }
    assert.equal((ajuda.match(/class="exemplo-ajuda"/g) ?? []).length, 4);
    for (const texto of ['R$ 1.120,00', 'R$ 1.020,00', 'R$ 525,00', 'R$ 710,00', 'R$ 700,00', 'Este exemplo continua', 'Este exemplo é independente']) assert.ok(ajuda.includes(texto), texto);
});
test('Ajuda: acesso mobile não acrescenta destino à navegação e Escape é coordenado pelo gerenciador existente', () => {
    const nav = html.match(/<nav aria-label="Navegação principal">([\s\S]*?)<\/nav>/)[1];
    assert.equal((nav.match(/data-pagina=/g) ?? []).length, 5);
    assert.ok(html.includes('id="abrir-ajuda-mobile"'));
    const script = readFileSync(require.resolve('../../frontend/js/script.js'), 'utf8');
    assert.ok(script.includes('if (modal === document.getElementById("modal-ajuda")) ajuda.fecharAjuda();'));
});
