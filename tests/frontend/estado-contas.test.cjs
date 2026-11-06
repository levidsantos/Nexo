'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Script, createContext } = require('node:vm');
const { criarEstadoDisponibilidade } = require('../../frontend/js/dados/estado.js');
const { lerDados, gravarDados } = require('../../frontend/js/dados/repositorio.js');
const validacoes = require('../../frontend/js/dominio/validacoes.js');
const calculos = require('../../frontend/js/dominio/calculos.js');
const utilitarios = require('../../frontend/js/dominio/valores-datas.js');
const { conta, transacao } = require('./support/fixtures.cjs');

beforeEach((t) => t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 5, 12) }));

function preparar(conteudo = JSON.stringify([conta()])) {
    const valores = new Map(conteudo === undefined ? [] : [['contas', conteudo]]);
    const gravacoes = [];
    let leituras = 0;
    const storage = {
        getItem(chave) { leituras++; return valores.has(chave) ? valores.get(chave) : null; },
        setItem(chave, valor) { valores.set(chave, valor); gravacoes.push([chave, valor]); }
    };
    const estado = criarEstadoDisponibilidade({
        ler: (chave) => lerDados(chave, storage),
        gravar: (chave, dados) => gravarDados(chave, dados, storage)
    });
    return { estado, storage, valores, gravacoes, leituras: () => leituras };
}

test('contas inicializam explicitamente, sem gravação e com consulta estável', () => {
    const { estado, gravacoes, leituras } = preparar();
    assert.equal(leituras(), 0);
    assert.equal(estado.contasEstaoDisponiveis(), false);
    assert.deepEqual(estado.consultarContas(), []);
    assert.equal(estado.inicializarContas().sucesso, true);
    assert.equal(estado.contasEstaoDisponiveis(), true);
    assert.deepEqual(estado.consultarContas(), [conta()]);
    assert.strictEqual(estado.consultarContas(), estado.consultarContas());
    assert.equal(leituras(), 1);
    assert.equal(gravacoes.length, 0);
});

test('chave ausente e coleção vazia são disponíveis, sem criar dados armazenados', () => {
    for (const ausente of [true, false]) {
        const app = preparar('[]');
        if (ausente) app.valores.delete('contas');
        assert.equal(app.estado.inicializarContas().sucesso, true);
        assert.equal(app.estado.contasEstaoDisponiveis(), true);
        assert.deepEqual(app.estado.consultarContas(), []);
        assert.equal(app.gravacoes.length, 0);
        assert.equal(app.valores.has('contas'), !ausente);
    }
});

test('inicialização inválida bloqueia contas sem corrigir ou regravar registros', () => {
    for (const texto of ['{invalido', 'null', '{}', JSON.stringify([conta(), conta()]),
        JSON.stringify([conta({ saldoInicial: 0.006 })]), JSON.stringify([conta({ dataReferencia: '2026-11-06' })])]) {
        const { estado, valores, gravacoes } = preparar(texto);
        assert.equal(estado.inicializarContas().sucesso, false);
        assert.equal(estado.contasEstaoDisponiveis(), false);
        assert.equal(estado.colecaoEstaBloqueada('contas'), true);
        assert.equal(estado.colecaoEstaBloqueada('transacoes'), false);
        assert.equal(valores.get('contas'), texto);
        assert.equal(gravacoes.length, 0);
    }
});

test('falha de leitura permanece bloqueada, sem releitura ou desbloqueio automático', () => {
    const app = preparar();
    app.storage.getItem = () => { throw new Error('Leitura negada'); };
    assert.equal(app.estado.inicializarContas().sucesso, false);
    app.storage.getItem = () => JSON.stringify([conta()]);
    assert.equal(app.estado.inicializarContas().sucesso, false);
    assert.equal(app.estado.confirmarContas([conta()]).motivo, 'bloqueada');
    assert.equal(app.gravacoes.length, 0);
});

