'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const { Script, createContext } = require('node:vm');
const { criarContas } = require('../../frontend/js/funcionalidades/contas.js');
const { criarEstadoFinanceiro } = require('../../frontend/js/dados/estado.js');
const { criarResumo } = require('../../frontend/js/funcionalidades/resumo.js');
const { calcularSaldos } = require('../../frontend/js/dominio/calculos.js');
const { formatarCentavos } = require('../../frontend/js/dominio/valores-datas.js');
const { conta, transacao, aporte, resgate, investimento } = require('./support/fixtures.cjs');

beforeEach((t) => t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 5, 12) }));

function ambiente(registros = [], movimentos = [], confirmar) {
    const mensagens = new Map(), efeitos = [], gravacoes = [];
    let falhar = false;
    const document = { getElementById: (id) => mensagens.get(id), createElement: (tag) => elemento(tag) };
    function elemento(tag = 'div', id = '') {
        const classes = new Set(), eventos = new Map(), atributos = new Map();
        let texto = '';
        const el = { tag, id, ownerDocument: document, children: [], value: '', checked: false, validity: { valid: true },
            classList: { add: (nome) => classes.add(nome), remove: (nome) => classes.delete(nome), contains: (nome) => classes.has(nome) },
            get textContent() { return texto; }, set textContent(valor) { texto = valor; },
            get innerHTML() { return texto; }, set innerHTML(valor) { texto = valor; this.children = []; },
            append(...itens) { this.children.push(...itens); }, appendChild(item) { this.children.push(item); },
            replaceChildren(...itens) { this.children = itens; },
            setAttribute: (nome, valor) => atributos.set(nome, valor), removeAttribute: (nome) => atributos.delete(nome),
            getAttribute: (nome) => atributos.get(nome), focus: () => efeitos.push(['foco', id]),
            addEventListener(tipo, callback) { if (!eventos.has(tipo)) eventos.set(tipo, new Set()); eventos.get(tipo).add(callback); },
            removeEventListener(tipo, callback) { eventos.get(tipo)?.delete(callback); },
            emitir(tipo, target = this) { return Promise.all([...eventos.get(tipo) ?? []].map(callback => callback({ target, preventDefault() {} }))); },
            listeners() { return [...eventos.values()].reduce((n, lista) => n + lista.size, 0); }
        };
        return el;
    }
    const ids = { botaoNovaConta: 'btn-nova-conta', modalConta: 'modal-conta', botaoFecharConta: 'fechar-modal-conta',
        botaoCancelarConta: 'cancelar-modal-conta', formConta: 'form-conta', campoNomeConta: 'nome-conta', campoTipoConta: 'tipo-conta',
        campoInstituicaoConta: 'instituicao-conta', campoSaldoInicial: 'saldo-inicial-conta', campoDataReferencia: 'data-referencia-conta',
        campoIncluirNoSaldoDisponivel: 'incluir-saldo-disponivel', tituloModalConta: 'titulo-modal-conta', botaoSalvarConta: 'salvar-conta',
        modalExclusaoConta: 'modal-exclusao-conta', mensagemExclusaoConta: 'mensagem-exclusao-conta',
        botaoCancelarExclusaoConta: 'cancelar-exclusao-conta', botaoConfirmarExclusaoConta: 'confirmar-exclusao-conta', listaContas: 'lista-contas' };
    const elementos = Object.fromEntries(Object.entries(ids).map(([nome, id]) => [nome, elemento('div', id)]));
    const campos = Object.entries(elementos).filter(([nome]) => nome.startsWith('campo')).map(([, campo]) => campo);
    for (const campo of campos) mensagens.set(`erro-${campo.id}`, elemento());
    elementos.formConta.reset = () => { for (const campo of campos) { campo.value = ''; campo.checked = false; } };
    elementos.formConta.querySelectorAll = (seletor) => seletor === '.erro-campo' ? [...mensagens.values()]
        : campos.filter((campo) => campo.classList.contains('invalido'));
    elementos.formConta.querySelector = () => campos.find((campo) => campo.classList.contains('invalido'));
    const estado = criarEstadoFinanceiro({
        ler: (chave) => ({ sucesso: true, dados: chave === 'contas' ? registros : chave === 'transacoes' ? movimentos : [investimento()] }),
        gravar: (chave, dados) => { efeitos.push(['gravar', chave]); if (falhar) return { sucesso: false, erro: new Error('Quota') };
            gravacoes.push([chave, dados]); return { sucesso: true }; }
    });
    estado.inicializarTransacoes(); estado.inicializarContas(); estado.inicializarInvestimentos();
    estado.verificarTransacoesCarregadas(); estado.prepararCompatibilidadeTransacoes();
    const ui = criarContas({ elementos, estado, confirmarContas: async (candidatas) => confirmar ? confirmar(candidatas, estado) : (await estado.confirmarContas(candidatas)).sucesso,
        modais: { abrirModal: (modal, foco) => { efeitos.push(['abrir', modal.id]); foco.focus(); },
            fecharModal: (modal, limpar) => { efeitos.push(['fechar', modal.id]); if (limpar) limpar(); } },
        mostrarToast: (...args) => efeitos.push(['toast', ...args]),
        aoConfirmarAlteracao: (tipo) => efeitos.push(['atualizar', tipo]), gerarId: () => 'conta-nova' });
    function preencher(alteracoes = {}) {
        elementos.campoNomeConta.value = 'Nova conta'; elementos.campoTipoConta.value = 'corrente';
        elementos.campoSaldoInicial.value = '12.34'; elementos.campoDataReferencia.value = '2026-11-04';
        for (const [nome, valor] of Object.entries(alteracoes)) elementos[nome].value = valor;
    }
    function renderizar() { ui.renderizarContas(calcularSaldos(estado.consultarContas(), estado.consultarTransacoes(), '2026-11-05', estado.consultarInvestimentos())); }
    return { ui, elementos, estado, efeitos, gravacoes, mensagens, preencher, renderizar, elemento, falhar: () => { falhar = true; } };
}

