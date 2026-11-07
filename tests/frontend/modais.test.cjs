'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { Script, createContext } = require('node:vm');
const { criarModais } = require('../../frontend/js/ui/modais.js');
const { criarNotificacoes } = require('../../frontend/js/ui/notificacoes.js');

function eventos(alvo = {}) {
    const listeners = new Map();
    return Object.assign(alvo, {
        listeners,
        addEventListener(tipo, acao, captura = false) {
            const chave = `${tipo}:${captura}`;
            if (!listeners.has(chave)) listeners.set(chave, new Set());
            listeners.get(chave).add(acao);
        },
        removeEventListener(tipo, acao, captura = false) { listeners.get(`${tipo}:${captura}`)?.delete(acao); },
        emitir(tipo, dados = {}) {
            const evento = { type: tipo, target: alvo, defaultPrevented: false, interrompido: false,
                preventDefault() { this.defaultPrevented = true; },
                stopImmediatePropagation() { this.interrompido = true; }, ...dados };
            for (const captura of [true, false]) {
                for (const acao of [...(listeners.get(`${tipo}:${captura}`) ?? [])]) {
                    acao(evento); if (evento.interrompido) return evento;
                }
            }
            return evento;
        }
    });
}

const fonte = readFileSync(resolve(__dirname, '../../frontend/js/script.js'), 'utf8');
const posicionamento = fonte.match(/^function posicionarNotificacoesModal\([^]*?^\}/m)[0];

function ambiente(t, reduzido = false) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const document = eventos({ activeElement: null }), chamadas = [], focos = [];
    // Árvore e eventos mínimos: os focáveis são fornecidos na ordem do DOM.
    // Sem cálculo de layout, CSS, navegação nativa de Tab ou leitor de tela.
    function elemento(tag, id = '') {
        const classes = new Set(), atributos = new Map();
        return eventos({ tag, id, ownerDocument: document, parentElement: null, children: [],
            inert: false, disabled: false, visivel: true, offsetWidth: 100, textContent: '', focaveis: [],
            classList: { add: (...nomes) => nomes.forEach((nome) => classes.add(nome)),
                remove: (...nomes) => nomes.forEach((nome) => classes.delete(nome)), contains: (nome) => classes.has(nome) },
            setAttribute: (nome, valor) => atributos.set(nome, valor), getAttribute: (nome) => atributos.get(nome) ?? null,
            appendChild(filho) { filho.remove(); filho.parentElement = this; this.children.push(filho); return filho; },
            append(...filhos) { filhos.forEach((filho) => this.appendChild(filho)); },
            remove() {
                if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((filho) => filho !== this);
                this.parentElement = null;
            },
            contains(alvo) { return this === alvo || this.children.some((filho) => filho.contains(alvo)); },
            get isConnected() { return document.body.contains(this); },
            focus(opcoes) { document.activeElement = this; focos.push([id, opcoes]); },
            matches(seletor) { assert.equal(seletor, ':hover'); return false; },
            querySelector(seletor) {
                const aceita = (item) => seletor === '[role="dialog"]' ? item.getAttribute('role') === 'dialog'
                    : seletor.split(',').map((parte) => parte.trim()).includes(item.tag);
                const buscar = (raiz) => {
                    for (const filho of raiz.children) {
                        if (aceita(filho)) return filho;
                        const encontrado = buscar(filho); if (encontrado) return encontrado;
                    }
                    return null;
                };
                return buscar(this);
            },
            querySelectorAll(seletor) {
                assert.equal(seletor, 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
                return this.focaveis;
            }
        });
    }
    document.createElement = (tag) => elemento(tag);
    document.body = elemento('body');
    const conteudo = elemento('main'), origem = elemento('button', 'origem'), alternativa = elemento('button', 'alternativa');
    const existenteInerte = elemento('section'); existenteInerte.inert = true;
    document.body.append(conteudo, existenteInerte, alternativa); conteudo.appendChild(origem);
    const criarModal = (id, pai = document.body) => {
        const modal = elemento('div', id), painel = elemento('div', `painel-${id}`);
        modal.classList.add('modal-overlay', 'hidden'); painel.setAttribute('role', 'dialog');
        painel.setAttribute('aria-modal', 'true'); painel.setAttribute('aria-labelledby', `titulo-${id}`);
        const primeiro = elemento('button', `${id}-x`), campo = elemento('input', `${id}-campo`), ultimo = elemento('button', `${id}-salvar`);
        painel.append(primeiro, campo, ultimo); modal.appendChild(painel); pai.appendChild(modal);
        modal.focaveis = [primeiro, campo, ultimo];
        return { modal, painel, primeiro, campo, ultimo };
    };
    const a = criarModal('a', conteudo), b = criarModal('b');
    const area = elemento('section'), anuncio = elemento('div'), lista = elemento('div');
    area.append(anuncio, lista); document.body.appendChild(area);
    const posicionarReal = new Script(posicionamento + '\nposicionarNotificacoesModal').runInContext(createContext({
        document, areaNotificacoes: area, anuncioNotificacoes: anuncio
    }));
    const movimento = eventos({ matches: reduzido });
    const podeReceberFoco = (alvo) => {
        if (!alvo?.isConnected || alvo.disabled || !alvo.visivel) return false;
        for (let atual = alvo; atual; atual = atual.parentElement) if (atual.inert) return false;
        return true;
    };
    let cancelarPorEscape = null;
    const opcoes = { document, movimentoReduzido: movimento, podeReceberFoco,
        obterFocoAlternativo: () => alternativa,
        prepararNotificacoes: (modal) => {
            chamadas.push(['preparar', modal.id]); modal.querySelector('[role="dialog"]').appendChild(area);
        },
        posicionarNotificacoesModal: (modal, noPainel) => {
            chamadas.push(['posicionar', modal.id, noPainel]); posicionarReal(modal, noPainel);
        },
        concluirNotificacoes: () => {
            chamadas.push(['concluir']); area.appendChild(anuncio); document.body.appendChild(area);
        },
        aoEscape: (modal) => { chamadas.push(['escape', modal?.id]); if (modal === cancelarPorEscape) app.fecharModal(modal); },
        focarRetorno: (alvo) => alvo.focus({ preventScroll: true }) };
    const app = criarModais(opcoes);
    t.after(() => app.encerrar());
    origem.focus(); focos.length = 0;
    return { app, opcoes, document, movimento, chamadas, focos, elemento, a, b, conteudo,
        origem, alternativa, existenteInerte, area, anuncio, lista,
        permitirEscape(modal) { cancelarPorEscape = modal; },
        tab(shiftKey = false) { return document.emitir('keydown', { key: 'Tab', shiftKey }); },
        terminar(modal) { modal.emitir('transitionend', { propertyName: 'opacity' }); } };
}

