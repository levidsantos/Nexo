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
const { conta, investimento, transacao, aporte, resgate, INVESTIMENTO_ID, HOJE } = require('./support/fixtures.cjs');

beforeEach((t) => t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 5, 12) }));

function preparar(carteira = [investimento()], registros = [], inicializar = true) {
    const valores = new Map([['transacoes', JSON.stringify(registros)], ['contas', JSON.stringify([conta()])],
        ['investimentos', JSON.stringify(carteira)]]);
    const leituras = [], gravacoes = [];
    const storage = {
        getItem(chave) { leituras.push(chave); return valores.has(chave) ? valores.get(chave) : null; },
        setItem(chave, valor) { gravacoes.push([chave, valor]); valores.set(chave, valor); }
    };
    const estado = criarEstadoDisponibilidade({ ler: (chave) => lerDados(chave, storage),
        gravar: (chave, dados) => gravarDados(chave, dados, storage) });
    function carregar() {
        estado.inicializarTransacoes(); estado.inicializarContas(); estado.inicializarInvestimentos();
        const integridade = estado.verificarTransacoesCarregadas();
        estado.prepararCompatibilidadeTransacoes();
        return integridade;
    }
    if (inicializar) carregar();
    return { estado, valores, storage, leituras, gravacoes, carregar };
}

test('investimentos inicializam uma vez, sem escrita, na ordem das três coleções', () => {
    const app = preparar(undefined, undefined, false);
    assert.equal(app.estado.investimentosEstaoDisponiveis(), false);
    assert.deepEqual(app.leituras, []);
    assert.equal(app.carregar().disponivel, true);
    assert.deepEqual(app.leituras, ['transacoes', 'contas', 'investimentos']);
    assert.equal(app.estado.investimentosEstaoDisponiveis(), true);
    assert.deepEqual(app.estado.consultarInvestimentos(), [investimento()]);
    app.carregar();
    assert.equal(app.leituras.length, 3);
    assert.equal(app.gravacoes.length, 0);
});

test('investimentos ausentes e vazios são válidos e não criam dados automaticamente', () => {
    for (const ausente of [false, true]) {
        const app = preparar([], [], false);
        if (ausente) app.valores.delete('investimentos');
        app.carregar();
        assert.equal(app.estado.investimentosEstaoDisponiveis(), true);
        assert.deepEqual(app.estado.consultarInvestimentos(), []);
        assert.equal(app.valores.has('investimentos'), !ausente);
        assert.equal(app.gravacoes.length, 0);
    }
});

test('dados inválidos e referências futuras são preservados e bloqueados sem recuperação', () => {
    for (const conteudo of ['{invalido', 'null', '{}', JSON.stringify([investimento(), investimento()]),
        JSON.stringify([investimento({ capitalInicial: 0.006 })]),
        JSON.stringify([investimento({ dataReferenciaValor: '2026-11-06' })])]) {
        const app = preparar([], [transacao()], false);
        app.valores.set('investimentos', conteudo); app.carregar();
        assert.equal(app.estado.investimentosEstaoDisponiveis(), false);
        assert.equal(app.estado.transacoesEstaoDisponiveis(), true);
        assert.equal(app.estado.confirmarInvestimentos([]).motivo, 'bloqueada');
        app.valores.set('investimentos', '[]');
        assert.equal(app.estado.inicializarInvestimentos().sucesso, false);
        app.valores.set('investimentos', conteudo);
        assert.equal(app.valores.get('investimentos'), conteudo);
        assert.equal(app.gravacoes.length, 0);
    }
});

test('falha de leitura bloqueia apenas investimentos sem escrever', () => {
    const app = preparar([], [transacao()], false), ler = app.storage.getItem;
    app.storage.getItem = (chave) => {
        if (chave === 'investimentos') throw new Error('Acesso negado');
        return ler(chave);
    };
    app.carregar();
    assert.equal(app.estado.investimentosEstaoDisponiveis(), false);
    assert.equal(app.estado.transacoesEstaoDisponiveis(), true);
    assert.equal(app.gravacoes.length, 0);
});

