const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Script, createContext } = require('node:vm');
const { lerDados, gravarDados } = require('../../frontend/js/dados/repositorio.js');
const { criarEstadoDisponibilidade } = require('../../frontend/js/dados/estado.js');
const validacoes = require('../../frontend/js/dominio/validacoes.js');
const calculos = require('../../frontend/js/dominio/calculos.js');
const { conta, transacao } = require('./support/fixtures.cjs');

beforeEach((t) => t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 5, 12) }));

function armazenamentoSimulado(iniciais = {}) {
    const valores = new Map(Object.entries(iniciais));
    const gravacoes = [];
    return {
        valores, gravacoes,
        getItem(chave) { return valores.has(chave) ? valores.get(chave) : null; },
        setItem(chave, valor) { gravacoes.push([chave, valor]); valores.set(chave, String(valor)); }
    };
}

for (const chave of ['contas', 'transacoes', 'investimentos']) {
    test(`repositório lê e grava a chave original ${chave} sem transformar os registros`, () => {
        const storage = armazenamentoSimulado({ outra: 'preservada' });
        const registros = [{ id: 'original', valor: 12.34, observacoes: 'ação', extra: null }];
        const antes = structuredClone(registros);
        assert.deepEqual(gravarDados(chave, registros, storage), { sucesso: true });
        assert.equal(storage.valores.get(chave), JSON.stringify(registros));
        assert.deepEqual(lerDados(chave, storage), { sucesso: true, ausente: false, dados: registros });
        assert.deepEqual(registros, antes);
        assert.equal(storage.valores.get('outra'), 'preservada');
        assert.equal(storage.gravacoes.length, 1);
    });
}

test('repositório distingue chave ausente, array vazio e null armazenado', () => {
    const storage = armazenamentoSimulado({ vazia: '[]', nula: 'null' });
    assert.deepEqual(lerDados('ausente', storage), { sucesso: true, ausente: true, dados: null });
    assert.deepEqual(lerDados('vazia', storage), { sucesso: true, ausente: false, dados: [] });
    assert.deepEqual(lerDados('nula', storage), { sucesso: true, ausente: false, dados: null });
    assert.equal(storage.gravacoes.length, 0);
});

test('JSON inválido retorna erro sem modificar nem substituir o conteúdo', () => {
    for (const conteudo of ['{invalido', '', 'undefined']) {
        const storage = armazenamentoSimulado({ contas: conteudo });
        const resultado = lerDados('contas', storage);
        assert.equal(resultado.sucesso, false);
        assert.ok(resultado.erro instanceof SyntaxError);
        assert.equal(Object.hasOwn(resultado, 'dados'), false);
        assert.equal(storage.valores.get('contas'), conteudo);
        assert.equal(storage.gravacoes.length, 0);
    }
});

test('repositório desserializa sem assumir a validação estrutural da aplicação', () => {
    for (const conteudo of ['{}', '42', '"texto"']) {
        const storage = armazenamentoSimulado({ contas: conteudo });
        assert.deepEqual(lerDados('contas', storage), {
            sucesso: true, ausente: false, dados: JSON.parse(conteudo)
        });
    }
});

test('falha de getItem preserva o erro e não tenta gravar', () => {
    const erro = new Error('Leitura bloqueada');
    const storage = armazenamentoSimulado({ contas: '[]' });
    storage.getItem = () => { throw erro; };
    assert.deepEqual(lerDados('contas', storage), { sucesso: false, erro });
    assert.equal(storage.gravacoes.length, 0);
    assert.equal(storage.valores.get('contas'), '[]');
});

test('falha de setItem não confirma sucesso nem altera o conteúdo anterior', () => {
    const storage = armazenamentoSimulado({ contas: '[{"id":"antigo"}]' });
    const erro = new Error('Quota excedida');
    storage.setItem = () => { throw erro; };
    assert.deepEqual(gravarDados('contas', [{ id: 'novo' }], storage), { sucesso: false, erro });
    assert.equal(storage.valores.get('contas'), '[{"id":"antigo"}]');
});

test('falhas de serialização não chegam ao setItem e preservam os dados', () => {
    const circular = {};
    circular.proprio = circular;
    for (const registros of [[circular], [{ valor: 1n }]]) {
        const storage = armazenamentoSimulado({ transacoes: '[]' });
        const resultado = gravarDados('transacoes', registros, storage);
        assert.equal(resultado.sucesso, false);
        assert.ok(resultado.erro instanceof TypeError);
        assert.equal(storage.gravacoes.length, 0);
        assert.equal(storage.valores.get('transacoes'), '[]');
    }
});

test('acesso padrão é tardio e captura inclusive falha no getter de localStorage', (t) => {
    const descritor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    t.after(() => {
        if (descritor) Object.defineProperty(globalThis, 'localStorage', descritor);
        else delete globalThis.localStorage;
    });
    const storage = armazenamentoSimulado();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    assert.equal(gravarDados('contas', []).sucesso, true);
    assert.deepEqual(lerDados('contas'), { sucesso: true, ausente: false, dados: [] });
    const erro = new Error('Acesso negado');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw erro; } });
    assert.deepEqual(lerDados('contas'), { sucesso: false, erro });
    assert.deepEqual(gravarDados('contas', []), { sucesso: false, erro });
});

// Os adaptadores de estado continuam no script.js: executar suas declarações
// reais confirma a integração sem iniciar a interface ou acessar dados reais.
const fonte = readFileSync(resolve(__dirname, '../../frontend/js/script.js'), 'utf8');
const adaptadores = ['carregarColecao', 'persistirColecao'].map((nome) => {
    const trechos = [...fonte.matchAll(new RegExp(`^function ${nome}\\([^]*?^\\}`, 'gm'))];
    assert.equal(trechos.length, 1, `Declaração única de ${nome}`);
    return trechos[0][0];
}).join('\n\n');

