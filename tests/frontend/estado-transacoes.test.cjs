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
const { conta, transacao, investimento, aporte, resgate, HOJE } = require('./support/fixtures.cjs');

beforeEach((t) => t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 5, 12) }));

function preparar(registros = [], carteira = [], inicializar = true) {
    const valores = new Map([
        ['transacoes', JSON.stringify(registros)], ['contas', JSON.stringify([conta()])],
        ['investimentos', JSON.stringify(carteira)]
    ]);
    const leituras = [], gravacoes = [];
    const storage = {
        getItem(chave) { leituras.push(chave); return valores.has(chave) ? valores.get(chave) : null; },
        setItem(chave, valor) { gravacoes.push([chave, valor]); valores.set(chave, valor); }
    };
    const estado = criarEstadoDisponibilidade({
        ler: (chave) => lerDados(chave, storage),
        gravar: (chave, dados) => gravarDados(chave, dados, storage)
    });
    function carregar() {
        estado.inicializarTransacoes();
        estado.inicializarContas();
        estado.inicializarInvestimentos();
        const integridade = estado.verificarTransacoesCarregadas();
        estado.prepararCompatibilidadeTransacoes();
        return integridade;
    }
    if (inicializar) carregar();
    return { estado, storage, valores, leituras, gravacoes, carteira, carregar };
}

test('transações inicializam na ordem existente, sem escrita e com versões estáveis', async () => {
    const app = preparar([transacao()], [], false);
    assert.equal(app.leituras.length, 0);
    assert.equal(app.estado.transacoesEstaoDisponiveis(), false);
    assert.equal(app.carregar().disponivel, true);
    assert.deepEqual(app.leituras, ['transacoes', 'contas', 'investimentos']);
    assert.deepEqual(app.estado.consultarTransacoes(), [transacao()]);
    assert.strictEqual(app.estado.consultarTransacoes(), app.estado.consultarTransacoes());
    assert.equal(app.estado.transacoesEstaoDisponiveis(), true);
    assert.equal(app.gravacoes.length, 0);
    assert.equal(Object.hasOwn(app.estado, 'despesasLegadasSemClassificacao'), false);
});

test('transações ausentes e vazias permanecem disponíveis sem criar chave', async () => {
    for (const ausente of [false, true]) {
        const app = preparar([], [], false);
        if (ausente) app.valores.delete('transacoes');
        assert.equal(app.carregar().disponivel, true);
        assert.deepEqual(app.estado.consultarTransacoes(), []);
        assert.equal(app.estado.transacoesEstaoDisponiveis(), true);
        assert.equal(app.valores.has('transacoes'), !ausente);
        assert.equal(app.gravacoes.length, 0);
    }
});

test('leitura inválida ou negada bloqueia transações sem alterar o armazenamento', async () => {
    for (const conteudo of ['{invalido', 'null', '{}', JSON.stringify([transacao(), transacao()]),
        JSON.stringify([transacao({ valor: 0.006 })])]) {
        const app = preparar([], [], false);
        app.valores.set('transacoes', conteudo);
        app.carregar();
        assert.equal(app.estado.transacoesEstaoDisponiveis(), false);
        assert.equal((await app.estado.confirmarTransacoes([])).motivo, 'bloqueada');
        assert.equal(app.valores.get('transacoes'), conteudo);
        assert.equal(app.gravacoes.length, 0);
    }
    const app = preparar([], [], false);
    app.storage.getItem = () => { throw new Error('Acesso negado'); };
    assert.equal(app.estado.inicializarTransacoes().sucesso, false);
    assert.equal(app.estado.transacoesEstaoDisponiveis(), false);
});

test('integridade inicial inválida usa fallback vazio sem gravar nem reconhecer legados', async () => {
    const antigo = transacao({ tipo: 'despesa', classificacao: '', contaId: 'inexistente' });
    const app = preparar([antigo]);
    assert.deepEqual(app.estado.consultarTransacoes(), []);
    assert.equal(app.estado.transacoesEstaoDisponiveis(), false);
    assert.equal(app.estado.validarTransacaoParaGravacao(antigo), false);
    assert.equal(app.valores.get('transacoes'), JSON.stringify([antigo]));
    assert.equal(app.gravacoes.length, 0);
});