test('consultas congeladas isolam dados originais, candidatos e versões anteriores', () => {
    const origem = investimento({ extra: { notas: ['original'] } });
    const dados = { contas: [conta()], transacoes: [], investimentos: [origem] };
    const estado = criarEstadoDisponibilidade({ ler: (chave) => ({ sucesso: true, dados: dados[chave] }),
        gravar: () => ({ sucesso: true }) });
    estado.inicializarTransacoes(); estado.inicializarContas(); estado.inicializarInvestimentos();
    const antiga = estado.consultarInvestimentos();
    origem.nome = 'externo'; origem.extra.notas.push('externo');
    assert.equal(antiga[0].nome, 'Investimento de teste');
    assert.throws(() => antiga.push(investimento()), TypeError);
    assert.throws(() => { antiga[0].nome = 'externo'; }, TypeError);
    assert.throws(() => antiga[0].extra.notas.push('externo'), TypeError);
    assert.strictEqual(antiga, estado.consultarInvestimentos());
    const candidatas = [{ ...antiga[0], nome: 'Novo', extra: { notas: ['nova'] } }];
    assert.equal(estado.confirmarInvestimentos(candidatas).sucesso, true);
    candidatas[0].extra.notas.push('externo');
    assert.deepEqual(estado.consultarInvestimentos()[0].extra.notas, ['nova']);
    assert.equal(antiga[0].nome, 'Investimento de teste');
    assert.notStrictEqual(antiga, estado.consultarInvestimentos());
});

test('cadastro, edição, atualização manual e exclusão confirmam uma gravação por operação', () => {
    const app = preparar([]);
    for (const carteira of [[investimento({ capitalInicial: 0, valorInformado: 0 })],
        [investimento({ nome: 'Renomeado' })], [investimento({ valorInformado: 80.25 })], []]) {
        const numero = app.gravacoes.length;
        assert.equal(app.estado.confirmarInvestimentos(carteira).sucesso, true);
        assert.equal(app.gravacoes.length, numero + 1);
        assert.deepEqual(app.estado.consultarInvestimentos(), carteira);
        assert.deepEqual(JSON.parse(app.valores.get('investimentos')), carteira);
    }
    assert.deepEqual(app.gravacoes.map(([chave]) => chave), Array(4).fill('investimentos'));
});

test('validação e limites inválidos preservam memória e armazenamento', () => {
    const app = preparar(), anterior = app.estado.consultarInvestimentos(), dados = app.valores.get('investimentos');
    for (const carteira of [null, {}, [investimento({ capitalInicial: -1 })],
        [investimento({ valorInformado: 0.006 })], [investimento({ valorInformado: 100000000000000 })],
        [investimento(), investimento()]]) {
        assert.equal(app.estado.confirmarInvestimentos(carteira).motivo, 'invalida');
        assert.strictEqual(app.estado.consultarInvestimentos(), anterior);
        assert.equal(app.valores.get('investimentos'), dados);
    }
    assert.equal(app.gravacoes.length, 0);
});

test('falha de persistência ou preparação mantém versão anterior e permite nova tentativa', () => {
    const app = preparar(), anterior = app.estado.consultarInvestimentos(), dados = app.valores.get('investimentos');
    const escrever = app.storage.setItem;
    app.storage.setItem = () => { throw new Error('Quota'); };
    assert.equal(app.estado.confirmarInvestimentos([investimento({ nome: 'Alterado' })]).motivo, 'gravacao');
    assert.strictEqual(app.estado.consultarInvestimentos(), anterior);
    assert.equal(app.valores.get('investimentos'), dados);
    app.storage.setItem = escrever;
    assert.equal(app.estado.confirmarInvestimentos([investimento({ extra: () => {} })]).motivo, 'gravacao');
    assert.equal(app.gravacoes.length, 0);
    assert.equal(app.estado.confirmarInvestimentos([investimento({ nome: 'Alterado' })]).sucesso, true);
});

test('memória só muda depois da confirmação do repositório', () => {
    const app = preparar(), anterior = app.estado.consultarInvestimentos(), escrever = app.storage.setItem;
    app.storage.setItem = (chave, valor) => {
        assert.strictEqual(app.estado.consultarInvestimentos(), anterior);
        assert.equal(chave, 'investimentos');
        escrever(chave, valor);
    };
    assert.equal(app.estado.confirmarInvestimentos([investimento({ nome: 'Confirmado' })]).sucesso, true);
    assert.equal(app.estado.consultarInvestimentos()[0].nome, 'Confirmado');
    assert.equal(app.gravacoes.length, 1);
});