test('importação não consulta DOM, preferência, armazenamento ou timers', () => {
    const url = pathToFileURL(resolve(__dirname, '../../frontend/js/ui/modais.js')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        for (const nome of ['document', 'window', 'localStorage', 'matchMedia', 'addEventListener', 'setTimeout']) {
            Object.defineProperty(globalThis, nome, { get() { throw new Error(nome); } });
        }
        const modulo = await import(${JSON.stringify(url)});
        if (Object.keys(modulo).join() !== 'criarModais') throw new Error('API inesperada');
    `], { stdio: 'pipe' });
});

test('inicialização é explícita e repetição não duplica listeners ou consultas', (t) => {
    const a = ambiente(t);
    assert.deepEqual(Object.keys(a.app).sort(), ['abrirModal', 'fecharModal', 'obterModalAtivo', 'definirFocoRetorno', 'encerrar'].sort());
    assert.equal(a.app.obterModalAtivo(), null);
    assert.deepEqual(a.chamadas, []);
    assert.strictEqual(criarModais(a.opcoes), a.app);
    assert.equal(a.document.listeners.get('keydown:true').size, 1);
    assert.equal(a.document.listeners.get('keydown:false').size, 1);
    assert.equal(a.document.listeners.get('click:true').size, 1);
    assert.equal(a.document.listeners.get('submit:true').size, 1);
    assert.equal(a.movimento.listeners.get('change:false').size, 1);
});

test('abertura apresenta overlay, foca imediatamente e mantém ARIA existente', (t) => {
    const a = ambiente(t);
    assert.equal(a.app.abrirModal(a.a.modal, a.a.campo), undefined);
    assert.strictEqual(a.app.obterModalAtivo(), a.a.modal);
    assert.equal(a.a.modal.classList.contains('hidden'), false);
    assert.equal(a.a.modal.classList.contains('modal-abrindo'), true);
    assert.equal(a.a.modal.classList.contains('modal-entrando'), false);
    assert.strictEqual(a.document.activeElement, a.a.campo);
    assert.equal(a.a.painel.getAttribute('aria-modal'), 'true');
    assert.equal(a.a.painel.getAttribute('aria-labelledby'), 'titulo-a');
    assert.equal(a.origem.inert, true);
    assert.equal(a.conteudo.inert, false);
    assert.equal(a.a.modal.inert, false);
    assert.equal(a.b.modal.inert, true);
    assert.equal(a.area.inert, false);
});

test('entrada usa duração atual e só termina por opacity do overlay ou fallback de 250 ms', (t) => {
    const a = ambiente(t); a.app.abrirModal(a.a.modal, a.a.campo);
    a.a.modal.emitir('transitionend', { target: a.a.painel, propertyName: 'opacity' });
    a.a.modal.emitir('transitionend', { propertyName: 'transform' });
    t.mock.timers.tick(249); assert.equal(a.a.modal.classList.contains('modal-abrindo'), true);
    t.mock.timers.tick(1); assert.equal(a.a.modal.classList.contains('modal-abrindo'), false);
    assert.strictEqual(a.area.parentElement, a.a.painel);
});

test('transitionend de entrada cancela fallback e não executa o callback duas vezes', (t) => {
    const a = ambiente(t); a.app.abrirModal(a.a.modal, a.a.campo);
    a.terminar(a.a.modal); const quantidade = a.chamadas.length;
    t.mock.timers.tick(1000);
    assert.equal(a.chamadas.length, quantidade);
    assert.equal(a.a.modal.listeners.get('transitionend:false').size, 0);
});

test('fechamento mantém foco e fundo bloqueado até concluir e só então limpa o formulário', (t) => {
    const a = ambiente(t), limpezas = [];
    a.app.abrirModal(a.a.modal, a.a.campo); a.terminar(a.a.modal);
    a.app.fecharModal(a.a.modal, () => limpezas.push('limpar'));
    assert.strictEqual(a.app.obterModalAtivo(), a.a.modal);
    assert.equal(a.a.modal.classList.contains('modal-saindo'), true);
    assert.equal(a.a.modal.classList.contains('hidden'), false);
    assert.strictEqual(a.document.activeElement, a.a.campo);
    assert.equal(a.origem.inert, true); assert.deepEqual(limpezas, []);
    t.mock.timers.tick(199); assert.equal(a.app.obterModalAtivo(), a.a.modal);
    t.mock.timers.tick(1);
    assert.equal(a.app.obterModalAtivo(), null); assert.equal(a.a.modal.classList.contains('hidden'), true);
    assert.deepEqual(limpezas, ['limpar']); assert.strictEqual(a.document.activeElement, a.origem);
    assert.equal(a.origem.inert, false); assert.equal(a.b.modal.inert, false);
    assert.equal(a.existenteInerte.inert, true);
    assert.strictEqual(a.area.parentElement, a.document.body); assert.strictEqual(a.anuncio.parentElement, a.area);
});

test('fechar diálogo inativo ou repetir fechamento não substitui a limpeza pendente', (t) => {
    const a = ambiente(t), limpezas = [];
    a.app.abrirModal(a.a.modal, a.a.campo);
    a.app.fecharModal(a.b.modal, () => limpezas.push('errado'));
    a.app.fecharModal(a.a.modal, () => limpezas.push('primeiro'));
    a.app.fecharModal(a.a.modal, () => limpezas.push('segundo'));
    a.terminar(a.a.modal); t.mock.timers.tick(1000);
    assert.deepEqual(limpezas, ['primeiro']);
});

test('retorno de foco usa alternativa quando origem foi removida, desabilitada ou ocultada', (t) => {
    const a = ambiente(t, true);
    for (const modo of ['removida', 'desabilitada', 'oculta']) {
        a.conteudo.appendChild(a.origem); a.origem.disabled = false; a.origem.visivel = true; a.origem.focus();
        a.app.abrirModal(a.a.modal, a.a.campo);
        if (modo === 'removida') a.origem.remove();
        if (modo === 'desabilitada') a.origem.disabled = true;
        if (modo === 'oculta') a.origem.visivel = false;
        a.app.fecharModal(a.a.modal);
        assert.strictEqual(a.document.activeElement, a.alternativa);
    }
});

test('funcionalidade pode definir retorno para controle recriado sem expor estado interno', (t) => {
    const a = ambiente(t, true);
    a.app.abrirModal(a.a.modal, a.a.campo);
    const novo = a.elemento('button', 'recriado'); a.conteudo.appendChild(novo);
    a.app.definirFocoRetorno(novo); a.app.fecharModal(a.a.modal);
    assert.strictEqual(a.document.activeElement, novo);
    assert.deepEqual(a.focos.at(-1), ['recriado', { preventScroll: true }]);
});

test('Tab e Shift+Tab contêm foco nos limites e deixam percurso intermediário nativo', (t) => {
    const a = ambiente(t, true); a.app.abrirModal(a.a.modal, a.a.campo);
    assert.equal(a.tab().defaultPrevented, false);
    a.a.ultimo.focus(); assert.equal(a.tab().defaultPrevented, true);
    assert.strictEqual(a.document.activeElement, a.a.primeiro);
    assert.equal(a.tab(true).defaultPrevented, true); assert.strictEqual(a.document.activeElement, a.a.ultimo);
    a.origem.focus(); assert.equal(a.tab().defaultPrevented, true); assert.strictEqual(a.document.activeElement, a.a.primeiro);
});

test('trap ignora controles inelegíveis e usa painel quando não há focáveis', (t) => {
    const a = ambiente(t, true); a.app.abrirModal(a.a.modal, a.a.campo);
    a.a.primeiro.disabled = true; a.a.ultimo.focus(); a.tab();
    assert.strictEqual(a.document.activeElement, a.a.campo);
    a.a.campo.visivel = false; a.a.ultimo.disabled = true;
    assert.equal(a.tab().defaultPrevented, true); assert.strictEqual(a.document.activeElement, a.a.painel);
});

test('Escape respeita a política fornecida e não descarta formulário por padrão', (t) => {
    const a = ambiente(t, true); a.app.abrirModal(a.a.modal, a.a.campo);
    a.document.emitir('keydown', { key: 'Escape' }); assert.strictEqual(a.app.obterModalAtivo(), a.a.modal);
    a.permitirEscape(a.a.modal); a.document.emitir('keydown', { key: 'Escape' });
    assert.equal(a.app.obterModalAtivo(), null); assert.strictEqual(a.document.activeElement, a.origem);
});

test('captura bloqueia click, submit e teclas na saída, preservando Tab', (t) => {
    const a = ambiente(t); a.app.abrirModal(a.a.modal, a.a.campo); a.app.fecharModal(a.a.modal);
    for (const [tipo, dados] of [['click', {}], ['submit', {}], ['keydown', { key: 'Escape' }]]) {
        const evento = a.document.emitir(tipo, dados);
        assert.equal(evento.defaultPrevented, true); assert.equal(evento.interrompido, true);
    }
    const tab = a.tab(); assert.equal(tab.interrompido, false);
    a.terminar(a.a.modal);
    assert.equal(a.document.emitir('click').interrompido, false);
});

test('reabertura durante saída cancela limpeza e callbacks antigos sem perder o foco de retorno', (t) => {
    const a = ambiente(t), limpezas = [];
    a.app.abrirModal(a.a.modal, a.a.campo); a.app.fecharModal(a.a.modal, () => limpezas.push('obsoleto'));
    const antigo = [...a.a.modal.listeners.get('transitionend:false')][0];
    a.app.abrirModal(a.a.modal, a.a.ultimo);
    antigo({ target: a.a.modal, propertyName: 'opacity' });
    assert.strictEqual(a.app.obterModalAtivo(), a.a.modal);
    assert.equal(a.a.modal.classList.contains('modal-abrindo'), true);
    t.mock.timers.tick(250); assert.deepEqual(limpezas, []);
    a.app.fecharModal(a.a.modal, () => limpezas.push('atual')); a.terminar(a.a.modal);
    assert.deepEqual(limpezas, ['atual']); assert.strictEqual(a.document.activeElement, a.origem);
});

test('troca direta conclui o anterior sem focar o fundo e preserva o destino original', (t) => {
    const a = ambiente(t), limpezas = [];
    a.app.abrirModal(a.a.modal, a.a.campo); a.app.fecharModal(a.a.modal, () => limpezas.push('a'));
    a.focos.length = 0; a.app.abrirModal(a.b.modal, a.b.campo);
    assert.deepEqual(limpezas, ['a']); assert.equal(a.a.modal.classList.contains('hidden'), true);
    assert.strictEqual(a.app.obterModalAtivo(), a.b.modal);
    assert.deepEqual(a.focos.map(([id]) => id), ['b-campo']);
    assert.strictEqual(a.anuncio.parentElement, a.b.painel);
    a.app.fecharModal(a.b.modal); a.terminar(a.b.modal);
    assert.strictEqual(a.document.activeElement, a.origem);
    assert.equal(a.conteudo.inert, false); assert.equal(a.existenteInerte.inert, true);
});

test('cliques rápidos alternando diálogos não deixam temporizadores alterando o modal atual', (t) => {
    const a = ambiente(t);
    for (let i = 0; i < 8; i++) {
        const atual = i % 2 ? a.b : a.a;
        a.app.abrirModal(atual.modal, atual.campo); a.app.fecharModal(atual.modal);
    }
    a.app.abrirModal(a.a.modal, a.a.campo); t.mock.timers.tick(2000);
    assert.strictEqual(a.app.obterModalAtivo(), a.a.modal);
    assert.equal(a.a.modal.classList.contains('hidden'), false);
    assert.strictEqual(a.document.activeElement, a.a.campo);
});

test('movimento reduzido desde o início não agenda esperas e fecha imediatamente', (t) => {
    const a = ambiente(t, true), limpezas = [];
    a.app.abrirModal(a.a.modal, a.a.campo);
    assert.equal(a.a.modal.classList.contains('modal-abrindo'), false);
    assert.equal(a.a.modal.listeners.get('transitionend:false'), undefined);
    a.app.fecharModal(a.a.modal, () => limpezas.push('fim'));
    assert.equal(a.app.obterModalAtivo(), null); assert.deepEqual(limpezas, ['fim']);
    const chamadas = a.chamadas.length; t.mock.timers.tick(1000); assert.equal(a.chamadas.length, chamadas);
});

test('ativar reduced motion durante entrada ou saída conclui apenas a fase atual', (t) => {
    const a = ambiente(t), limpezas = [];
    a.app.abrirModal(a.a.modal, a.a.campo);
    a.movimento.matches = true; a.movimento.emitir('change');
    assert.equal(a.a.modal.classList.contains('modal-abrindo'), false);
    assert.strictEqual(a.area.parentElement, a.a.painel);
    a.movimento.matches = false; a.app.fecharModal(a.a.modal, () => limpezas.push('fim'));
    a.movimento.matches = true; a.movimento.emitir('change');
    assert.equal(a.app.obterModalAtivo(), null); assert.deepEqual(limpezas, ['fim']);
    t.mock.timers.tick(1000); assert.deepEqual(limpezas, ['fim']);
});

test('encerramento libera fundo, foco, timers e listeners; nova inicialização é independente', (t) => {
    const a = ambiente(t), limpezas = [];
    a.app.abrirModal(a.a.modal, a.a.campo); a.app.fecharModal(a.a.modal, () => limpezas.push('fim'));
    a.app.encerrar(); a.app.encerrar();
    assert.equal(a.app.obterModalAtivo(), null); assert.deepEqual(limpezas, ['fim']);
    assert.equal(a.origem.inert, false); assert.equal(a.existenteInerte.inert, true);
    assert.strictEqual(a.document.activeElement, a.origem);
    for (const conjunto of a.document.listeners.values()) assert.equal(conjunto.size, 0);
    assert.equal(a.movimento.listeners.get('change:false').size, 0);
    assert.equal(a.a.modal.listeners.get('transitionend:false').size, 0);
    a.app.abrirModal(a.a.modal, a.a.campo); assert.equal(a.app.obterModalAtivo(), null);
    const novo = criarModais(a.opcoes); t.after(() => novo.encerrar());
    assert.notStrictEqual(novo, a.app); novo.abrirModal(a.b.modal, a.b.campo);
    t.mock.timers.tick(1000); assert.strictEqual(novo.obterModalAtivo(), a.b.modal);
    assert.equal(a.document.listeners.get('keydown:false').size, 1);
});

test('documentos independentes não compartilham modal ativo ou listeners', (t) => {
    const a = ambiente(t), document = eventos({ body: {} });
    const outro = criarModais({ ...a.opcoes, document }); t.after(() => outro.encerrar());
    a.app.abrirModal(a.a.modal, a.a.campo);
    assert.equal(outro.obterModalAtivo(), null); outro.encerrar();
    assert.strictEqual(a.app.obterModalAtivo(), a.a.modal);
    assert.equal(a.document.listeners.get('keydown:false').size, 1);
});

test('toasts reais acompanham abertura, fechamento e troca; anúncio fica no diálogo durante a saída', (t) => {
    const a = ambiente(t, true);
    const notificacoes = criarNotificacoes({ areaNotificacoes: a.area, listaNotificacoes: a.lista, anuncioNotificacoes: a.anuncio,
        movimentoReduzido: a.movimento, podeReceberFoco: a.opcoes.podeReceberFoco,
        obterFocoAlternativo: () => a.app.obterModalAtivo()?.querySelector('button, input') ?? a.origem,
        agendarQuadro: () => 0, cancelarQuadro: () => {} });
    t.after(() => notificacoes.encerrar());
    notificacoes.mostrarToast('Erro inicial', 'erro');
    a.movimento.matches = false;
    a.app.abrirModal(a.a.modal, a.a.campo);
    assert.strictEqual(a.area.parentElement, a.a.modal); assert.strictEqual(a.anuncio.parentElement, a.a.painel);
    a.terminar(a.a.modal);
    assert.strictEqual(a.area.parentElement, a.a.painel);
    a.app.fecharModal(a.a.modal);
    assert.strictEqual(a.anuncio.parentElement, a.a.painel);
    a.app.abrirModal(a.b.modal, a.b.campo); a.terminar(a.b.modal);
    assert.strictEqual(a.area.parentElement, a.b.painel); assert.strictEqual(a.anuncio.parentElement, a.area);
    a.app.fecharModal(a.b.modal); a.terminar(a.b.modal);
    assert.strictEqual(a.area.parentElement, a.document.body); assert.strictEqual(a.anuncio.parentElement, a.area);
    assert.equal(a.lista.children.length, 1);
});

test('adaptador real de Escape mantém os três fluxos específicos de confirmação', (t) => {
    const a = ambiente(t), chamadas = [], investimento = a.elemento('div');
    const trecho = fonte.slice(fonte.indexOf('const modais = criarModais('), fonte.indexOf('const funcionalidadeContas ='));
    let opcoes;
    const contexto = createContext({
        document: { getElementById: (id) => id === 'modal-exclusao-investimento' ? investimento : null },
        window: { matchMedia: () => a.movimento }, podeReceberFoco: a.opcoes.podeReceberFoco,
        areaNotificacoes: a.area, anuncioNotificacoes: a.anuncio, posicionarNotificacoesModal() {},
        modalExclusao: a.a.modal, modalExclusaoConta: a.b.modal,
        criarModais: (recebidas) => { opcoes = recebidas; return {}; },
        fecharModal: (modal) => chamadas.push(modal),
        operacoesTransacoes: { cancelarExclusao: () => chamadas.push(a.a.modal) },
        fecharModalExclusaoConta: () => chamadas.push('conta'),
        fecharExclusaoInvestimento: () => chamadas.push('investimento')
    });
    new Script(trecho).runInContext(contexto);
    opcoes.aoEscape(a.elemento('div')); assert.deepEqual(chamadas, []);
    a.a.modal.classList.remove('hidden'); opcoes.aoEscape(a.a.modal);
    assert.strictEqual(chamadas[0], a.a.modal);
    a.a.modal.classList.add('hidden'); opcoes.aoEscape(a.b.modal); opcoes.aoEscape(investimento);
    assert.deepEqual(chamadas.slice(1), ['conta', 'investimento']);
});

test('adaptador de Investimentos delega o retorno de foco à apresentação', () => {
    const trecho = fonte.match(/^function prepararRetornoFocoInvestimento\([^]*?^\}/m)[0];
    const chamadas = [];
    const contexto = createContext({ apresentacaoInvestimentos: {
        prepararRetornoFocoInvestimento: (...args) => chamadas.push(args)
    } });
    const preparar = new Script(trecho + '\nprepararRetornoFocoInvestimento').runInContext(contexto);
    preparar('id-teste', 'editar');
    assert.deepEqual(chamadas, [['id-teste', 'editar']]);
});