test('consultas e candidatos antigos não permitem mutação externa do estado', async () => {
    const app = preparar([transacao({ extra: { notas: ['original'] } })]);
    const antiga = app.estado.consultarTransacoes();
    assert.throws(() => antiga.push(transacao()), TypeError);
    assert.throws(() => { antiga[0].valor = 999; }, TypeError);
    assert.throws(() => antiga[0].extra.notas.push('fora'), TypeError);
    const candidatas = [{ ...antiga[0], extra: { notas: ['nova'] }, valor: 12.34 }];
    assert.equal((await app.estado.confirmarTransacoes(candidatas)).sucesso, true);
    candidatas[0].extra.notas.push('fora');
    assert.equal(antiga[0].valor, 10);
    assert.equal(app.estado.consultarTransacoes()[0].valor, 12.34);
    assert.deepEqual(app.estado.consultarTransacoes()[0].extra.notas, ['nova']);
});

test('confirmação de receita e despesa grava uma vez antes de atualizar memória', async () => {
    const app = preparar();
    const anterior = app.estado.consultarTransacoes();
    const candidatas = [transacao({ valor: 12.34 }),
        transacao({ id: 'd', tipo: 'despesa', valor: 0.01, classificacao: 'Essencial' })];
    const escrever = app.storage.setItem;
    app.storage.setItem = (chave, valor) => {
        assert.strictEqual(app.estado.consultarTransacoes(), anterior);
        escrever(chave, valor);
    };
    assert.equal((await app.estado.confirmarTransacoes(candidatas)).sucesso, true);
    assert.deepEqual(app.estado.consultarTransacoes(), candidatas);
    assert.deepEqual(app.gravacoes.map(([chave]) => chave), ['transacoes']);
    assert.deepEqual(calculos.calcularTotaisResumo(app.estado.consultarTransacoes()),
        { receitasCentavos: 1234, despesasCentavos: 1 });
});

test('validação rejeita candidatos e preserva a coleção sem gravar', async () => {
    const app = preparar([transacao()]);
    const anterior = app.estado.consultarTransacoes();
    for (const candidata of [null, {}, [{}], [transacao(), transacao()], [transacao({ valor: 0.006 })],
        [transacao({ tipo: 'despesa', classificacao: '' })]]) {
        assert.equal((await app.estado.confirmarTransacoes(candidata)).motivo, 'invalida');
        assert.strictEqual(app.estado.consultarTransacoes(), anterior);
    }
    assert.equal(app.gravacoes.length, 0);
});

test('gravação ou serialização com falha preserva dados, memória e metadados legados', async () => {
    const antigo = transacao({ tipo: 'despesa', classificacao: '' });
    const app = preparar([antigo]);
    const anterior = app.estado.consultarTransacoes();
    const conteudo = app.valores.get('transacoes');
    app.storage.setItem = () => { throw new Error('Quota excedida'); };
    const corrigida = [{ ...antigo, classificacao: 'Essencial' }];
    assert.equal((await app.estado.confirmarTransacoes(corrigida)).motivo, 'gravacao');
    assert.strictEqual(app.estado.consultarTransacoes(), anterior);
    assert.equal(app.estado.validarTransacaoParaGravacao(antigo), true);
    assert.equal(app.valores.get('transacoes'), conteudo);
    const outra = preparar([antigo]);
    const extra = {}; extra.circular = extra;
    assert.equal((await outra.estado.confirmarTransacoes([antigo, transacao({ id: 'nova', extra })])).motivo, 'gravacao');
    assert.equal(outra.gravacoes.length, 0);
    assert.equal(outra.estado.validarTransacaoParaGravacao(antigo), true);
});

test('bloqueios e instâncias são independentes, sem desbloqueio ou releitura automáticos', async () => {
    const primeira = preparar(), segunda = preparar();
    primeira.estado.bloquearColecao('transacoes');
    assert.equal((await primeira.estado.confirmarTransacoes([transacao()])).motivo, 'bloqueada');
    assert.equal((await segunda.estado.confirmarTransacoes([transacao()])).sucesso, true);
    primeira.estado.inicializarTransacoes();
    assert.equal(primeira.estado.transacoesEstaoDisponiveis(), false);
    assert.equal(primeira.leituras.filter((chave) => chave === 'transacoes').length, 1);
    assert.equal(primeira.gravacoes.length, 0);
});