function aplicacaoSimulada(storage, registros = []) {
    const mensagens = [];
    const disponibilidadeColecoes = criarEstadoDisponibilidade({
        ler: (chave) => lerDados(chave, storage),
        gravar: (chave, dados) => gravarDados(chave, dados, storage)
    });
    disponibilidadeColecoes.inicializarTransacoes();
    const contexto = createContext({
        ...validacoes, ...calculos,
        disponibilidadeColecoes,
        investimentos: [],
        lerDados: (chave) => lerDados(chave, storage),
        gravarDados: (chave, dados) => gravarDados(chave, dados, storage),
        mostrarToast: (...argumentos) => mensagens.push(argumentos)
    });
    const funcoes = new Script(`${adaptadores}\n({ carregarColecao, persistirColecao })`)
        .runInContext(contexto, { timeout: 1000 });
    return { ...funcoes, mensagens, disponibilidadeColecoes };
}

test('adaptador mantém ausente/vazio disponíveis e bloqueia dados incompatíveis sem alterá-los', () => {
    for (const conteudo of [undefined, '[]', 'null', '{}', '[{"id":"invalido"}]', '{invalido']) {
        const storage = armazenamentoSimulado(conteudo === undefined ? {} : { contas: conteudo });
        const app = aplicacaoSimulada(storage);
        assert.equal(app.carregarColecao('contas', validacoes.validarConta).length, 0);
        const invalido = conteudo !== undefined && conteudo !== '[]';
        assert.equal(app.disponibilidadeColecoes.colecaoEstaBloqueada('contas'), invalido);
        assert.equal(app.mensagens.length, invalido ? 1 : 0);
        assert.equal(storage.valores.get('contas'), conteudo);
        assert.equal(storage.gravacoes.length, 0);
    }
});

test('adaptador preserva leitura válida e bloqueia gravações inválidas ou coleções bloqueadas', () => {
    const storage = armazenamentoSimulado({ contas: JSON.stringify([conta()]) });
    const app = aplicacaoSimulada(storage);
    assert.deepEqual(structuredClone(app.carregarColecao('contas', validacoes.validarConta)), [conta()]);
    assert.equal(app.persistirColecao('contas', [{}]), false);
    assert.equal(app.persistirColecao('chave-desconhecida', []), false);
    app.disponibilidadeColecoes.bloquearColecao('contas');
    assert.equal(app.persistirColecao('contas', [conta()]), false);
    assert.equal(storage.gravacoes.length, 0);
});

test('adaptador mantém dados indisponíveis após falha de leitura e recusa sobrescrita', () => {
    const storage = armazenamentoSimulado({ contas: '[]' });
    storage.getItem = () => { throw new Error('Acesso negado'); };
    const app = aplicacaoSimulada(storage);
    assert.equal(app.carregarColecao('contas', validacoes.validarConta).length, 0);
    assert.equal(app.disponibilidadeColecoes.colecaoEstaBloqueada('contas'), true);
    assert.equal(app.persistirColecao('contas', [conta()]), false);
    assert.equal(storage.gravacoes.length, 0);
});

test('adaptador valida vínculos e novas despesas antes de tentar a gravação', () => {
    const storage = armazenamentoSimulado({ contas: JSON.stringify([conta()]), transacoes: '[]' });
    const app = aplicacaoSimulada(storage);
    app.carregarColecao('contas', validacoes.validarConta);
    app.disponibilidadeColecoes.verificarTransacoesCarregadas([]);
    app.disponibilidadeColecoes.prepararCompatibilidadeTransacoes();
    assert.equal(app.persistirColecao('transacoes', [transacao({ contaId: 'inexistente' })]), false);
    assert.equal(app.persistirColecao('transacoes', [transacao({ tipo: 'despesa', classificacao: '' })]), false);
    app.disponibilidadeColecoes.bloquearColecao('transacoes');
    assert.equal(app.persistirColecao('investimentos', []), false);
    assert.equal(storage.gravacoes.length, 0);
});

test('falha de escrita mantém retrato dos legados; limpeza ocorre somente após sucesso', () => {
    const legado = transacao({ tipo: 'despesa', classificacao: '' });
    const anterior = JSON.stringify([legado]);
    const storage = armazenamentoSimulado({ contas: JSON.stringify([conta()]), transacoes: anterior });
    const app = aplicacaoSimulada(storage, [legado]);
    app.carregarColecao('contas', validacoes.validarConta);
    app.disponibilidadeColecoes.verificarTransacoesCarregadas([]);
    app.disponibilidadeColecoes.prepararCompatibilidadeTransacoes();
    const escrever = storage.setItem;
    storage.setItem = () => { throw new Error('Quota excedida'); };
    assert.equal(app.persistirColecao('transacoes', []), false);
    assert.equal(app.disponibilidadeColecoes.validarTransacaoParaGravacao(legado), true);
    assert.equal(storage.valores.get('transacoes'), anterior);
    assert.equal(app.mensagens.at(-1)[1], 'erro');
    storage.setItem = escrever;
    assert.equal(app.persistirColecao('transacoes', [legado]), true);
    assert.equal(app.disponibilidadeColecoes.validarTransacaoParaGravacao(legado), true);
    assert.equal(app.persistirColecao('transacoes', []), true);
    assert.equal(app.disponibilidadeColecoes.validarTransacaoParaGravacao(legado), false);
    assert.equal(storage.valores.get('transacoes'), '[]');
});
