const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregarDominio } = require('./support/carregar-dominio.cjs');
const { HOJE, INVESTIMENTO_ID, conta, investimento, aporte, resgate, congelar } = require('./support/fixtures.cjs');
const d = carregarDominio();

test('resgate assume valor recebido somente na preparação explícita, sem mutar entrada', () => {
    const original = congelar(resgate({ valor: 12.34, valorRetiradoInvestimento: undefined }));
    assert.equal(d.validarTransacao(original), false);
    const preparado = d.prepararMovimentacaoInvestimento(original);
    assert.equal(preparado.valorRetiradoInvestimento, 12.34);
    assert.equal(d.validarTransacao(preparado), true);
    assert.equal(original.valorRetiradoInvestimento, undefined);
    assert.equal(d.prepararMovimentacaoInvestimento(resgate()).valorRetiradoInvestimento, 25);
});

test('capital e estimativa usam campos distintos do resgate e centavos exatos', () => {
    const registros = [aporte({ valor: 20.15 }),
        resgate({ valor: 30.10, capitalRetirado: 5.05, valorRetiradoInvestimento: 40.20 })];
    const capital = d.calcularCapitaisAplicados([investimento()], registros, HOJE);
    const valor = d.calcularValoresInvestimentos([investimento()], registros, HOJE);
    assert.equal(capital.disponivel, true);
    assert.equal(capital.capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID), 11510);
    assert.equal(valor.disponivel, true);
    assert.equal(valor.valoresPorInvestimento.get(INVESTIMENTO_ID).valorCentavos, 9995);
    assert.equal(valor.valoresPorInvestimento.get(INVESTIMENTO_ID).ajustado, true);
});

test('capital e avaliação respeitam referências independentes', () => {
    const inv = investimento({ dataReferenciaValor: '2026-11-02' });
    const registros = [aporte({ id: 'antes', data: '2026-10-30', valor: 50 }),
        aporte({ id: 'igual-capital', data: '2026-10-31', valor: 50 }),
        aporte({ id: 'depois-capital', data: '2026-11-01', valor: 10 }),
        aporte({ id: 'igual-valor', data: '2026-11-02', valor: 20 }),
        aporte({ id: 'depois-valor', data: '2026-11-03', valor: 5 })];
    assert.equal(d.calcularCapitaisAplicados([inv], registros, HOJE)
        .capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID), 13500);
    assert.equal(d.calcularValoresInvestimentos([inv], registros, HOJE)
        .valoresPorInvestimento.get(INVESTIMENTO_ID).valorCentavos, 12500);
});

test('movimentos futuros não entram na posição atual; capital futuro negativo bloqueia integridade', () => {
    const futuro = aporte({ data: '2026-11-06', valor: 10 });
    assert.equal(d.calcularCapitaisAplicados([investimento()], [futuro], HOJE)
        .capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID), 10000);
    assert.equal(d.calcularValoresInvestimentos([investimento()], [futuro], HOJE).totalValorCentavos, 12000);
    const invalido = resgate({ data: '2026-11-06', capitalRetirado: 101 });
    assert.equal(d.calcularCapitaisAplicados([investimento()], [invalido], HOJE).disponivel, false);
    assert.equal(d.verificarIntegridadeTransacoes([invalido], [conta()], [investimento()]).disponivel, false);
    assert.equal(d.calcularSaldos([conta()], [invalido], HOJE, [investimento()]).disponivel, false);
});

test('capital valida fechamentos diários, independente da ordem dos registros', () => {
    const inv = investimento({ capitalInicial: 0 });
    const entrada = aporte({ valor: 50 });
    const saida = resgate({ capitalRetirado: 30 });
    for (const registros of [[saida, entrada], [entrada, saida]]) {
        const r = d.calcularCapitaisAplicados([inv], registros, HOJE);
        assert.equal(r.disponivel, true);
        assert.equal(r.capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID), 2000);
    }
    assert.equal(d.calcularCapitaisAplicados([inv], [saida,
        aporte({ data: '2026-11-02', valor: 50 })], HOJE).disponivel, false);
});