test('confirmação exige inicialização e preparação da compatibilidade sem antecipar fases', async () => {
    const app = preparar([], [], false);
    assert.equal((await app.estado.confirmarTransacoes([])).motivo, 'nao-inicializada');
    assert.equal(app.estado.verificarTransacoesCarregadas().disponivel, false);
    assert.equal(app.estado.colecaoEstaBloqueada('transacoes'), false);
    assert.equal(app.estado.prepararCompatibilidadeTransacoes().sucesso, false);
    app.estado.inicializarTransacoes(); app.estado.inicializarContas(); app.estado.inicializarInvestimentos();
    assert.equal(app.estado.prepararCompatibilidadeTransacoes().sucesso, false);
    assert.equal((await app.estado.confirmarTransacoes([])).motivo, 'nao-inicializada');
    app.estado.verificarTransacoesCarregadas();
    app.estado.prepararCompatibilidadeTransacoes();
    assert.equal((await app.estado.confirmarTransacoes([])).sucesso, true);
});

test('somente despesas legadas integralmente inalteradas conservam a exceção', async () => {
    for (const classificacao of [undefined, '', 'Desconhecida']) {
        const antigo = transacao({ tipo: 'despesa', classificacao, extra: { nota: 'preservar' } });
        const app = preparar([antigo]);
        assert.equal((await app.estado.confirmarTransacoes([antigo, transacao({ id: 'receita' })])).sucesso, true);
        assert.equal((await app.estado.confirmarTransacoes([{ ...antigo, nome: 'Alterado' }])).motivo, 'invalida');
        assert.equal((await app.estado.confirmarTransacoes([{ ...antigo, valor: 11 }])).motivo, 'invalida');
        assert.equal((await app.estado.confirmarTransacoes([{ ...antigo, id: 'outro' }])).motivo, 'invalida');
        const reordenado = { nome: antigo.nome, ...antigo };
        assert.notEqual(JSON.stringify(reordenado), JSON.stringify(antigo));
        assert.equal(app.estado.validarTransacaoParaGravacao(reordenado), false);
    }
});

test('corrigir legado ou excluí-lo remove exceção somente após sucesso, sem recriá-la', async () => {
    const antigo = transacao({ tipo: 'despesa', classificacao: '' });
    for (const candidatas of [[{ ...antigo, classificacao: 'Essencial' }], []]) {
        const app = preparar([antigo]);
        assert.equal((await app.estado.confirmarTransacoes(candidatas)).sucesso, true);
        assert.equal(app.estado.validarTransacaoParaGravacao(antigo), false);
        app.estado.prepararCompatibilidadeTransacoes();
        assert.equal(app.estado.validarTransacaoParaGravacao(antigo), false);
        assert.equal((await app.estado.confirmarTransacoes([antigo])).motivo, 'invalida');
    }
});

test('investimentos bloqueados não impedem receitas/despesas independentes', async () => {
    const app = preparar(); app.estado.bloquearColecao('investimentos');
    assert.equal((await app.estado.confirmarTransacoes([transacao()])).sucesso, true);
    assert.equal((await app.estado.confirmarTransacoes([aporte()])).motivo, 'dependencias');
    assert.equal(app.estado.colecaoEstaBloqueada('transacoes'), false);
    assert.equal(app.gravacoes.length, 1);
});

test('contas bloqueadas, vínculos inexistentes e investimentos inválidos recusam confirmação', async () => {
    const app = preparar();
    assert.equal((await app.estado.confirmarTransacoes([transacao({ contaId: 'ausente' })])).motivo, 'integridade');
    assert.equal((await app.estado.confirmarTransacoes([aporte()])).motivo, 'integridade');
    app.estado.bloquearColecao('contas');
    assert.equal((await app.estado.confirmarTransacoes([transacao()])).motivo, 'dependencias');
    assert.equal(app.gravacoes.length, 0);
});

test('aporte/resgate preservam três valores distintos, IDs e uma única escrita em transações', async () => {
    const carteira = [investimento()];
    const app = preparar([], carteira);
    const movimentos = [aporte({ valor: 20.15 }), resgate({ valor: 30.10, capitalRetirado: 5.05,
        valorRetiradoInvestimento: 40.20 })];
    assert.equal((await app.estado.confirmarTransacoes(movimentos)).sucesso, true);
    assert.deepEqual(app.estado.consultarTransacoes(), movimentos);
    assert.deepEqual(app.gravacoes.map(([chave]) => chave), ['transacoes']);
    assert.equal(calculos.calcularSaldos(app.estado.consultarContas(), app.estado.consultarTransacoes(), HOJE, carteira)
        .saldoTotalCentavos, 10995);
    assert.equal(calculos.calcularCapitaisAplicados(carteira, app.estado.consultarTransacoes(), HOJE)
        .capitaisPorInvestimentoCentavos.get(carteira[0].id), 11510);
    assert.equal(calculos.calcularValoresInvestimentos(carteira, app.estado.consultarTransacoes(), HOJE)
        .totalValorCentavos, 9995);
});

