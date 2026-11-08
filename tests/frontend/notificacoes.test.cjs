'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { Script, createContext } = require('node:vm');
const { criarNotificacoes } = require('../../frontend/js/ui/notificacoes.js');

// Apenas árvore, classes e eventos usados pelo controlador. Layout, hover real e
// anúncios de leitor de tela são verificados separadamente no navegador.
function eventos(alvo = {}) {
    const listeners = new Map();
    return Object.assign(alvo, {
        listeners,
        addEventListener(tipo, acao) {
            if (!listeners.has(tipo)) listeners.set(tipo, new Set());
            listeners.get(tipo).add(acao);
        },
        removeEventListener(tipo, acao) { listeners.get(tipo)?.delete(acao); },
        emitir(tipo, dados = {}) { for (const acao of [...(listeners.get(tipo) ?? [])]) acao({ target: alvo, ...dados }); }
    });
}

function ambiente(t, reduzido = true) {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
    const document = { activeElement: null };
    function elemento(tag) {
        const classes = new Set(), atributos = new Map();
        return eventos({ tag, ownerDocument: document, children: [], parentElement: null,
            textContent: '', inert: false, hover: false, offsetWidth: 100,
            classList: { add: (...nomes) => nomes.forEach((nome) => classes.add(nome)),
                remove: (...nomes) => nomes.forEach((nome) => classes.delete(nome)), contains: (nome) => classes.has(nome) },
            setAttribute: (nome, valor) => atributos.set(nome, valor),
            getAttribute: (nome) => atributos.get(nome) ?? null,
            appendChild(filho) { filho.remove(); this.children.push(filho); filho.parentElement = this; return filho; },
            append(...filhos) { filhos.forEach((filho) => this.appendChild(filho)); },
            remove() {
                if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((filho) => filho !== this);
                this.parentElement = null;
            },
            contains(filho) { return this === filho || this.children.some((item) => item.contains(filho)); },
            get isConnected() { return document.body.contains(this); },
            matches(seletor) { assert.equal(seletor, ':hover'); return this.hover; },
            querySelector(seletor) {
                const aceita = (item) => seletor === '[role="dialog"]' ? item.getAttribute('role') === 'dialog'
                    : seletor.split(',').map((tag) => tag.trim()).includes(item.tag);
                const buscar = (raiz) => {
                    for (const filho of raiz.children) {
                        if (aceita(filho)) return filho;
                        const encontrado = buscar(filho); if (encontrado) return encontrado;
                    }
                    return null;
                };
                return buscar(this);
            },
            focus() { document.activeElement = this; }
        });
    }
    document.createElement = elemento;
    document.body = elemento('body');
    const area = elemento('section'), lista = elemento('div'), anuncio = elemento('div'), alternativa = elemento('button');
    area.append(anuncio, lista); document.body.append(area, alternativa);
    const movimento = eventos({ matches: reduzido }), quadros = new Map();
    let numeroQuadro = 0, antes = 0, criacoes = 0, focoAlternativo = alternativa;
    const criar = document.createElement;
    document.createElement = (tag) => { criacoes++; return criar(tag); };
    const opcoes = { areaNotificacoes: area, listaNotificacoes: lista, anuncioNotificacoes: anuncio,
        movimentoReduzido: movimento, podeReceberFoco: (alvo) => Boolean(alvo?.isConnected && !alvo.inert),
        obterFocoAlternativo: () => focoAlternativo, antesDeExibir: () => { antes++; },
        agendarQuadro: (acao) => { const id = ++numeroQuadro; quadros.set(id, acao); return id; },
        cancelarQuadro: (id) => quadros.delete(id) };
    const app = criarNotificacoes(opcoes);
    t.after(() => app.encerrar());
    return { app, opcoes, document, area, lista, anuncio, alternativa, movimento, quadros, elemento,
        get antes() { return antes; }, get criacoes() { return criacoes; },
        definirFocoAlternativo(alvo) { focoAlternativo = alvo; },
        mensagens: () => lista.children.map((toast) => toast.children[0].children[1].textContent),
        fechar: (toast = lista.children[0]) => toast.querySelector('button').emitir('click'),
        quadro() { const pendentes = [...quadros.values()]; quadros.clear(); pendentes.forEach((acao) => acao()); }
    };
}

