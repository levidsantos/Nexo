const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { Script, createContext } = require('node:vm');
const { criarEstadoDisponibilidade } = require('../../frontend/js/dados/estado.js');
const utilitarios = require('../../frontend/js/dominio/valores-datas.js');
const validacoes = require('../../frontend/js/dominio/validacoes.js');
const calculos = require('../../frontend/js/dominio/calculos.js');
const { conta, transacao, investimento, aporte } = require('./support/fixtures.cjs');

beforeEach((t) => t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 5, 12) }));

test('disponibilidade começa sem bloqueios e não expõe o Set ou desbloqueio', () => {
    const estado = criarEstadoDisponibilidade();
    assert.deepEqual(Object.keys(estado).sort(), ['bloquearColecao', 'colecaoEstaBloqueada', 'confirmarContas', 'consultarContas', 'contasEstaoDisponiveis', 'inicializarContas', 'inicializarTransacoes', 'consultarTransacoes', 'transacoesEstaoDisponiveis', 'verificarTransacoesCarregadas', 'prepararCompatibilidadeTransacoes', 'validarTransacaoParaGravacao', 'confirmarTransacoes', 'consultarInvestimentos', 'investimentosEstaoDisponiveis', 'inicializarInvestimentos', 'confirmarInvestimentos'].sort());
    for (const chave of ['contas', 'transacoes', 'investimentos']) {
        assert.equal(estado.colecaoEstaBloqueada(chave), false);
    }
});

test('bloqueio é consultável, independente entre coleções e idempotente', () => {
    for (const chave of ['contas', 'transacoes', 'investimentos']) {
        const estado = criarEstadoDisponibilidade();
        estado.bloquearColecao(chave);
        estado.bloquearColecao(chave);
        for (const outra of ['contas', 'transacoes', 'investimentos']) {
            assert.equal(estado.colecaoEstaBloqueada(outra), outra === chave);
        }
    }
});

test('instâncias não compartilham bloqueios', () => {
    const primeira = criarEstadoDisponibilidade();
    const segunda = criarEstadoDisponibilidade();
    primeira.bloquearColecao('contas');
    segunda.bloquearColecao('investimentos');
    assert.equal(primeira.colecaoEstaBloqueada('investimentos'), false);
    assert.equal(segunda.colecaoEstaBloqueada('contas'), false);
    assert.equal(criarEstadoDisponibilidade().colecaoEstaBloqueada('contas'), false);
});