test('bloqueios e inicialização incompleta impedem confirmação sem trocar a coleção', () => {
    const app = preparar(undefined, undefined, false);
    assert.equal(app.estado.confirmarInvestimentos([]).motivo, 'nao-inicializada');
    app.estado.inicializarInvestimentos();
    assert.equal(app.estado.confirmarInvestimentos([]).motivo, 'nao-inicializada');
    app.carregar(); app.estado.bloquearColecao('transacoes');
    assert.equal(app.estado.confirmarInvestimentos([]).motivo, 'dependencias');
    app.estado.bloquearColecao('investimentos');
    assert.equal(app.estado.confirmarInvestimentos([]).motivo, 'bloqueada');
    assert.equal(app.gravacoes.length, 0);
});

test('instâncias não compartilham investimentos nem versões', () => {
    const primeira = preparar(), segunda = preparar();
    primeira.estado.confirmarInvestimentos([investimento({ nome: 'Primeira' })]);
    assert.equal(segunda.estado.consultarInvestimentos()[0].nome, 'Investimento de teste');
    assert.equal(segunda.gravacoes.length, 0);
});

test('renomear preserva IDs, transações e referências; aportes/resgates só gravam transações', () => {
    const app = preparar(), movimentos = [aporte({ valor: 20.25 }), resgate({ valor: 10.50, capitalRetirado: 5.25 })];
    assert.equal(app.estado.confirmarTransacoes(movimentos).sucesso, true);
    const transacoes = app.estado.consultarTransacoes(), salvo = app.valores.get('transacoes');
    assert.deepEqual(app.gravacoes.map(([chave]) => chave), ['transacoes']);
    assert.equal(app.estado.confirmarInvestimentos([{ ...app.estado.consultarInvestimentos()[0], nome: 'Novo' }]).sucesso, true);
    assert.strictEqual(app.estado.consultarTransacoes(), transacoes);
    assert.equal(app.valores.get('transacoes'), salvo);
    assert.equal(app.estado.consultarInvestimentos()[0].id, INVESTIMENTO_ID);
    assert.equal(app.estado.consultarInvestimentos()[0].dataReferenciaCapital, '2026-10-31');
    assert.deepEqual(app.gravacoes.map(([chave]) => chave), ['transacoes', 'investimentos']);
    assert.equal(app.estado.confirmarTransacoes([...transacoes, aporte({ id: 'mais', valor: 1 })]).sucesso, true);
    assert.deepEqual(app.gravacoes.map(([chave]) => chave), ['transacoes', 'investimentos', 'transacoes']);
});

test('excluir ou trocar o ID com movimentos vinculados falha sem alterar memória', () => {
    for (const movimento of [aporte(), resgate(), aporte({ data: '2026-10-01' }), resgate({ data: '2026-11-06' })]) {
        const app = preparar(undefined, [movimento]), anterior = app.estado.consultarInvestimentos();
        assert.equal(app.estado.confirmarInvestimentos([]).motivo, 'integridade');
        assert.equal(app.estado.confirmarInvestimentos([investimento({ id: '22222222-2222-4222-8222-222222222222' })]).motivo, 'integridade');
        assert.strictEqual(app.estado.consultarInvestimentos(), anterior);
        assert.equal(app.gravacoes.length, 0);
    }
});

test('edição de capital valida sequência histórica e fechamentos futuros', () => {
    for (const data of ['2026-11-01', '2026-11-06']) {
        const app = preparar(undefined, [resgate({ data, capitalRetirado: 80 })]);
        assert.equal(app.estado.confirmarInvestimentos([investimento({ capitalInicial: 50 })]).motivo, 'integridade');
        assert.equal(app.estado.consultarInvestimentos()[0].capitalInicial, 100);
        assert.equal(app.gravacoes.length, 0);
    }
    const app = preparar([investimento({ capitalInicial: 0 })],
        [aporte({ valor: 50 }), resgate({ data: '2026-11-02', capitalRetirado: 30 })]);
    assert.equal(app.estado.confirmarInvestimentos([investimento({ capitalInicial: 0, dataReferenciaCapital: '2026-11-01' })]).motivo, 'integridade');
});