test('consultas e referências externas não podem alterar contas ou campos adicionais aninhados', () => {
    const origem = [conta({ extra: { notas: ['original'] } })];
    const estado = criarEstadoDisponibilidade({ ler: () => ({ sucesso: true, dados: origem }) });
    estado.inicializarContas();
    origem[0].nome = 'Alterado fora';
    origem[0].extra.notas.push('fora');
    const consulta = estado.consultarContas();
    assert.throws(() => consulta.push(conta()), TypeError);
    assert.throws(() => { consulta[0].nome = 'Alterado'; }, TypeError);
    assert.throws(() => consulta[0].extra.notas.push('alterado'), TypeError);
    assert.equal(estado.consultarContas()[0].nome, conta().nome);
    assert.deepEqual(estado.consultarContas()[0].extra.notas, ['original']);
});

test('confirmação grava antes de substituir memória e conserva IDs e campos extras', () => {
    const app = preparar();
    app.estado.inicializarContas();
    const anterior = app.estado.consultarContas();
    const candidata = [conta({ nome: 'Renomeada', saldoInicial: 12.34, extra: { nota: 'preservada' } })];
    const escrever = app.storage.setItem;
    app.storage.setItem = (chave, valor) => {
        assert.strictEqual(app.estado.consultarContas(), anterior);
        escrever(chave, valor);
    };
    assert.equal(app.estado.confirmarContas(candidata).sucesso, true);
    assert.equal(app.gravacoes.length, 1);
    assert.deepEqual(JSON.parse(app.valores.get('contas')), candidata);
    assert.equal(app.estado.consultarContas()[0].id, anterior[0].id);
    candidata[0].extra.nota = 'alteração externa';
    assert.equal(app.estado.consultarContas()[0].extra.nota, 'preservada');
    assert.equal(anterior[0].nome, conta().nome);
    assert.notStrictEqual(app.estado.consultarContas(), anterior);
});

test('falha de gravação preserva referência em memória, storage e disponibilidade', () => {
    const app = preparar();
    app.estado.inicializarContas();
    const anterior = app.estado.consultarContas();
    const conteudo = app.valores.get('contas');
    app.storage.setItem = () => { throw new Error('Quota excedida'); };
    assert.equal(app.estado.confirmarContas([conta({ nome: 'Nova' })]).motivo, 'gravacao');
    assert.strictEqual(app.estado.consultarContas(), anterior);
    assert.equal(app.valores.get('contas'), conteudo);
    assert.equal(app.estado.contasEstaoDisponiveis(), true);
});

test('validação rejeita candidatos inválidos sem gravar nem substituir a coleção', () => {
    const app = preparar();
    app.estado.inicializarContas();
    const anterior = app.estado.consultarContas();
    for (const candidata of [null, {}, [{}], [conta(), conta()], [conta({ saldoInicial: -1 })]]) {
        assert.equal(app.estado.confirmarContas(candidata).motivo, 'invalida');
        assert.strictEqual(app.estado.consultarContas(), anterior);
    }
    assert.equal(app.gravacoes.length, 0);
});

test('contas bloqueadas ou ainda não inicializadas recusam confirmação', () => {
    const app = preparar();
    assert.equal(app.estado.confirmarContas([conta()]).motivo, 'nao-inicializada');
    app.estado.inicializarContas();
    const anterior = app.estado.consultarContas();
    app.estado.bloquearColecao('contas');
    assert.equal(app.estado.confirmarContas([conta()]).motivo, 'bloqueada');
    assert.equal(app.estado.contasEstaoDisponiveis(), false);
    assert.strictEqual(app.estado.consultarContas(), anterior);
    assert.equal(app.gravacoes.length, 0);
});

test('bloqueios de outras coleções não ampliam as restrições atuais de gravação de contas', () => {
    const app = preparar();
    app.estado.inicializarContas();
    app.estado.bloquearColecao('transacoes');
    app.estado.bloquearColecao('investimentos');
    assert.equal(app.estado.confirmarContas([conta({ nome: 'Editada' })]).sucesso, true);
});

test('instâncias e versões antigas permanecem independentes após confirmações', () => {
    const primeira = preparar(), segunda = preparar();
    primeira.estado.inicializarContas(); segunda.estado.inicializarContas();
    const antiga = primeira.estado.consultarContas();
    primeira.estado.confirmarContas([conta({ nome: 'Editada' })]);
    assert.equal(segunda.estado.consultarContas()[0].nome, conta().nome);
    assert.throws(() => { antiga[0].nome = 'Fora'; }, TypeError);
    assert.equal(primeira.estado.consultarContas()[0].nome, 'Editada');
    primeira.estado.inicializarContas();
    assert.equal(primeira.estado.consultarContas()[0].nome, 'Editada');
    assert.equal(primeira.leituras(), 1);
});