test('Contas: importação não acessa DOM, armazenamento, eventos ou timers', async () => {
    const url = pathToFileURL(resolve(__dirname, '../../frontend/js/funcionalidades/contas.js')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        for (const nome of ['document','window','localStorage','crypto']) Object.defineProperty(globalThis,nome,{get(){throw new Error(nome)}});
        globalThis.addEventListener=globalThis.setTimeout=()=>{throw new Error('efeito')};
        await import(${JSON.stringify(url)});
    `]);
});

test('Contas: inicialização explícita e repetida não duplica listeners; encerramento permite reinicializar', async () => {
    const a = ambiente();
    assert.equal(a.elementos.formConta.listeners(), 0);
    a.ui.inicializar(); const total = Object.values(a.elementos).reduce((n, el) => n + el.listeners(), 0);
    a.ui.inicializar(); assert.equal(Object.values(a.elementos).reduce((n, el) => n + el.listeners(), 0), total);
    a.ui.encerrar(); a.ui.encerrar(); assert.equal(Object.values(a.elementos).reduce((n, el) => n + el.listeners(), 0), 0);
    a.ui.inicializar(); await a.elementos.botaoNovaConta.emitir('click');
    assert.equal(a.efeitos.filter(([tipo]) => tipo === 'abrir').length, 1);
});

test('Contas: estados vazio e bloqueado preservam mensagens e nenhuma gravação', async () => {
    const a = ambiente(); a.renderizar();
    assert.match(a.elementos.listaContas.innerHTML, /Nenhuma conta cadastrada/);
    a.estado.bloquearColecao('contas'); a.renderizar();
    assert.equal(a.elementos.listaContas.children[0].textContent, 'Os dados das contas estão indisponíveis. Não é possível cadastrar, editar ou excluir contas nesta sessão.');
    assert.equal(a.gravacoes.length, 0);
});

test('Contas: cards preservam tipos, instituição, classes, valores negativos, positivos e zero', async () => {
    const a = ambiente([conta({ id: 'a', nome: 'A', instituicao: 'Banco' }), conta({ id: 'b', nome: 'B' }), conta({ id: 'c', nome: 'C' })]);
    a.ui.renderizarContas({ disponivel: true, saldosPorContaCentavos: new Map([['a', -123], ['b', 0], ['c', 456]]) });
    const cards = a.elementos.listaContas.children;
    assert.deepEqual(cards.map((card) => card.children[3].textContent), [-123, 0, 456].map(formatarCentavos));
    assert.equal(cards[0].children[1].textContent, 'Banco · Conta corrente');
    assert.equal(cards[0].children[3].classList.contains('saldo-negativo'), true);
    assert.equal(cards[0].classList.contains('item-conta'), true);
    assert.equal(cards[0].children[5].children[1].classList.contains('btn-excluir'), true);
    assert.equal(cards[0].children[5].children[0].getAttribute('aria-label'), 'Editar conta A');
});

test('Contas: saldo indisponível mantém identificação e não mostra saldo parcial confiável', async () => {
    const a = ambiente([conta()]); a.ui.renderizarContas({ disponivel: false, motivo: 'Falha de integridade.' });
    assert.equal(a.elementos.listaContas.children[0].textContent, 'Saldos indisponíveis. Falha de integridade.');
    assert.equal(a.elementos.listaContas.children[1].children[3].textContent, 'Saldo indisponível');
});

test('Contas: cadastro usa uma gravação antes da atualização, fechamento e sucesso', async () => {
    const a = ambiente(); a.ui.inicializar(); a.ui.abrirModalConta(); a.preencher(); a.efeitos.length = 0;
    await a.elementos.formConta.emitir('submit');
    assert.deepEqual(a.efeitos.map(([tipo]) => tipo), ['gravar', 'atualizar', 'fechar', 'toast']);
    assert.deepEqual(a.efeitos[1], ['atualizar', 'salvar']);
    assert.equal(a.gravacoes.length, 1); assert.equal(a.estado.consultarContas()[0].saldoInicial, 12.34);
    assert.equal(a.estado.consultarContas()[0].id, 'conta-nova');
});

test('Contas: cadastro aceita saldo inicial zero e inclusão manual prevalece sobre sugestão', async () => {
    const a = ambiente(); a.ui.inicializar(); a.ui.abrirModalConta();
    a.elementos.campoTipoConta.value = 'reserva'; await a.elementos.campoTipoConta.emitir('change');
    assert.equal(a.elementos.campoIncluirNoSaldoDisponivel.checked, false);
    a.elementos.campoIncluirNoSaldoDisponivel.checked = true; await a.elementos.campoIncluirNoSaldoDisponivel.emitir('change');
    await a.elementos.campoTipoConta.emitir('change'); assert.equal(a.elementos.campoIncluirNoSaldoDisponivel.checked, true);
    a.preencher({ campoSaldoInicial: '0' }); await a.elementos.formConta.emitir('submit');
    assert.equal(a.estado.consultarContas()[0].saldoInicial, 0);
});

for (const [campo, valor, mensagem] of [['campoNomeConta', '', 'Informe o nome'], ['campoTipoConta', '', 'Selecione um tipo'],
    ['campoSaldoInicial', '0.006', 'até duas casas'], ['campoSaldoInicial', '-1', 'zero ou positivo'],
    ['campoSaldoInicial', '100000000000000', 'limite permitido'], ['campoDataReferencia', '2026-11-06', 'anterior a hoje']]) {
    test(`Contas: formulário rejeita ${campo}=${valor} sem persistir ou atualizar`, async () => {
        const a = ambiente(); a.ui.inicializar(); a.ui.abrirModalConta(); a.preencher({ [campo]: valor }); a.efeitos.length = 0;
        await a.elementos.formConta.emitir('submit');
        assert.equal(a.gravacoes.length, 0); assert.equal(a.efeitos.some(([tipo]) => tipo === 'atualizar' || tipo === 'fechar'), false);
        const ref = a.elementos[campo]; assert.match(a.mensagens.get(`erro-${ref.id}`).textContent, new RegExp(mensagem));
        assert.equal(ref.getAttribute('aria-invalid'), 'true'); ref.emitir('input'); assert.equal(ref.getAttribute('aria-invalid'), undefined);
    });
}

test('Contas: edição consulta versão atual, preserva ID, campos extras e vínculos', async () => {
    const a = ambiente([conta({ extra: { preservar: true } })], [transacao()]); a.ui.inicializar(); a.ui.abrirModalConta(conta().id);
    const transacoesAntes = a.estado.consultarTransacoes(); a.preencher({ campoNomeConta: 'Renomeada' }); await a.elementos.formConta.emitir('submit');
    const atual = a.estado.consultarContas()[0]; assert.equal(atual.id, conta().id); assert.equal(atual.nome, 'Renomeada');
    assert.deepEqual(atual.extra, { preservar: true }); assert.strictEqual(a.estado.consultarTransacoes(), transacoesAntes);
    a.ui.abrirModalConta(conta().id); assert.equal(a.elementos.campoNomeConta.value, 'Renomeada');
});

test('Contas: falha de gravação preserva estado, campos e modal, sem atualização de sucesso', async () => {
    const a = ambiente([conta()]); a.ui.inicializar(); a.ui.abrirModalConta(conta().id); a.preencher();
    const antes = a.estado.consultarContas(); a.falhar(); a.efeitos.length = 0; await a.elementos.formConta.emitir('submit');
    assert.strictEqual(a.estado.consultarContas(), antes); assert.equal(a.elementos.campoNomeConta.value, 'Nova conta');
    assert.deepEqual(a.efeitos.map(([tipo]) => tipo), ['gravar']);
});

for (const movimento of [transacao(), transacao({ data: '2027-01-01' }), aporte(), resgate()]) {
    test(`Contas: exclusão bloqueada por ${movimento.tipo} de ${movimento.data}`, async () => {
        const a = ambiente([conta()], [movimento]); a.ui.inicializar(); a.renderizar();
        await a.elementos.listaContas.children[0].children[5].children[1].emitir('click');
        assert.equal(a.ui.podeExcluirConta(conta().id), false); assert.equal(a.gravacoes.length, 0);
        assert.equal(a.efeitos.some(([tipo]) => tipo === 'abrir'), false);
    });
}

test('Contas: exclusão revalida vínculos ao confirmar e respeita disponibilidade parcial', async () => {
    const a = ambiente([conta()]); a.ui.inicializar(); a.renderizar();
    await a.elementos.listaContas.children[0].children[5].children[1].emitir('click');
    (await a.estado.confirmarTransacoes([transacao()])); a.efeitos.length = 0; await a.elementos.botaoConfirmarExclusaoConta.emitir('click');
    assert.equal(a.estado.consultarContas().length, 1); assert.equal(a.efeitos.some(([tipo]) => tipo === 'gravar'), false);
    const b = ambiente([conta()]); b.estado.bloquearColecao('investimentos'); assert.equal(b.ui.podeExcluirConta(conta().id), true);
    b.estado.bloquearColecao('transacoes'); assert.equal(b.ui.podeExcluirConta(conta().id), false);
});

test('Contas: exclusão sem vínculos confirma uma vez e preserva ordem de atualização', async () => {
    const a = ambiente([conta()]); a.ui.inicializar(); a.renderizar();
    await a.elementos.listaContas.children[0].children[5].children[1].emitir('click'); a.efeitos.length = 0;
    await a.elementos.botaoConfirmarExclusaoConta.emitir('click');
    assert.equal(a.estado.consultarContas().length, 0); assert.equal(a.gravacoes.length, 1);
    assert.deepEqual(a.efeitos.map(([tipo]) => tipo), ['gravar', 'atualizar', 'fechar', 'toast']);
    assert.deepEqual(a.efeitos[1], ['atualizar', 'excluir']);
});

test('Contas: botões dos cards recriados usam ID e dados atuais sem duplicar eventos', async () => {
    const a = ambiente([conta()]); a.ui.inicializar(); a.renderizar();
    const antigo = a.elementos.listaContas.children[0].children[5].children[0];
    (await a.estado.confirmarContas([conta({ nome: 'Novo nome' })])); a.renderizar(); a.renderizar(); a.efeitos.length = 0;
    assert.equal(antigo.listeners(), 0);
    await a.elementos.listaContas.children[0].children[5].children[0].emitir('click');
    assert.equal(a.elementos.campoNomeConta.value, 'Novo nome');
    assert.equal(a.efeitos.filter(([tipo]) => tipo === 'abrir').length, 1);
    const atual = a.elementos.listaContas.children[0].children[5].children[0];
    a.ui.encerrar(); assert.equal(atual.listeners(), 0);
});

test('Contas: falha ao excluir conserva conta e confirmação sem atualizar outras páginas', async () => {
    const a = ambiente([conta()]); a.ui.inicializar(); a.renderizar();
    await a.elementos.listaContas.children[0].children[5].children[1].emitir('click');
    const antes = a.estado.consultarContas(); a.falhar(); a.efeitos.length = 0;
    await a.elementos.botaoConfirmarExclusaoConta.emitir('click');
    assert.strictEqual(a.estado.consultarContas(), antes);
    assert.deepEqual(a.efeitos.map(([tipo]) => tipo), ['gravar']);
});

test('Contas: abertura pelo Resumo utiliza API explícita e foco inicial existente', async () => {
    const a = ambiente(); const lista = a.elemento();
    const resumo = criarResumo({ listaContas: lista, abrirCadastroConta: () => a.ui.abrirModalConta() });
    resumo.renderizarContas({ contas: [], saldos: { disponivel: true } }); lista.children[1].emitir('click');
    assert.deepEqual(a.efeitos, [['abrir', 'modal-conta'], ['foco', 'nome-conta']]);
});

test('Contas: Cancelar, X e cancelamento da confirmação reutilizam fechamento compartilhado', async () => {
    const a = ambiente(); a.ui.inicializar();
    for (const botao of [a.elementos.botaoCancelarConta, a.elementos.botaoFecharConta]) {
        a.ui.abrirModalConta(); a.preencher(); botao.emitir('click'); assert.equal(a.elementos.campoNomeConta.value, '');
    }
    a.ui.fecharModalExclusaoConta();
    assert.deepEqual(a.efeitos.at(-1), ['fechar', 'modal-exclusao-conta']);
});

test('Contas: callback real do ponto de entrada preserva atualizações de salvar e excluir', async () => {
    const fonte = readFileSync(resolve(__dirname, '../../frontend/js/script.js'), 'utf8');
    const trecho = fonte.slice(fonte.indexOf('const funcionalidadeContas ='), fonte.indexOf('const listagensTransacoes ='));
    const efeitos = [], elementos = {};
    const nomes = [...trecho.match(/elementos: \{([^]*?)\}/)[1].matchAll(/\b\w+\b/g)].map(([nome]) => nome);
    nomes.forEach((nome) => { elementos[nome] = {}; });
    let opcoes;
    new Script(trecho).runInContext(createContext({ ...elementos, disponibilidadeColecoes: {}, criarContas: (args) => { opcoes = args; },
        abrirModal() {}, fecharModal() {}, mostrarToast() {}, listaTransacoes: {}, persistirColecao() {},
        atualizarOpcoesContas: () => efeitos.push('opcoes'), atualizarVisualizacoesSaldos: () => efeitos.push('saldos'),
        renderizarTransacoes: () => efeitos.push('recentes'), atualizarTabelaCompleta: () => efeitos.push('tabela') }));
    opcoes.aoConfirmarAlteracao('salvar'); assert.deepEqual(efeitos, ['opcoes', 'saldos', 'recentes', 'tabela']);
    efeitos.length = 0; opcoes.aoConfirmarAlteracao('excluir'); assert.deepEqual(efeitos, ['opcoes', 'saldos']);
});

for (const excluir of [false, true]) {
    test(`Contas: confirmação pendente de ${excluir ? 'exclusão' : 'cadastro'} aguarda e impede repetição`, async () => {
        let liberar, chamadas = 0;
        const espera = new Promise(resolve => { liberar = resolve; });
        const a = ambiente(excluir ? [conta()] : [], [], async (dados, estado) => {
            chamadas++; await espera; return (await estado.confirmarContas(dados)).sucesso;
        });
        a.ui.inicializar();
        if (excluir) { a.renderizar(); await a.elementos.listaContas.children[0].children.at(-1).children.at(-1).emitir('click'); }
        else { a.ui.abrirModalConta(); a.preencher(); }
        const alvo = excluir ? a.elementos.botaoConfirmarExclusaoConta : a.elementos.formConta;
        const tipo = excluir ? 'click' : 'submit';
        a.efeitos.length = 0;
        const antes = a.estado.consultarContas();
        const primeira = alvo.emitir(tipo);
        await alvo.emitir(tipo);
        assert.equal(chamadas, 1);
        assert.strictEqual(a.estado.consultarContas(), antes);
        assert.equal(a.gravacoes.length, 0);
        assert.equal(a.efeitos.some(([tipo]) => ['atualizar','fechar','toast'].includes(tipo)), false);
        liberar(); await primeira;
        assert.equal(a.gravacoes.length, 1);
        assert.equal(a.estado.consultarContas().length, excluir ? 0 : 1);
    });
}

test('Contas: rejeição libera botão e mantém formulário, inclusive tentativa de fechamento pendente', async () => {
    let rejeitar, chamadas = 0;
    const espera = new Promise((resolve, reject) => { rejeitar = reject; });
    const a = ambiente([], [], async (dados, estado) => {
        if (++chamadas === 1) return espera;
        return (await estado.confirmarContas(dados)).sucesso;
    });
    a.ui.inicializar(); a.ui.abrirModalConta(); a.preencher(); a.efeitos.length = 0;
    const primeira = a.elementos.formConta.emitir('submit');
    await a.elementos.botaoCancelarConta.emitir('click');
    assert.equal(a.efeitos.some(([tipo]) => tipo === 'fechar'), false);
    rejeitar(new Error('Rejeição controlada')); await primeira;
    assert.equal(a.elementos.botaoSalvarConta.disabled, undefined);
    assert.equal(a.elementos.campoNomeConta.value, 'Nova conta');
    assert.equal(a.estado.consultarContas().length, 0);
    assert.equal(a.gravacoes.length, 0);
    assert.match(a.efeitos.at(-1)[1], /erro inesperado/);
    await a.elementos.formConta.emitir('submit');
    assert.equal(a.gravacoes.length, 1);
});