test('novas movimentações consultam a versão atual dos investimentos, sem referência obsoleta', () => {
    const app = preparar(), antiga = app.estado.consultarInvestimentos();
    assert.equal(app.estado.confirmarInvestimentos([investimento({ capitalInicial: 0 })]).sucesso, true);
    assert.equal(app.estado.confirmarTransacoes([resgate()]).motivo, 'integridade');
    assert.equal(antiga[0].capitalInicial, 100);
    assert.equal(app.estado.confirmarInvestimentos([investimento({ capitalInicial: 10 })]).sucesso, true);
    assert.equal(app.estado.confirmarTransacoes([resgate({ data: '2026-11-06' })]).sucesso, true);
    assert.equal(calculos.calcularCapitaisAplicados(app.estado.consultarInvestimentos(), app.estado.consultarTransacoes(), HOJE)
        .capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID), 1000);
    assert.deepEqual(app.gravacoes.map(([chave]) => chave), ['investimentos', 'investimentos', 'transacoes']);
});

test('atualização manual e retroativa preserva bases independentes e reaplica movimentos', () => {
    const app = preparar([investimento({ dataReferenciaValor: '2026-11-02' })],
        [aporte({ valor: 20 }), resgate({ data: '2026-11-03', capitalRetirado: 10, valorRetiradoInvestimento: 5 })]);
    const atualizado = { ...app.estado.consultarInvestimentos()[0], valorInformado: 80,
        dataReferenciaValor: '2026-10-31', atualizadoEm: '2026-11-05T12:00:00.000Z' };
    assert.equal(app.estado.confirmarInvestimentos([atualizado]).sucesso, true);
    assert.equal(calculos.calcularValoresInvestimentos(app.estado.consultarInvestimentos(), app.estado.consultarTransacoes(), HOJE).totalValorCentavos, 9500);
    assert.equal(calculos.calcularCapitaisAplicados(app.estado.consultarInvestimentos(), app.estado.consultarTransacoes(), HOJE)
        .capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID), 11000);
});

test('estimativa negativa continua indisponível, sem nova regra de rejeição ou ajuste silencioso', () => {
    const app = preparar(undefined, [resgate({ valorRetiradoInvestimento: 20 })]);
    assert.equal(app.estado.confirmarInvestimentos([investimento({ valorInformado: 10 })]).sucesso, true);
    const valores = calculos.calcularValoresInvestimentos(app.estado.consultarInvestimentos(), app.estado.consultarTransacoes(), HOJE);
    assert.equal(valores.disponivel, false);
    assert.equal(valores.totalValorCentavos, null);
    assert.equal(app.estado.consultarInvestimentos()[0].valorInformado, 10);
});

for (let mascara = 0; mascara < 8; mascara++) {
    test(`inicialização com coleções inválidas, combinação ${mascara}, preserva bloqueios específicos`, () => {
        for (const movimentos of [false, true]) {
            const app = preparar(undefined, movimentos ? [aporte()] : [transacao()], false);
            const chaves = ['contas', 'transacoes', 'investimentos'];
            chaves.forEach((chave, i) => { if (mascara & (1 << i)) app.valores.set(chave, '{invalido'); });
            const antes = new Map(app.valores); app.carregar();
            assert.deepEqual(app.leituras, ['transacoes', 'contas', 'investimentos']);
            assert.equal(app.estado.contasEstaoDisponiveis(), !(mascara & 1));
            assert.equal(app.estado.investimentosEstaoDisponiveis(), !(mascara & 4));
            assert.equal(app.estado.transacoesEstaoDisponiveis(), !(mascara & 3) && !(movimentos && (mascara & 4)));
            assert.deepEqual(app.valores, antes);
            assert.equal(app.gravacoes.length, 0);
        }
    });
}

const fonte = readFileSync(resolve(__dirname, '../../frontend/js/script.js'), 'utf8');
function declaracao(nome) {
    const encontrados = [...fonte.matchAll(new RegExp(`^function ${nome}\\([^]*?^\\}`, 'gm'))];
    assert.equal(encontrados.length, 1, nome);
    return encontrados[0][0];
}
function adaptadores(app, adicionais = {}) {
    const mensagens = [];
    const contexto = createContext({ ...validacoes, ...calculos, ...utilitarios,
        disponibilidadeColecoes: app.estado, mostrarToast: (...args) => mensagens.push(args), ...adicionais });
    const nomes = ['carregarColecao', 'persistirColecao', 'verificarVinculosCarregados', 'investimentosDisponiveis', 'podeExcluirInvestimento'];
    const ui = new Script(nomes.map(declaracao).join('\n') + `\n({${nomes.join(',')}})`).runInContext(contexto);
    return { ui, contexto, mensagens };
}