test('estimativas negativas não são ajustadas para zero', () => {
    const inv = investimento({ valorInformado: 10 });
    const resultado = d.calcularValoresInvestimentos([inv], [resgate({ valorRetiradoInvestimento: 11 })], HOJE);
    assert.equal(resultado.disponivel, false);
    assert.equal(resultado.totalValorCentavos, null);
    assert.equal(resultado.valoresPorInvestimento.get(INVESTIMENTO_ID).valorCentavos, null);
    assert.ok(resultado.valoresPorInvestimento.get(INVESTIMENTO_ID).motivo);
});

test('IDs diferentes mantêm posições separadas; editar ou excluir movimento recalcula', () => {
    const segundo = '22222222-2222-4222-8222-222222222222';
    const carteira = [investimento(), investimento({ id: segundo, capitalInicial: 0, valorInformado: 0 })];
    const a = aporte({ valor: 10 });
    assert.equal(d.calcularValoresInvestimentos(carteira, [a], HOJE).totalValorCentavos, 13000);
    const editado = { ...a, investimentoId: segundo, valor: 5 };
    const resultado = d.calcularValoresInvestimentos(carteira, [editado], HOJE);
    assert.equal(resultado.valoresPorInvestimento.get(INVESTIMENTO_ID).valorCentavos, 12000);
    assert.equal(resultado.valoresPorInvestimento.get(segundo).valorCentavos, 500);
    assert.equal(d.calcularValoresInvestimentos(carteira, [], HOJE).totalValorCentavos, 12000);
    assert.equal(d.calcularCapitaisAplicados(carteira, [editado], HOJE)
        .capitaisPorInvestimentoCentavos.get(segundo), 500);
});

test('valores zero são válidos e movimentos sem investimento são indisponíveis', () => {
    const zero = investimento({ capitalInicial: 0, valorInformado: 0 });
    assert.equal(d.calcularCapitaisAplicados([zero], [], HOJE).disponivel, true);
    assert.equal(d.calcularValoresInvestimentos([zero], [], HOJE).totalValorCentavos, 0);
    assert.equal(d.calcularCapitaisAplicados([], [aporte()], HOJE).disponivel, false);
    assert.equal(d.calcularValoresInvestimentos([], [aporte()], HOJE).disponivel, false);
});

test('capital, posição individual e total da carteira protegem limites seguros', () => {
    const grande = investimento({ capitalInicial: 90071992547409.9, valorInformado: 90071992547409.9 });
    assert.equal(d.calcularCapitaisAplicados([grande], [aporte({ valor: 0.02 })], HOJE).disponivel, false);
    assert.equal(d.calcularValoresInvestimentos([grande], [aporte({ valor: 0.02 })], HOJE).disponivel, false);
    assert.equal(d.calcularValoresInvestimentos([grande, investimento({
        id: '22222222-2222-4222-8222-222222222222', valorInformado: 1 })], [], HOJE).totalValorCentavos, null);
});

test('cálculos e preparação preservam os registros originais', () => {
    const carteira = congelar([investimento()]);
    const registros = congelar([aporte(), resgate()]);
    const antes = JSON.stringify({ carteira, registros });
    d.calcularCapitaisAplicados(carteira, registros, HOJE);
    d.calcularValoresInvestimentos(carteira, registros, HOJE);
    d.prepararMovimentacaoInvestimento(registros[1]);
    assert.equal(JSON.stringify({ carteira, registros }), antes);
});

test('excluir/editar aporte pode invalidar resgate; bases editadas recalculam capital', () => {
    const inv = investimento({ capitalInicial: 0 });
    const entrada = aporte({ valor: 50 });
    const saida = resgate({ capitalRetirado: 30 });
    assert.equal(d.calcularCapitaisAplicados([inv], [entrada, saida], HOJE)
        .capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID), 2000);
    assert.equal(d.calcularCapitaisAplicados([inv], [saida], HOJE).disponivel, false);
    assert.equal(d.calcularCapitaisAplicados([inv], [{ ...entrada, valor: 20 }, saida], HOJE).disponivel, false);
    assert.equal(d.calcularCapitaisAplicados([{ ...inv, capitalInicial: 100 }], [entrada, saida], HOJE)
        .capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID), 12000);
    assert.equal(d.calcularCapitaisAplicados([{ ...inv, dataReferenciaCapital: '2026-11-01' }],
        [entrada, saida], HOJE).capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID), 0);
});