test('importação não acessa DOM, storage, matchMedia, listeners, frames ou timers', () => {
    const url = pathToFileURL(resolve(__dirname, '../../frontend/js/ui/notificacoes.js')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        for (const nome of ['document', 'window', 'localStorage', 'matchMedia', 'addEventListener', 'setTimeout', 'requestAnimationFrame']) {
            Object.defineProperty(globalThis, nome, { get() { throw new Error(nome); } });
        }
        const modulo = await import(${JSON.stringify(url)});
        if (Object.keys(modulo).join() !== 'criarNotificacoes') throw new Error('API inesperada');
    `], { stdio: 'pipe' });
});

test('inicialização explícita cria apenas um listener e API privada mínima', (t) => {
    const a = ambiente(t);
    assert.deepEqual(Object.keys(a.app).sort(), ['encerrar', 'mostrarToast']);
    assert.equal(a.criacoes, 0);
    assert.equal(a.antes, 0);
    assert.equal(a.movimento.listeners.get('change').size, 1);
    assert.strictEqual(criarNotificacoes(a.opcoes), a.app);
    assert.equal(a.movimento.listeners.get('change').size, 1);
    assert.deepEqual(a.mensagens(), []);
});

test('exibição preserva texto literal, rótulos, classes e ausência de foco automático', (t) => {
    const a = ambiente(t);
    a.alternativa.focus();
    assert.equal(a.app.mostrarToast('<b>Salvo</b>', 'sucesso'), undefined);
    const toast = a.lista.children[0];
    assert.deepEqual(a.mensagens(), ['<b>Salvo</b>']);
    assert.equal(toast.classList.contains('notificacao-sucesso'), true);
    assert.equal(toast.getAttribute('role'), 'group');
    assert.equal(toast.getAttribute('aria-label'), 'Sucesso');
    assert.equal(toast.querySelector('button').getAttribute('aria-label'), 'Fechar notificação: Sucesso');
    assert.strictEqual(a.document.activeElement, a.alternativa);
    assert.equal(a.antes, 1);
    t.mock.timers.tick(100);
    assert.equal(a.anuncio.textContent, 'Sucesso: <b>Salvo</b>');
});

test('tipos desconhecidos preservam fallback para informação', (t) => {
    const a = ambiente(t);
    a.app.mostrarToast('Aviso', 'aviso');
    assert.equal(a.lista.children[0].classList.contains('notificacao-informacao'), true);
    assert.equal(a.lista.children[0].getAttribute('aria-label'), 'Informação');
});

test('deduplicação considera mensagem e tipo nas notificações ativas e na fila', (t) => {
    const a = ambiente(t);
    for (const mensagem of ['A', 'B', 'C', 'D', 'D']) a.app.mostrarToast(mensagem, 'erro');
    a.app.mostrarToast('A', 'erro');
    assert.deepEqual(a.mensagens(), ['A', 'B', 'C']);
    a.fechar(); assert.deepEqual(a.mensagens(), ['B', 'C', 'D']);
    a.fechar(); assert.deepEqual(a.mensagens(), ['C', 'D']);
    a.app.mostrarToast('D', 'informacao');
    assert.deepEqual(a.mensagens(), ['C', 'D', 'D']);
});

test('fila respeita ordem e limite de três com erros persistentes', (t) => {
    const a = ambiente(t);
    ['A', 'B', 'C', 'D', 'E'].forEach((mensagem) => a.app.mostrarToast(mensagem, 'erro'));
    t.mock.timers.tick(60000);
    assert.deepEqual(a.mensagens(), ['A', 'B', 'C']);
    a.fechar(); assert.deepEqual(a.mensagens(), ['B', 'C', 'D']);
    a.fechar(); assert.deepEqual(a.mensagens(), ['C', 'D', 'E']);
});

test('ao atingir limite substitui a primeira temporária elegível, mantendo o máximo', (t) => {
    const a = ambiente(t, false);
    a.app.mostrarToast('Erro', 'erro'); a.app.mostrarToast('Primeira', 'sucesso'); a.app.mostrarToast('Segunda');
    a.app.mostrarToast('Nova');
    assert.equal(a.lista.children.length, 3);
    assert.equal(a.lista.children[1].classList.contains('notificacao-saindo'), true);
    assert.equal(a.lista.children[1].inert, true);
    t.mock.timers.tick(199);
    assert.deepEqual(a.mensagens(), ['Erro', 'Primeira', 'Segunda']);
    t.mock.timers.tick(1);
    assert.deepEqual(a.mensagens(), ['Erro', 'Segunda', 'Nova']);
});

test('mensagem temporária focada não é substituída ao liberar espaço', (t) => {
    const a = ambiente(t);
    a.app.mostrarToast('Focada'); a.app.mostrarToast('Erro B', 'erro'); a.app.mostrarToast('Erro C', 'erro');
    a.lista.children[0].querySelector('button').focus();
    a.app.mostrarToast('Fila');
    assert.deepEqual(a.mensagens(), ['Focada', 'Erro B', 'Erro C']);
    a.fechar(a.lista.children[1]);
    assert.deepEqual(a.mensagens(), ['Focada', 'Erro C', 'Fila']);
});

test('sucesso e informação permanecem quatro segundos; erro não expira', (t) => {
    const a = ambiente(t);
    a.app.mostrarToast('Sucesso', 'sucesso'); a.app.mostrarToast('Informação'); a.app.mostrarToast('Erro', 'erro');
    t.mock.timers.tick(3999);
    assert.equal(a.lista.children.length, 3);
    t.mock.timers.tick(1);
    assert.deepEqual(a.mensagens(), ['Erro']);
});

test('hover pausa e retoma somente o tempo restante', (t) => {
    const a = ambiente(t);
    a.app.mostrarToast('Pausada');
    const toast = a.lista.children[0];
    t.mock.timers.tick(1000); toast.hover = true; toast.emitir('mouseenter');
    t.mock.timers.tick(10000); assert.equal(a.lista.children.length, 1);
    toast.hover = false; toast.emitir('mouseleave'); toast.emitir('mouseleave');
    t.mock.timers.tick(2999); assert.equal(a.lista.children.length, 1);
    t.mock.timers.tick(1); assert.equal(a.lista.children.length, 0);
});

test('foco pausa; transição interna não retoma; saída do foco retoma', (t) => {
    const a = ambiente(t);
    a.app.mostrarToast('Foco');
    const toast = a.lista.children[0], botao = toast.querySelector('button');
    t.mock.timers.tick(1000); botao.focus(); toast.emitir('focusin', { relatedTarget: a.alternativa });
    toast.emitir('focusout', { relatedTarget: botao });
    t.mock.timers.tick(8000); assert.equal(a.lista.children.length, 1);
    a.alternativa.focus(); toast.emitir('focusout', { relatedTarget: a.alternativa });
    t.mock.timers.tick(3000); assert.equal(a.lista.children.length, 0);
});

test('fechamento manual restaura foco anterior ou usa callback alternativo atualizado', (t) => {
    const a = ambiente(t);
    const anterior = a.elemento('button'); a.document.body.appendChild(anterior);
    a.app.mostrarToast('A', 'erro');
    const toast = a.lista.children[0]; toast.querySelector('button').focus(); toast.emitir('focusin', { relatedTarget: anterior });
    a.fechar(); assert.strictEqual(a.document.activeElement, anterior);
    const modal = a.elemento('div'), botaoModal = a.elemento('button'); modal.appendChild(botaoModal); a.document.body.appendChild(modal);
    // A mesma referência fornecida à fábrica pode consultar um contexto mutável.
    a.definirFocoAlternativo(botaoModal);
    a.app.mostrarToast('B', 'erro'); a.lista.children[0].querySelector('button').focus();
    a.fechar(); assert.strictEqual(a.document.activeElement, botaoModal);
});

test('fechar notificação focada transfere foco para outra notificação antes de removê-la', (t) => {
    const a = ambiente(t);
    a.app.mostrarToast('A', 'erro'); a.app.mostrarToast('B', 'erro');
    const botaoSeguinte = a.lista.children[1].querySelector('button');
    a.lista.children[0].querySelector('button').focus(); a.fechar();
    assert.strictEqual(a.document.activeElement, botaoSeguinte);
});

test('entrada usa frame e saída aguarda opacity; eventos de filhos/propriedades diferentes não concluem', (t) => {
    const a = ambiente(t, false);
    a.app.mostrarToast('Animada');
    const toast = a.lista.children[0];
    assert.equal(toast.classList.contains('notificacao-entrando'), true);
    assert.equal(a.quadros.size, 1); a.quadro();
    assert.equal(toast.classList.contains('notificacao-entrando'), false);
    toast.emitir('transitionend', { propertyName: 'opacity' });
    assert.equal(toast.classList.contains('notificacao-animando'), false);
    a.fechar(); a.fechar();
    toast.emitir('transitionend', { target: toast.querySelector('button'), propertyName: 'opacity' });
    toast.emitir('transitionend', { propertyName: 'transform' });
    assert.equal(a.lista.children.length, 1);
    toast.emitir('transitionend', { propertyName: 'opacity' });
    assert.equal(a.lista.children.length, 0);
    t.mock.timers.tick(5000); assert.equal(a.lista.children.length, 0);
});

test('fechar durante entrada cancela frame e timer antigos sem remover mensagem posterior', (t) => {
    const a = ambiente(t, false);
    a.app.mostrarToast('Antiga', 'erro');
    const antiga = a.lista.children[0]; a.fechar();
    assert.equal(a.quadros.size, 0);
    a.app.mostrarToast('Nova', 'erro');
    t.mock.timers.tick(200);
    assert.deepEqual(a.mensagens(), ['Nova']);
    assert.equal(antiga.listeners.get('transitionend').size, 0);
    t.mock.timers.tick(1000); assert.deepEqual(a.mensagens(), ['Nova']);
});

test('reduced motion elimina espera de animação e mudança durante saída conclui limpeza', (t) => {
    const a = ambiente(t, false);
    a.app.mostrarToast('A', 'erro'); a.app.mostrarToast('B', 'erro');
    a.fechar(); a.movimento.matches = true; a.movimento.emitir('change');
    assert.deepEqual(a.mensagens(), ['B']);
    assert.equal(a.quadros.size, 0);
    assert.equal(a.lista.children[0].classList.contains('notificacao-animando'), false);
    a.fechar(); assert.equal(a.lista.children.length, 0);
    a.app.mostrarToast('Temporária');
    assert.equal(a.quadros.size, 0);
    t.mock.timers.tick(4000); assert.equal(a.lista.children.length, 0);
});

test('anúncios consecutivos são agrupados e deduplicados sem reiniciar região live', (t) => {
    const a = ambiente(t);
    a.app.mostrarToast('A', 'erro'); a.app.mostrarToast('B', 'erro'); a.app.mostrarToast('A', 'erro');
    t.mock.timers.tick(99); assert.equal(a.anuncio.textContent, '');
    t.mock.timers.tick(1); assert.equal(a.anuncio.textContent, 'Erro: A Erro: B');
    a.app.mostrarToast('A', 'erro');
    assert.equal(a.anuncio.textContent, 'Erro: A Erro: B');
});

test('instâncias em contêineres distintos têm filas, timers e encerramento independentes', (t) => {
    const a = ambiente(t);
    const area = a.elemento('section'), lista = a.elemento('div'), anuncio = a.elemento('div');
    area.append(anuncio, lista); a.document.body.appendChild(area);
    const outra = criarNotificacoes({ ...a.opcoes, areaNotificacoes: area, listaNotificacoes: lista, anuncioNotificacoes: anuncio });
    t.after(() => outra.encerrar());
    a.app.mostrarToast('Mesma', 'erro'); outra.mostrarToast('Mesma', 'erro');
    assert.equal(a.lista.children.length, 1); assert.equal(lista.children.length, 1);
    a.app.encerrar();
    assert.equal(lista.children.length, 1); assert.equal(a.movimento.listeners.get('change').size, 1);
});

test('encerramento cancela timers, frames, fila, anúncios e listeners e permite nova inicialização', (t) => {
    const a = ambiente(t, false);
    ['A', 'B', 'C', 'D'].forEach((mensagem) => a.app.mostrarToast(mensagem));
    const antigas = [...a.lista.children];
    a.app.encerrar(); a.app.encerrar();
    assert.equal(a.lista.children.length, 0); assert.equal(a.quadros.size, 0);
    assert.equal(a.movimento.listeners.get('change').size, 0);
    for (const toast of antigas) {
        for (const conjunto of toast.listeners.values()) assert.equal(conjunto.size, 0);
        assert.equal(toast.querySelector('button').listeners.get('click').size, 0);
    }
    a.app.mostrarToast('Ignorada'); t.mock.timers.tick(10000);
    assert.equal(a.lista.children.length, 0); assert.equal(a.anuncio.textContent, '');
    const nova = criarNotificacoes(a.opcoes); t.after(() => nova.encerrar());
    assert.notStrictEqual(nova, a.app); nova.mostrarToast('Nova');
    t.mock.timers.tick(1000); assert.deepEqual(a.mensagens(), ['Nova']);
});

test('encerramento devolve foco antes de remover o toast focado', (t) => {
    const a = ambiente(t);
    a.app.mostrarToast('A', 'erro'); a.lista.children[0].querySelector('button').focus();
    a.app.encerrar(); assert.strictEqual(a.document.activeElement, a.alternativa);
});

test('encerramento não restaura foco para outro toast que também será removido', (t) => {
    const a = ambiente(t);
    a.app.mostrarToast('A', 'erro'); a.app.mostrarToast('B', 'erro');
    const anterior = a.lista.children[0].querySelector('button'), atual = a.lista.children[1];
    atual.querySelector('button').focus(); atual.emitir('focusin', { relatedTarget: anterior });
    a.app.encerrar(); assert.strictEqual(a.document.activeElement, a.alternativa);
});

test('integração usa o reposicionamento real do script sem importar modais', (t) => {
    const a = ambiente(t);
    const fonte = readFileSync(resolve(__dirname, '../../frontend/js/script.js'), 'utf8');
    const trecho = fonte.match(/^function posicionarNotificacoesModal\([^]*?^\}/m)[0];
    const contexto = createContext({ document: a.document, areaNotificacoes: a.area, anuncioNotificacoes: a.anuncio });
    const posicionar = new Script(trecho + '\nposicionarNotificacoesModal').runInContext(contexto);
    const modal = a.elemento('div'), painel = a.elemento('div'); painel.setAttribute('role', 'dialog');
    modal.appendChild(painel); a.document.body.appendChild(modal);
    a.app.mostrarToast('Durante modal', 'erro');
    const botao = a.lista.children[0].querySelector('button'); botao.focus();
    posicionar(modal, false);
    assert.strictEqual(a.area.parentElement, modal); assert.strictEqual(a.anuncio.parentElement, painel);
    assert.strictEqual(a.document.activeElement, botao);
    t.mock.timers.tick(100); assert.equal(a.anuncio.textContent, 'Erro: Durante modal');
    posicionar(modal, true);
    assert.strictEqual(a.area.parentElement, painel); assert.strictEqual(a.anuncio.parentElement, a.area);
    assert.strictEqual(a.document.activeElement, botao);
});

test('adaptador inicializa antes da leitura e notifica falha sem consultar modal ainda não inicializado', (t) => {
    const a = ambiente(t);
    a.app.encerrar();
    const fonte = readFileSync(resolve(__dirname, '../../frontend/js/script.js'), 'utf8');
    const inicializacao = fonte.slice(fonte.indexOf('const notificacoes = criarNotificacoes('), fonte.indexOf('const disponibilidadeColecoes'));
    const carregar = fonte.match(/^function carregarColecao\([^]*?^\}/m)[0];
    const mostrar = fonte.match(/^function mostrarToast\([^]*?^\}/m)[0];
    const ordem = [], bloqueios = [];
    const contexto = createContext({
        document: a.document, areaNotificacoes: a.area, listaNotificacoes: a.lista, anuncioNotificacoes: a.anuncio,
        window: { matchMedia: () => a.movimento }, addReceita: a.alternativa,
        podeReceberFoco: () => { throw new Error('Consulta prematura de foco'); },
        criarNotificacoes: (opcoes) => {
            ordem.push('notificacoes');
            const controlador = criarNotificacoes({ ...opcoes, agendarQuadro: a.opcoes.agendarQuadro, cancelarQuadro: a.opcoes.cancelarQuadro });
            t.after(() => controlador.encerrar()); return controlador;
        },
        disponibilidadeColecoes: {
            inicializarTransacoes: () => { ordem.push('leitura'); return { sucesso: false, erro: new Error('JSON inválido') }; },
            bloquearColecao: (chave) => bloqueios.push(chave)
        }
    });
    new Script(inicializacao + '\n' + carregar + '\n' + mostrar
        + '\ncarregarColecao("transacoes");\nlet modalAtivo = null;').runInContext(contexto);
    assert.deepEqual(ordem, ['notificacoes', 'leitura']);
    assert.deepEqual(bloqueios, ['transacoes']);
    assert.match(a.mensagens()[0], /dados de transacoes estão indisponíveis/);
    assert.equal(a.lista.children[0].classList.contains('notificacao-erro'), true);
});