test('adaptadores reais preservam mensagens e proteção de exclusão histórica/futura', () => {
    for (const movimento of [null, aporte(), resgate({ data: '2026-11-06' })]) {
        const app = preparar(undefined, movimento ? [movimento] : []), { ui, mensagens } = adaptadores(app);
        assert.equal(ui.podeExcluirInvestimento(INVESTIMENTO_ID), !movimento);
        if (movimento) assert.match(mensagens.at(-1)[0], /vinculados/);
        app.estado.bloquearColecao('transacoes');
        assert.equal(ui.podeExcluirInvestimento(INVESTIMENTO_ID), false);
        assert.match(mensagens.at(-1)[0], /transações estão indisponíveis/);
    }
    const app = preparar(), { ui, mensagens } = adaptadores(app), antes = app.estado.consultarInvestimentos();
    app.storage.setItem = () => { throw new Error('Quota'); };
    assert.equal(ui.persistirColecao('investimentos', [investimento({ nome: 'Outro' })]), false);
    assert.strictEqual(app.estado.consultarInvestimentos(), antes);
    assert.match(mensagens.at(-1)[0], /campos preenchidos foram mantidos/);
});

test('handlers reais exigem confirmação retroativa na edição e atualização manual', () => {
    for (const manual of [false, true]) {
        const app = preparar([investimento({ dataReferenciaValor: '2026-11-02' })]);
        const campo = (value) => ({ value, validity: { valid: true } });
        const campos = { nome: campo('Editado'), tipo: campo('Tipo livre'), instituicao: campo(''), capital: campo('100'),
            valor: campo('80'), referencia: campo('2026-10-31'), referenciaValor: campo('2026-10-31'), observacoes: campo('') };
        const confirmacao = { checked: false }, erros = [], efeitos = [];
        const form = manual ? 'formValorInvestimento' : 'formInvestimento';
        const trecho = fonte.match(new RegExp(`^${form}\\.addEventListener\\("submit",[^]*?^\\}\\);`, 'm'))[0];
        let enviar;
        const extras = {
            [form]: { addEventListener: (_, callback) => { enviar = callback; } },
            camposInvestimento: campos, campoValorManual: campos.valor, campoDataValorManual: campos.referenciaValor,
            investimentoEmEdicao: INVESTIMENTO_ID, investimentoEmAtualizacao: INVESTIMENTO_ID,
            document: { getElementById: () => confirmacao },
            limparErros() {}, mostrarErro: (_, mensagem) => erros.push(mensagem), focarPrimeiroErro() {},
            renderizarInvestimentos: () => efeitos.push('render'), renderizarTransacoes() {}, atualizarTabelaCompleta() {},
            listaTransacoes: {}, prepararRetornoFocoInvestimento() {},
            fecharModalInvestimento: () => efeitos.push('fechar'), fecharAtualizacaoValor: () => efeitos.push('fechar')
        };
        const { contexto } = adaptadores(app, extras);
        new Script(trecho).runInContext(contexto);
        enviar({ preventDefault() {} });
        assert.match(erros.at(-1), /Confirme abaixo/);
        assert.equal(app.gravacoes.length, 0);
        confirmacao.checked = true;
        app.storage.setItem = () => { throw new Error('Quota'); };
        enviar({ preventDefault() {} });
        assert.equal(efeitos.length, 0);
        assert.equal(app.estado.consultarInvestimentos()[0].dataReferenciaValor, '2026-11-02');
        app.storage.setItem = (chave, valor) => { app.gravacoes.push([chave, valor]); app.valores.set(chave, valor); };
        enviar({ preventDefault() {} });
        assert.deepEqual(efeitos, ['render', 'fechar']);
        assert.equal(app.gravacoes.length, 1);
        assert.equal(app.estado.consultarInvestimentos()[0].id, INVESTIMENTO_ID);
        assert.equal(app.estado.consultarInvestimentos()[0].dataReferenciaValor, '2026-10-31');
        assert.equal(app.estado.consultarInvestimentos()[0].valorInformado, 80);
    }
});