test('edição de vínculo, valor e data recalcula usando as coleções completas', async () => {
    const app = preparar([transacao()]);
    (await app.estado.confirmarContas([conta(), conta({ id: 'conta-b', saldoInicial: 0 })]));
    const editada = [{ ...app.estado.consultarTransacoes()[0], contaId: 'conta-b', valor: 0.25, data: '2026-11-04' }];
    assert.equal((await app.estado.confirmarTransacoes(editada)).sucesso, true);
    const saldos = calculos.calcularSaldos(app.estado.consultarContas(), app.estado.consultarTransacoes(), HOJE);
    assert.equal(saldos.saldosPorContaCentavos.get('conta-b'), 25);
    assert.equal(saldos.saldosPorContaCentavos.get('conta-a'), 10000);
    assert.equal(app.estado.consultarTransacoes()[0].id, transacao().id);
});

test('sequência histórica valida fechamento diário e rejeita mudanças que invalidem resgate futuro', async () => {
    const carteira = [investimento({ capitalInicial: 0 })];
    const a = aporte({ valor: 20, data: '2026-11-02' });
    const r = resgate({ capitalRetirado: 20, data: '2026-12-01' });
    const app = preparar([r, a], carteira);
    const anterior = app.estado.consultarTransacoes();
    for (const candidatas of [[r], [r, { ...a, valor: 10 }], [r, { ...a, data: '2026-12-02' }]]) {
        assert.equal((await app.estado.confirmarTransacoes(candidatas)).motivo, 'integridade');
        assert.strictEqual(app.estado.consultarTransacoes(), anterior);
    }
    assert.equal(app.gravacoes.length, 0);
    assert.equal((await app.estado.confirmarTransacoes([{ ...r, data: a.data }, a])).sucesso, true);
});

test('exclusão múltipla confirma somente a coleção restante e encerra exceções removidas', async () => {
    const antigo = transacao({ tipo: 'despesa', classificacao: '' });
    const outra = transacao({ id: 'outra' });
    const mantida = transacao({ id: 'mantida' });
    const app = preparar([antigo, outra, mantida]);
    const ids = new Set([antigo.id, outra.id]);
    assert.equal((await app.estado.confirmarTransacoes(app.estado.consultarTransacoes().filter((r) => !ids.has(r.id)))).sucesso, true);
    assert.deepEqual(app.estado.consultarTransacoes(), [mantida]);
    assert.equal(app.estado.validarTransacaoParaGravacao(antigo), false);
    assert.equal(app.gravacoes.length, 1);
});

const fonte = readFileSync(resolve(__dirname, '../../frontend/js/script.js'), 'utf8');
const nomes = ['carregarColecao', 'persistirColecao', 'verificarVinculosCarregados'];
const declaracoes = nomes.map((nome) => {
    const encontrados = [...fonte.matchAll(new RegExp(`^(?:async )?function ${nome}\\([^]*?^\\}`, 'gm'))];
    assert.equal(encontrados.length, 1, nome);
    return encontrados[0][0];
}).join('\n\n');

test('adaptadores mantêm mensagens, ordem de leitura e falha sem confirmação indevida', async () => {
    const app = preparar([], [], false), mensagens = [];
    const contexto = createContext({ ...validacoes, ...calculos, ...utilitarios,
        disponibilidadeColecoes: app.estado,
        lerDados: (chave) => lerDados(chave, app.storage),
        mostrarToast: (...args) => mensagens.push(args) });
    const ui = new Script(`${declaracoes}\n({ ${nomes.join(', ')} })`).runInContext(contexto);
    ui.carregarColecao('transacoes', validacoes.validarTransacao);
    ui.carregarColecao('contas', validacoes.validarConta);
    ui.carregarColecao('investimentos', validacoes.validarInvestimento);
    ui.verificarVinculosCarregados(); app.estado.prepararCompatibilidadeTransacoes();
    assert.deepEqual(app.leituras, ['transacoes', 'contas', 'investimentos']);
    app.storage.setItem = () => { throw new Error('Quota'); };
    assert.equal((await ui.persistirColecao('transacoes', [transacao()])), false);
    assert.deepEqual(app.estado.consultarTransacoes(), []);
    assert.match(mensagens.at(-1)[0], /campos preenchidos foram mantidos/);
    assert.equal(mensagens.at(-1)[1], 'erro');
});
