'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const { criarOperacoesTransacoes } = require('../../frontend/js/funcionalidades/operacoes-transacoes.js');
const { criarListagensTransacoes } = require('../../frontend/js/funcionalidades/listagens-transacoes.js');
const { transacao, conta, aporte, resgate, investimento } = require('./support/fixtures.cjs');

// Double limitado às operações usadas pela listagem. Não simula CSS ou cálculos financeiros.
class Alvo {
    eventos = new Map();
    addEventListener(tipo, callback) { if (!this.eventos.has(tipo)) this.eventos.set(tipo, new Set()); this.eventos.get(tipo).add(callback); }
    removeEventListener(tipo, callback) { this.eventos.get(tipo)?.delete(callback); }
    dispatchEvent(evento) { evento.target ??= this; for (const cb of [...this.eventos.get(evento.type) ?? []]) cb(evento); }
    emitir(type) { this.dispatchEvent({ type, target: this }); }
    listeners() { return [...this.eventos.values()].reduce((n, callbacks) => n + callbacks.size, 0); }
}

function ambiente({ registros = [], mobile = false, reduced = true, animar = false, observadores = true } = {}) {
    let transacoes = registros, contas = [conta()], investimentos = [investimento()];
    const bloqueadas = new Set(), elementosId = new Map(), efeitos = [], animacoes = [], ios = [], ros = [], quadros = new Map();
    let indiceQuadro = 0;
    const document = { activeElement: null, getElementById: (id) => elementosId.get(id),
        createElement: (tag) => new Elemento(tag), createTextNode: (texto) => new Elemento('#text', texto),
        querySelectorAll: (seletor) => [refs.listaTransacoes, refs.listaTransacoesCompleta].flatMap((tabela) => tabela.querySelectorAll(seletor)) };
    class Elemento extends Alvo {
        constructor(tag = 'div', texto = '') {
            super(); this.tag = tag; this.children = []; this.parentElement = null; this.ownerDocument = document;
            this.texto = texto; this.classes = new Set(); this.atributos = new Map(); this.style = { minHeight: '', height: '', setProperty: (nome, valor) => { this.style[nome] = valor; } };
            this.disabled = false; this.inert = false; this.value = ''; this.checked = false;
            this.classList = { add: (...nomes) => nomes.forEach((n) => this.classes.add(n)), remove: (...nomes) => nomes.forEach((n) => this.classes.delete(n)),
                contains: (nome) => this.classes.has(nome), toggle: (nome, ativo) => { const proximo = ativo ?? !this.classes.has(nome); if (proximo) this.classes.add(nome); else this.classes.delete(nome); return proximo; } };
            if (animar) this.animate = (frames, opcoes) => {
                let resolver, rejeitar, concluida = false;
                const finished = new Promise((sim, nao) => { resolver = sim; rejeitar = nao; });
                const animacao = { alvo: this, frames, opcoes, finished,
                    terminar() { if (!concluida) { concluida = true; resolver(); } },
                    cancel() { if (!concluida) { concluida = true; rejeitar(new Error('Cancelada')); } },
                    get concluida() { return concluida; } };
                animacoes.push(animacao); return animacao;
            };
        }
        get className() { return [...this.classes].join(' '); } set className(valor) { this.classes = new Set(valor.split(' ').filter(Boolean)); }
        get textContent() { return this.texto + this.children.map((filho) => filho.textContent).join(''); }
        set textContent(valor) { this.texto = String(valor); this.children = []; }
        set innerHTML(valor) {
            this.texto = ''; this.children = [];
            if (valor) { const option = new Elemento('option'); option.value = 'todas'; option.textContent = 'Todas as categorias'; this.appendChild(option); }
        }
        get lastChild() { return this.children.at(-1); }
        appendChild(filho) { if (filho.parentElement) filho.parentElement.children = filho.parentElement.children.filter((n) => n !== filho); this.children.push(filho); filho.parentElement = this; return filho; }
        append(...filhos) { filhos.forEach((f) => this.appendChild(typeof f === 'string' ? document.createTextNode(f) : f)); }
        prepend(filho) { this.appendChild(filho); this.children.unshift(this.children.pop()); }
        replaceChildren(...filhos) { this.children.forEach((f) => { f.parentElement = null; }); this.children = []; this.texto = ''; this.append(...filhos); }
        setAttribute(nome, valor) { this.atributos.set(nome, String(valor)); }
        getAttribute(nome) { return this.atributos.get(nome) ?? null; }
        removeAttribute(nome) { this.atributos.delete(nome); }
        matches(seletor) { return seletor.startsWith('.') ? this.classes.has(seletor.slice(1)) : this.tag === seletor; }
        closest(seletor) { for (let n = this; n; n = n.parentElement) if (n.matches(seletor)) return n; return null; }
        querySelectorAll(seletor) {
            if (seletor === ':scope > tr') return this.children.filter((n) => n.tag === 'tr');
            return this.children.flatMap((n) => [...(n.matches(seletor) ? [n] : []), ...n.querySelectorAll(seletor)]);
        }
        contains(alvo) { for (let n = alvo; n; n = n.parentElement) if (n === this) return true; return false; }
        focus() { document.activeElement = this; }
        click() { if (!this.disabled) this.emitir('click'); }
        getBoundingClientRect() {
            const altura = this === area ? 40 + refs.listaTransacoesCompleta.children.length * 50 : 50;
            return { height: altura, top: 0, bottom: altura, left: 0, right: 390, width: 390 };
        }
    }
    const ids = { listaTransacoes: 'lista-transacoes', listaTransacoesCompleta: 'lista-transacoes-completa', areaAcoes: 'area-acoes',
        quantidadeSelecionadas: 'transacoes-selecionadas', botaoEditar: 'btn-editar', botaoExcluir: 'btn-excluir', areaAcoesCompleta: 'area-acoes-completa',
        quantidadeSelecionadasCompleta: 'transacoes-selecionadas-completa', botaoEditarCompleta: 'btn-editar-completa', botaoExcluirCompleta: 'btn-excluir-completa',
        campoPesquisa: 'pesquisa-transacoes', filtroTipo: 'filtro-tipo', filtroCategoria: 'filtro-categoria', filtroClassificacao: 'filtro-classificacao',
        filtroDataInicial: 'data-inicial', filtroDataFinal: 'data-final', erroFiltroDatas: 'erro-filtro-datas', botaoLimparFiltros: 'limpar-filtros',
        paginaTransacoes: 'pagina-transacoes', barraAcoesCompleta: 'barra-acoes-completa', barraContextual: 'barra-contextual-transacoes',
        quantidadeContextual: 'quantidade-contextual-transacoes', infoPaginacao: 'info-paginacao', botaoPaginaAnterior: 'pagina-anterior', botaoProximaPagina: 'proxima-pagina' };
    const refs = Object.fromEntries(Object.entries(ids).map(([nome, id]) => {
        const el = new Elemento(nome.startsWith('listaTransacoes') ? 'tbody' : 'div'); elementosId.set(id, el); return [nome, el];
    }));
    for (const id of ['total-resultados', 'selecionar-pagina', 'limpar-selecao-completa', 'editar-selecao-contextual', 'excluir-selecao-contextual', 'cancelar-selecao-contextual']) elementosId.set(id, new Elemento('button'));
    refs.paginaTransacoes.classList.add('ativa'); refs.filtroTipo.value = 'todos'; refs.filtroCategoria.value = 'todas'; refs.filtroClassificacao.value = 'todas';
    refs.barraContextual.append(...['editar-selecao-contextual', 'excluir-selecao-contextual', 'cancelar-selecao-contextual'].map((id) => elementosId.get(id)));
    refs.barraAcoesCompleta.append(refs.botaoEditarCompleta, refs.botaoExcluirCompleta, elementosId.get('limpar-selecao-completa'));
    refs.navegacaoPrincipal = new Elemento('nav');
    const area = new Elemento(); area.classList.add('tabela-transacoes'); area.append(refs.listaTransacoesCompleta);
    class Media extends Alvo { constructor(matches) { super(); this.matches = matches; } alterar(matches) { this.matches = matches; this.dispatchEvent({ type: 'change', matches }); } }
    const largura = new Media(mobile), movimento = new Media(reduced), window = new Alvo();
    Object.assign(window, { innerHeight: 844, Event: class { constructor(type) { this.type = type; } }, matchMedia: () => movimento,
        requestAnimationFrame: (callback) => { const id = ++indiceQuadro; quadros.set(id, callback); return id; }, cancelAnimationFrame: (id) => quadros.delete(id) });
    if (observadores) {
        window.IntersectionObserver = class { constructor(callback) { this.callback = callback; this.desligado = false; ios.push(this); } observe() {} disconnect() { this.desligado = true; } };
        window.ResizeObserver = class { constructor(callback) { this.callback = callback; this.desligado = false; ros.push(this); } observe() {} disconnect() { this.desligado = true; } };
    }
    const api = criarListagensTransacoes({ elementos: refs, ambiente: { window, document }, larguraMobileTransacoes: largura,
        consultas: { consultarTransacoes: () => transacoes, consultarContas: () => contas, consultarInvestimentos: () => investimentos, colecaoEstaBloqueada: (chave) => bloqueadas.has(chave) },
        modais: { obterModalAtivo: () => null }, aoEditar: () => efeitos.push(['editar', api.consultarSelecao()]), aoExcluir: () => efeitos.push(['excluir', api.consultarSelecao()]) });
    const checkboxes = (tabela = refs.listaTransacoesCompleta) => tabela.querySelectorAll('.checkbox-transacao');
    const selecionar = (indice, marcada = true, tabela) => { const cb = checkboxes(tabela)[indice]; cb.checked = marcada; cb.emitir('change'); };
    const renderizar = () => { api.renderizarTransacoes(refs.listaTransacoes, 5); api.atualizarCategorias(); api.atualizarTabelaCompleta(); api.atualizarBarraAcoes(); };
    return { api, refs, document, window, largura, movimento, efeitos, animacoes, ios, ros, quadros, area, bloqueadas,
        checkboxes, selecionar, renderizar, controle: (id) => elementosId.get(id),
        alterar: (dados) => { if (dados.transacoes) transacoes = dados.transacoes; if (dados.contas) contas = dados.contas; if (dados.investimentos) investimentos = dados.investimentos; } };
}
const muitos = (quantidade) => Array.from({ length: quantidade }, (_, i) => transacao({ id: `t-${i}`, nome: `Registro ${i}`, data: `2026-10-${String(i + 1).padStart(2, '0')}` }));
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('Listagens: importação não acessa DOM, armazenamento, eventos, preferência ou timers', async () => {
    const url = pathToFileURL(resolve(__dirname, '../../frontend/js/funcionalidades/listagens-transacoes.js')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        for (const nome of ['document','window','localStorage']) Object.defineProperty(globalThis,nome,{get(){throw new Error(nome)}});
        globalThis.setTimeout=globalThis.requestAnimationFrame=()=>{throw new Error('efeito')}; await import(${JSON.stringify(url)});
    `]);
});

test('Listagens: inicialização explícita/idempotente, classificações únicas e encerramento dos recursos', async () => {
    const a = ambiente({ mobile: true });
    assert.equal(a.refs.campoPesquisa.listeners(), 0); assert.equal(a.ios.length, 0);
    a.api.prepararClassificacoes(); a.api.prepararClassificacoes(); assert.equal(a.refs.filtroClassificacao.children.length, 5);
    a.api.inicializar(); a.api.inicializar(); assert.equal(a.refs.campoPesquisa.listeners(), 1); assert.equal(a.ios.length, 1); assert.equal(a.ros.length, 1);
    a.api.encerrar(); a.api.encerrar(); assert.equal(a.refs.campoPesquisa.listeners(), 0); assert.equal(a.window.listeners(), 0);
    assert.equal(a.largura.listeners(), 0); assert.equal(a.movimento.listeners(), 0); assert.equal(a.ios[0].desligado, true); assert.equal(a.ros[0].desligado, true);
    a.api.inicializar(); assert.equal(a.refs.campoPesquisa.listeners(), 1);
});

test('Listagens: recentes limitadas a cinco e tabela completa com oito, ordenação decrescente estável e dados intactos', async () => {
    const registros = Object.freeze(muitos(12).map(Object.freeze)), antes = JSON.stringify(registros);
    const a = ambiente({ registros }); a.renderizar();
    assert.equal(a.refs.listaTransacoes.children.length, 5); assert.equal(a.refs.listaTransacoesCompleta.children.length, 8);
    assert.deepEqual(a.checkboxes().map((cb) => cb.value), ['t-11','t-10','t-9','t-8','t-7','t-6','t-5','t-4']);
    assert.equal(a.refs.infoPaginacao.textContent, 'Página 1 de 2'); assert.equal(JSON.stringify(registros), antes);
});

test('Listagens: vazio e indisponível conservam mensagens, colspan, contagem e controles', async () => {
    const a = ambiente(); a.renderizar(); assert.equal(a.refs.listaTransacoesCompleta.children[0].children[0].textContent, 'Nenhuma transação encontrada.');
    assert.equal(a.refs.listaTransacoesCompleta.children[0].children[0].colSpan, 8);
    a.bloqueadas.add('transacoes'); a.renderizar();
    assert.match(a.refs.listaTransacoesCompleta.textContent, /Dados de transações indisponíveis/);
    assert.equal(a.controle('total-resultados').textContent, 'Dados indisponíveis');
});

test('Listagens: quatro tipos preservam sinais, classes, data, conta, investimento e recebido do resgate', async () => {
    const registros = [transacao({ id: 'r' }), transacao({ id: 'd', tipo: 'despesa', classificacao: 'Essencial', pagamento: 'Pix' }), aporte(), resgate()];
    const a = ambiente({ registros }); a.renderizar(); const linhas = a.refs.listaTransacoesCompleta.children;
    assert.deepEqual(linhas.map((l) => l.children[7].textContent.startsWith('+')), [true, false, false, true]);
    assert.equal(linhas[3].children[7].classList.contains('resgate'), true);
    assert.match(linhas[3].children[7].textContent, /Recebido na conta/); assert.match(linhas[2].textContent, /Investimento de teste/);
    assert.match(linhas[1].children[3].textContent, /01\/11\/2026/); assert.equal(linhas[0].getAttribute('role'), 'row');
    assert.equal(linhas[0].children[1].classList.contains('transacao-nome'), true);
    assert.equal(a.refs.listaTransacoes.children[0].children[1].classList.contains('recente-nome'), true);
});

test('Listagens: pesquisa preserva nome original e considera nome atual do investimento, sem pesquisar categoria', async () => {
    const a = ambiente({ registros: [aporte({ nome: 'Nome original' }), transacao({ nome: 'Salário', categoria: 'Categoria exclusiva' })] }); a.api.inicializar();
    a.alterar({ investimentos: [investimento({ nome: 'Carteira renomeada' })] });
    for (const termo of ['nome original', 'carteira renomeada', 'SALÁRIO']) {
        a.refs.campoPesquisa.value = termo; await a.refs.campoPesquisa.emitir('input'); assert.equal(a.checkboxes().length, 1);
    }
    a.refs.campoPesquisa.value = 'Categoria exclusiva'; await a.refs.campoPesquisa.emitir('input'); assert.equal(a.checkboxes().length, 0);
    a.bloqueadas.add('investimentos'); a.refs.campoPesquisa.value = 'nome original'; await a.refs.campoPesquisa.emitir('input'); assert.equal(a.checkboxes().length, 1);
});

test('Listagens: filtros combinados e limpeza preservam critérios, datas inclusivas e seleção', async () => {
    const a = ambiente({ registros: [transacao({ id:'r', categoria:'Casa' }), transacao({ id:'d', tipo:'despesa', categoria:'Casa', classificacao:'Essencial' }),
        transacao({ id:'d2', tipo:'despesa', categoria:'Casa', classificacao:'Desejo' }), aporte()] }); a.api.inicializar(); a.renderizar(); a.selecionar(0);
    Object.assign(a.refs.filtroTipo, { value:'despesa' }); a.refs.filtroCategoria.value='Casa'; a.refs.filtroClassificacao.value='Essencial';
    a.refs.filtroDataInicial.value='2026-11-01'; a.refs.filtroDataFinal.value='2026-11-01'; await a.refs.filtroTipo.emitir('change');
    assert.deepEqual(a.checkboxes().map((c)=>c.value), ['d']); assert.deepEqual(a.api.consultarSelecao(), []);
    a.refs.filtroTipo.value='receita'; await a.refs.filtroTipo.emitir('change'); assert.equal(a.checkboxes().length,0);
    a.refs.botaoLimparFiltros.click(); assert.equal(a.checkboxes().length,4); assert.equal(a.refs.filtroClassificacao.value,'todas'); assert.equal(a.refs.filtroDataInicial.value,'');
});

test('Listagens: categorias e classificação legada conservam comportamento e disponibilidade', async () => {
    const a=ambiente({registros:[transacao({id:'a',categoria:' B '}),transacao({id:'b',categoria:'A',tipo:'despesa'}),aporte()]});
    a.api.atualizarCategorias(); assert.deepEqual(a.refs.filtroCategoria.children.slice(1).map((c)=>c.value),['A','B']);
    a.refs.filtroCategoria.value='A'; a.api.atualizarCategorias(); assert.equal(a.refs.filtroCategoria.value,'A');
    a.api.atualizarTabelaCompleta(); assert.equal(a.checkboxes().length,1);
    a.refs.filtroCategoria.value='todas'; a.refs.filtroClassificacao.value='Essencial'; a.api.atualizarTabelaCompleta(); assert.equal(a.checkboxes().length,0);
    a.alterar({transacoes:[]}); a.api.atualizarCategorias(); assert.equal(a.refs.filtroCategoria.value,'todas');
});

test('Listagens: erro de datas mantém ARIA e desaparece ao corrigir sem mudar regras de filtro', async () => {
    const a=ambiente(); a.refs.filtroDataInicial.value='2026-11-02'; a.refs.filtroDataFinal.value='2026-11-01'; a.api.atualizarTabelaCompleta();
    assert.match(a.refs.erroFiltroDatas.textContent,/anterior ou igual/); assert.equal(a.refs.filtroDataFinal.getAttribute('aria-invalid'),'true');
    a.refs.filtroDataFinal.value='2026-11-03'; a.api.atualizarTabelaCompleta(); assert.equal(a.refs.erroFiltroDatas.textContent,''); assert.equal(a.refs.filtroDataFinal.getAttribute('aria-invalid'),null);
});

test('Listagens: seis no mobile, oito no desktop; resize mantém página válida e cinco recentes', async () => {
    const a=ambiente({registros:muitos(18),mobile:true}); a.api.inicializar(); a.renderizar(); assert.equal(a.checkboxes().length,6);
    a.refs.botaoProximaPagina.click(); assert.equal(a.refs.infoPaginacao.textContent,'Página 2 de 3'); a.selecionar(0);
    a.largura.alterar(false); assert.equal(a.checkboxes().length,8); assert.equal(a.refs.infoPaginacao.textContent,'Página 1 de 3'); assert.deepEqual(a.api.consultarSelecao(),[]);
    assert.equal(a.refs.listaTransacoes.children.length,5);
});

test('Listagens: avançar/voltar limpa seleção e exclusão de dados ajusta a última página', async () => {
    const a=ambiente({registros:muitos(18)}); a.api.inicializar(); a.renderizar(); a.selecionar(0); a.refs.botaoProximaPagina.click();
    assert.deepEqual(a.api.consultarSelecao(),[]); assert.equal(a.refs.infoPaginacao.textContent,'Página 2 de 3');
    a.refs.botaoProximaPagina.click(); assert.equal(a.refs.infoPaginacao.textContent,'Página 3 de 3');
    a.alterar({transacoes:muitos(2)}); a.api.atualizarTabelaCompleta(); assert.equal(a.refs.infoPaginacao.textContent,'Página 1 de 1');
    assert.equal(a.refs.botaoProximaPagina.disabled,true); assert.equal(a.refs.botaoPaginaAnterior.disabled,true);
});

test('Listagens: seleção é compartilhada, consulta é cópia e selecionar página atua somente nas linhas visíveis', async () => {
    const a=ambiente({registros:muitos(12)}); a.api.inicializar(); a.renderizar(); a.selecionar(0,true,a.refs.listaTransacoes);
    assert.equal(a.checkboxes()[0].checked,true); const copia=a.api.consultarSelecao(); copia.length=0; assert.equal(a.api.consultarSelecao().length,1);
    assert.equal(a.controle('selecionar-pagina').indeterminate,true); a.controle('selecionar-pagina').checked=true; a.controle('selecionar-pagina').emitir('change');
    assert.equal(a.api.consultarSelecao().length,8); assert.equal(a.refs.botaoEditarCompleta.disabled,true);
    a.controle('selecionar-pagina').checked=false; a.controle('selecionar-pagina').emitir('change'); assert.deepEqual(a.api.consultarSelecao(),[]);
});

test('Listagens: renderizar preserva seleção; limpeza e callbacks usam os mesmos fluxos das duas tabelas', async () => {
    const a=ambiente({registros:muitos(3)}); a.api.inicializar(); a.renderizar(); a.selecionar(0); a.renderizar();
    assert.equal(a.checkboxes()[0].checked,true); a.refs.botaoEditar.click(); a.refs.botaoExcluirCompleta.click();
    assert.deepEqual(a.efeitos,[['editar',['t-2']],['excluir',['t-2']]]);
    a.api.limparSelecao(); assert.equal(a.checkboxes().some((c)=>c.checked),false); assert.equal(a.refs.areaAcoes.classList.contains('ativa'),false);
});

test('Listagens: linhas antigas perdem listeners, novos IDs e nomes são consultados a cada renderização', async () => {
    const a=ambiente({registros:[transacao()]}); a.renderizar(); const antigo=a.checkboxes()[0];
    a.alterar({contas:[conta({nome:'Conta nova'})],transacoes:[transacao({nome:'Nome novo'})]}); a.renderizar();
    assert.equal(antigo.listeners(),0); assert.match(a.refs.listaTransacoesCompleta.textContent,/Conta nova/); assert.match(a.refs.listaTransacoesCompleta.textContent,/Nome novo/);
    a.api.encerrar(); assert.equal(a.checkboxes()[0].listeners(),0);
});

test('Listagens: barra contextual só acompanha seleção mobile e visibilidade, ações reutilizam originais', async () => {
    const a=ambiente({registros:muitos(2),mobile:true}); a.api.inicializar(); a.renderizar(); a.selecionar(0);
    a.ios.at(-1).callback([{isIntersecting:false,intersectionRatio:0}]); assert.equal(a.refs.barraContextual.classList.contains('visivel'),true);
    assert.equal(a.refs.barraAcoesCompleta.inert,true); a.controle('editar-selecao-contextual').click(); assert.deepEqual(a.efeitos,[['editar',['t-1']]]);
    a.ios.at(-1).callback([{isIntersecting:true,intersectionRatio:1}]); assert.equal(a.refs.barraContextual.inert,true);
    a.api.limparSelecao(); assert.equal(a.refs.barraContextual.classList.contains('visivel'),false);
});

test('Listagens: sem IntersectionObserver a barra superior permanece como alternativa', async () => {
    const a=ambiente({registros:muitos(1),mobile:true,observadores:false}); a.api.inicializar(); a.renderizar(); a.selecionar(0);
    assert.equal(a.refs.barraContextual.classList.contains('visivel'),false); assert.equal(a.refs.areaAcoesCompleta.classList.contains('ativa'),true);
});

test('Listagens: reduced motion pagina imediatamente sem animações ou altura temporária', async () => {
    const a=ambiente({registros:muitos(10),animar:true,reduced:true}); a.api.inicializar(); a.renderizar(); a.refs.botaoProximaPagina.click();
    assert.equal(a.animacoes.length,0); assert.equal(a.area.style.height,''); assert.equal(a.refs.infoPaginacao.textContent,'Página 2 de 2');
});

test('Listagens: paginação mantém saída 100, entrada 180 e altura 250; final restaura layout natural', async () => {
    const a=ambiente({registros:muitos(10),animar:true,reduced:false}); a.api.inicializar(); a.renderizar(); a.refs.botaoProximaPagina.click();
    assert.equal(a.refs.listaTransacoesCompleta.inert,true); assert.equal(a.animacoes.every((n)=>n.opcoes.duration===100),true);
    a.animacoes.forEach((n)=>n.terminar()); await flush();
    const altura=a.animacoes.find((n)=>n.opcoes.duration===250); assert.ok(altura); assert.equal(altura.alvo,a.area);
    assert.deepEqual(altura.frames,[{height:'440px'},{height:'140px'}]); assert.equal(altura.opcoes.easing,'cubic-bezier(0.23, 1, 0.32, 1)');
    assert.equal(a.animacoes.some((n)=>n.opcoes.duration===180),true);
    a.animacoes.forEach((n)=>n.terminar()); await flush(); assert.equal(a.area.style.height,''); assert.equal(a.area.style.minHeight,'');
    assert.equal(a.refs.listaTransacoesCompleta.inert,false); assert.equal(a.area.classList.contains('paginando-registros'),false);
});

for(const interrupcao of ['pesquisa','resize','reduced','navegacao','encerrar']) {
    test(`Listagens: ${interrupcao} cancela saída pendente sem callback antigo ou estilos restantes`, async () => {
        const a=ambiente({registros:muitos(10),animar:true,reduced:false}); a.api.inicializar(); a.renderizar(); a.refs.botaoProximaPagina.click();
        if(interrupcao==='pesquisa'){a.refs.campoPesquisa.value='Registro 0';await a.refs.campoPesquisa.emitir('input');}
        if(interrupcao==='resize') await a.window.emitir('resize');
        if(interrupcao==='reduced') a.movimento.alterar(true);
        if(interrupcao==='navegacao') a.api.concluirPaginacaoSeAtiva();
        if(interrupcao==='encerrar') a.api.encerrar();
        const texto=a.refs.listaTransacoesCompleta.textContent; await flush();
        assert.equal(a.area.style.height,''); assert.equal(a.area.style.minHeight,''); assert.equal(a.refs.listaTransacoesCompleta.inert,false);
        assert.equal(a.refs.listaTransacoesCompleta.textContent,texto); assert.equal(a.animacoes.every((n)=>n.concluida),true);
    });
}

test('Listagens: navegação rápida de paginação conserva último destino', async () => {
    const a=ambiente({registros:muitos(18),animar:true,reduced:false}); a.api.inicializar(); a.renderizar();
    a.refs.botaoProximaPagina.click(); a.refs.botaoProximaPagina.click(); a.animacoes.forEach((n)=>n.terminar()); await flush();
    a.animacoes.forEach((n)=>n.terminar()); await flush();
    assert.equal(a.refs.infoPaginacao.textContent,'Página 3 de 3'); assert.equal(a.checkboxes().length,2); assert.equal(a.area.style.height,'');
});

test('Listagens: retorno de página menor anima crescimento da mesma região', async () => {
    const a=ambiente({registros:muitos(10),animar:true,reduced:false}); a.api.inicializar(); a.renderizar();
    a.refs.botaoProximaPagina.click(); a.animacoes.forEach((n)=>n.terminar()); await flush(); a.animacoes.forEach((n)=>n.terminar()); await flush();
    const inicio=a.animacoes.length; a.refs.botaoPaginaAnterior.click(); a.animacoes.slice(inicio).forEach((n)=>n.terminar()); await flush();
    const altura=a.animacoes.slice(inicio).find((n)=>n.opcoes.duration===250);
    assert.deepEqual(altura.frames,[{height:'140px'},{height:'440px'}]);
    a.animacoes.forEach((n)=>n.terminar()); await flush(); assert.equal(a.area.style.height,'');
});

test('Listagens: páginas com mesma altura não criam animação de altura desnecessária', async () => {
    const a=ambiente({registros:muitos(16),animar:true,reduced:false}); a.api.inicializar(); a.renderizar();
    a.refs.botaoProximaPagina.click(); a.animacoes.forEach((n)=>n.terminar()); await flush();
    assert.equal(a.animacoes.some((n)=>n.opcoes.duration===250),false);
    a.animacoes.forEach((n)=>n.terminar()); await flush(); assert.equal(a.area.style.height,'');
});

test('Listagens: atualização durante entrada cancela altura e não permite que conclusão antiga altere dados', async () => {
    const a=ambiente({registros:muitos(10),animar:true,reduced:false}); a.api.inicializar(); a.renderizar();
    a.refs.botaoProximaPagina.click(); a.animacoes.forEach((n)=>n.terminar()); await flush();
    a.alterar({transacoes:[transacao({nome:'Registro posterior'})]}); a.api.atualizarTabelaCompleta(); await flush();
    assert.equal(a.area.style.height,''); assert.equal(a.area.style.minHeight,'');
    assert.match(a.refs.listaTransacoesCompleta.textContent,/Registro posterior/); assert.equal(a.animacoes.every((n)=>n.concluida),true);
});

test('Listagens: encerramento cancela frame de transferência de foco e callbacks antigos do observador', async () => {
    const a=ambiente({registros:muitos(1),mobile:true}); a.api.inicializar(); a.renderizar(); a.selecionar(0);
    a.refs.botaoEditarCompleta.focus(); const observador=a.ios.at(-1);
    observador.callback([{isIntersecting:false,intersectionRatio:0}]); assert.equal(a.quadros.size,1);
    a.api.encerrar(); assert.equal(a.quadros.size,0); assert.equal(a.refs.barraContextual.classList.contains('troca-foco-contextual'),false);
    a.api.inicializar(); const antes=a.refs.barraContextual.classList.contains('visivel');
    observador.callback([{isIntersecting:true,intersectionRatio:1}]); assert.equal(a.refs.barraContextual.classList.contains('visivel'),antes);
});

test('Listagens: exclusão financeira real preserva seleção na falha e limpa após sucesso', async () => {
    const a=ambiente({registros:muitos(2)}); a.renderizar(); a.selecionar(0);
    let sucesso=false; const efeitos=[];
    const operacoes=criarOperacoesTransacoes({elementos:{campoConta:{ownerDocument:{}},modalExclusao:{},botaoConfirmarExclusao:{disabled:false}},
        consultas:{consultarTransacoes:()=>muitos(2)},confirmarTransacoes:()=>sucesso,consultarSelecao:()=>a.api.consultarSelecao(),
        modais:{fecharModal:()=>efeitos.push('fechar')},mostrarToast:()=>efeitos.push('toast'),
        aposPersistir:()=>{a.api.definirSelecao([]);efeitos.push('recentes','categorias','tabela','resumo','acoes');},
        aposFecharExclusao:()=>efeitos.push('investimentos')});
    await operacoes.confirmarExclusao(); assert.deepEqual(a.api.consultarSelecao(),['t-1']); assert.deepEqual(efeitos,[]);
    sucesso=true; await operacoes.confirmarExclusao(); assert.deepEqual(a.api.consultarSelecao(),[]);
    assert.deepEqual(efeitos,['recentes','categorias','tabela','resumo','acoes','fechar','investimentos','toast']);
});