const arquivo = resolve(__dirname, '../../frontend/js/script.js');
const fonte = readFileSync(arquivo, 'utf8');
const nomes = ['carregarColecao', 'persistirColecao', 'podeExcluirConta', 'validarContaTransacao', 'obterSaldosContas'];
const declaracoes = nomes.map((nome) => {
    const trechos = [...fonte.matchAll(new RegExp(`^function ${nome}\\([^]*?^\\}`, 'gm'))];
    assert.equal(trechos.length, 1, nome);
    return trechos[0][0];
}).join('\n\n');

function adaptadores(app, registros = []) {
    const mensagens = [];
    const ler = app.storage.getItem;
    app.storage.getItem = (chave) => chave === "transacoes" ? JSON.stringify(registros) : ler(chave);
    app.estado.inicializarTransacoes();
    const contexto = createContext({
        ...utilitarios, ...validacoes, ...calculos,
        disponibilidadeColecoes: app.estado, investimentos: [],
        mostrarToast: (...argumentos) => mensagens.push(argumentos)
    });
    const funcoes = new Script(`${declaracoes}\n({ ${nomes.join(', ')} })`).runInContext(contexto);
    return { ...funcoes, mensagens };
}

test('adaptadores preservam exclusão protegida por movimentos históricos e futuros e indisponibilidade', () => {
    for (const data of ['2020-01-01', '2027-01-01']) {
        const app = preparar(); app.estado.inicializarContas();
        const ui = adaptadores(app, [transacao({ data })]);
        assert.equal(ui.podeExcluirConta(conta().id), false);
        assert.equal(app.gravacoes.length, 0);
    }
    const app = preparar(); app.estado.inicializarContas();
    app.estado.bloquearColecao('transacoes');
    assert.equal(adaptadores(app).podeExcluirConta(conta().id), false);
});

test('adaptadores consultam a conta renomeada por ID e confirmam exclusão sem vínculos', () => {
    const app = preparar(); const ui = adaptadores(app);
    ui.carregarColecao('contas', validacoes.validarConta);
    assert.equal(ui.persistirColecao('contas', [conta({ nome: 'Renomeada' })]), true);
    assert.equal(ui.validarContaTransacao(conta().id), true);
    assert.equal(ui.obterSaldosContas().saldoTotalCentavos, 10000);
    assert.equal(ui.podeExcluirConta(conta().id), true);
    assert.equal(ui.persistirColecao('contas', []), true);
    assert.equal(ui.validarContaTransacao(conta().id), false);
    assert.deepEqual(app.estado.consultarContas(), []);
});

test('adaptador de confirmação mantém mensagens e dados anteriores na falha', () => {
    const app = preparar(); app.estado.inicializarContas();
    const ui = adaptadores(app);
    app.storage.setItem = () => { throw new Error('Sem espaço'); };
    assert.equal(ui.persistirColecao('contas', [conta({ nome: 'Não salva' })]), false);
    assert.equal(app.estado.consultarContas()[0].nome, conta().nome);
    assert.match(ui.mensagens[0][0], /campos preenchidos foram mantidos/);
    assert.equal(ui.mensagens[0][1], 'erro');
});

test('editar conta vinculada preserva IDs, transações e cálculo de saldo', () => {
    const app = preparar(); app.estado.inicializarContas();
    const registros = Object.freeze([Object.freeze(transacao())]);
    const antes = JSON.stringify(registros);
    const ui = adaptadores(app, registros);
    assert.equal(ui.persistirColecao('contas', [conta({ nome: 'Nome atualizado' })]), true);
    assert.equal(app.estado.consultarContas()[0].id, registros[0].contaId);
    assert.equal(app.estado.consultarContas()[0].nome, 'Nome atualizado');
    assert.equal(ui.obterSaldosContas().saldoTotalCentavos, 11000);
    assert.equal(JSON.stringify(registros), antes);
    assert.deepEqual(app.gravacoes.map(([chave]) => chave), ['contas']);
    assert.equal(ui.podeExcluirConta(conta().id), false);
});