test('importação funciona sem DOM ou storage e não inicializa dados', () => {
    const url = pathToFileURL(resolve(__dirname, '../../frontend/js/dados/estado.js')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        for (const nome of ['localStorage', 'document', 'window']) {
            Object.defineProperty(globalThis, nome, { get() { throw new Error(nome); } });
        }
        const modulo = await import(${JSON.stringify(url)});
        if (Object.keys(modulo).join() !== 'criarEstadoDisponibilidade') throw new Error('API inesperada');
        if (modulo.criarEstadoDisponibilidade().colecaoEstaBloqueada('contas')) throw new Error('Bloqueio inesperado');
    `], { stdio: 'pipe' });
});

// Caracterização dos adaptadores reais: as decisões continuam no ponto de entrada.
const arquivo = resolve(__dirname, '../../frontend/js/script.js');
const fonte = readFileSync(arquivo, 'utf8');
const nomes = [
    'validarContaTransacao', 'verificarVinculosCarregados', 'obterCapitaisAplicados',
    'obterSaldosContas', 'obterHistoricoMensal', 'obterDistribuicaoDespesas',
    'persistirColecao', 'obterRestricaoMovimentacaoInvestimentos'
];
const declaracoes = nomes.map((nome) => {
    const correspondencias = [...fonte.matchAll(new RegExp(`^function ${nome}\\([^]*?^\\}`, 'gm'))];
    assert.equal(correspondencias.length, 1, nome);
    return correspondencias[0][0];
}).join('\n\n');

function aplicacao(bloqueios = [], registros = [transacao()], carteira = [investimento()]) {
    const gravacoes = [];
    const disponibilidadeColecoes = criarEstadoDisponibilidade({
        ler: (chave) => ({ sucesso: true, ausente: false, dados: chave === "transacoes" ? registros : chave === "investimentos" ? carteira : [conta()] }),
        gravar: (...argumentos) => { gravacoes.push(argumentos); return { sucesso: true }; }
    });
    disponibilidadeColecoes.inicializarTransacoes();
    disponibilidadeColecoes.inicializarContas();
    disponibilidadeColecoes.inicializarInvestimentos();
    if (validacoes.validarVinculosTransacoes(registros, [conta()], carteira)) {
        disponibilidadeColecoes.verificarTransacoesCarregadas();
        disponibilidadeColecoes.prepararCompatibilidadeTransacoes();
    }
    bloqueios.forEach((chave) => disponibilidadeColecoes.bloquearColecao(chave));
    const mensagens = [];
    const contexto = createContext({
        ...utilitarios, ...validacoes, ...calculos,
        disponibilidadeColecoes,
        mostrarToast: (...argumentos) => mensagens.push(argumentos),
        gravarDados: (...argumentos) => { gravacoes.push(argumentos); return { sucesso: true }; }
    });
    const funcoes = new Script(`${declaracoes}\n({ ${nomes.join(', ')} })`, { filename: arquivo })
        .runInContext(contexto, { timeout: 1000 });
    return { ...funcoes, disponibilidadeColecoes, gravacoes, mensagens, contexto };
}

for (let mascara = 0; mascara < 8; mascara++) {
    const chaves = ['contas', 'transacoes', 'investimentos'];
    const bloqueios = chaves.filter((_, indice) => mascara & (1 << indice));
    test(`condições existentes com bloqueios: ${bloqueios.join(', ') || 'nenhum'}`, () => {
        const app = aplicacao(bloqueios);
        const contasBloqueadas = bloqueios.includes('contas');
        const transacoesBloqueadas = bloqueios.includes('transacoes');
        const dadosBancariosDisponiveis = !contasBloqueadas && !transacoesBloqueadas;
        assert.equal(app.validarContaTransacao('conta-a'), !contasBloqueadas);
        assert.equal(app.obterSaldosContas().disponivel, dadosBancariosDisponiveis);
        assert.equal(app.obterHistoricoMensal().disponivel, dadosBancariosDisponiveis);
        assert.equal(app.obterDistribuicaoDespesas().disponivel, dadosBancariosDisponiveis);
        assert.equal(app.obterCapitaisAplicados().disponivel, bloqueios.length === 0);
        assert.equal(app.obterRestricaoMovimentacaoInvestimentos() === null, bloqueios.length === 0);
        assert.equal(app.persistirColecao('transacoes', [transacao()]), dadosBancariosDisponiveis);
        assert.equal(app.gravacoes.length, dadosBancariosDisponiveis ? 1 : 0);
    });
}

test('investimentos indisponíveis sem movimentações não bloqueiam receitas/despesas carregadas', () => {
    const app = aplicacao(['investimentos'], [transacao()], []);
    app.verificarVinculosCarregados();
    assert.equal(app.disponibilidadeColecoes.colecaoEstaBloqueada('transacoes'), false);
    assert.equal(app.disponibilidadeColecoes.consultarTransacoes().length, 1);
    assert.equal(app.persistirColecao('transacoes', [transacao()]), true);
});

test('movimentação com investimento indisponível impede gravação sem criar bloqueio global', () => {
    const app = aplicacao(['investimentos']);
    assert.equal(app.persistirColecao('transacoes', [aporte()]), false);
    assert.equal(app.gravacoes.length, 0);
    assert.equal(app.disponibilidadeColecoes.colecaoEstaBloqueada('contas'), false);
    assert.equal(app.disponibilidadeColecoes.colecaoEstaBloqueada('transacoes'), false);
});

test('contas bloqueadas ou vínculos inválidos bloqueiam transações e mantêm fallback vazio', () => {
    for (const app of [aplicacao(['contas']), aplicacao([], [transacao({ contaId: 'inexistente' })])]) {
        app.verificarVinculosCarregados();
        assert.equal(app.disponibilidadeColecoes.colecaoEstaBloqueada('transacoes'), true);
        assert.equal(app.disponibilidadeColecoes.consultarTransacoes().length, 0);
        assert.equal(app.mensagens.length, 1);
        assert.equal(app.gravacoes.length, 0);
    }
});

test('investimento ausente invalida vínculos de aportes; falha anterior de transações é preservada', () => {
    const app = aplicacao(['investimentos'], [aporte()], []);
    app.verificarVinculosCarregados();
    assert.equal(app.disponibilidadeColecoes.colecaoEstaBloqueada('transacoes'), true);
    const anterior = aplicacao(['transacoes']);
    anterior.verificarVinculosCarregados();
    assert.equal(anterior.disponibilidadeColecoes.colecaoEstaBloqueada('transacoes'), true);
    assert.equal(anterior.mensagens.length, 0);
});
