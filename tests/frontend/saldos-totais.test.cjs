const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregarDominio } = require('./support/carregar-dominio.cjs');
const { HOJE, conta, transacao, investimento, aporte, resgate, congelar } = require('./support/fixtures.cjs');
const d = carregarDominio();
const LIMITE_VALIDO = 90071992547409.9;

test('saldos vazios são válidos e saldo inicial não exige movimentações', () => {
    const vazio = d.calcularSaldos([], [], HOJE);
    assert.equal(vazio.disponivel, true);
    assert.equal(vazio.saldoTotalCentavos, 0);
    assert.equal(d.calcularSaldos([conta()], [], HOJE).saldoTotalCentavos, 10000);
});

test('saldo considera somente movimentos posteriores à referência e até hoje', () => {
    const registros = [
        transacao({ id: 'antes', data: '2026-10-30', valor: 500 }),
        transacao({ id: 'igual', data: '2026-10-31', valor: 500 }),
        transacao({ id: 'depois', data: '2026-11-01', valor: 20.25 }),
        transacao({ id: 'hoje', tipo: 'despesa', data: HOJE, valor: 10.10 }),
        transacao({ id: 'futura', data: '2026-11-06', valor: 500 })
    ];
    const resultado = d.calcularSaldos([conta()], registros, HOJE);
    assert.equal(resultado.disponivel, true);
    assert.equal(resultado.saldoTotalCentavos, 11015);
    assert.equal(d.calcularSaldos([conta()], registros, '2026-11-06').saldoTotalCentavos, 61015);
});

test('total inclui todas as contas; disponível inclui negativas marcadas, independente do tipo', () => {
    const contas = [conta({ saldoInicial: 0, tipo: 'reserva' }),
        conta({ id: 'conta-b', saldoInicial: 200, incluirNoSaldoDisponivel: false })];
    const resultado = d.calcularSaldos(contas, [transacao({ tipo: 'despesa', valor: 50.01 }),
        transacao({ id: 'outra', contaId: 'conta-b', valor: 10 })], HOJE);
    assert.equal(resultado.disponivel, true);
    assert.equal(resultado.saldosPorContaCentavos.get('conta-a'), -5001);
    assert.equal(resultado.saldosPorContaCentavos.get('conta-b'), 21000);
    assert.equal(resultado.saldoTotalCentavos, 15999);
    assert.equal(resultado.saldoDisponivelCentavos, -5001);
});

test('aporte debita a conta e resgate credita somente o recebido; bases não debitam a conta', () => {
    const inv = investimento({ capitalInicial: 5000, valorInformado: 6000 });
    assert.equal(d.calcularSaldos([conta()], [], HOJE, [inv]).saldoTotalCentavos, 10000);
    const resultado = d.calcularSaldos([conta()], [aporte({ valor: 20.15 }),
        resgate({ valor: 30.10, capitalRetirado: 5.05, valorRetiradoInvestimento: 40.20 })], HOJE, [inv]);
    assert.equal(resultado.disponivel, true);
    assert.equal(resultado.saldoTotalCentavos, 10995);
});

test('alterações simuladas de valor, tipo, data, conta e referência recalculam sem estado oculto', () => {
    const contas = [conta(), conta({ id: 'conta-b', saldoInicial: 0 })];
    const base = transacao();
    assert.equal(d.calcularSaldos(contas, [base], HOJE).saldoTotalCentavos, 11000);
    assert.equal(d.calcularSaldos(contas, [{ ...base, valor: 30 }], HOJE).saldoTotalCentavos, 13000);
    assert.equal(d.calcularSaldos(contas, [{ ...base, tipo: 'despesa' }], HOJE).saldoTotalCentavos, 9000);
    assert.equal(d.calcularSaldos(contas, [{ ...base, data: '2026-11-06' }], HOJE).saldoTotalCentavos, 10000);
    assert.equal(d.calcularSaldos(contas, [{ ...base, contaId: 'conta-b' }], HOJE)
        .saldosPorContaCentavos.get('conta-a'), 10000);
    assert.equal(d.calcularSaldos([conta({ saldoInicial: 200, dataReferencia: '2026-11-01' })],
        [base], HOJE).saldoTotalCentavos, 20000);
    assert.equal(d.calcularSaldos(contas, [], HOJE).saldoTotalCentavos, 10000);
});

test('saldos inválidos ou vínculos inconsistentes não retornam total parcial confiável', () => {
    for (const [contas, registros, hoje, investimentos] of [
        [[conta({ saldoInicial: 0.006 })], [], HOJE, []],
        [[conta({ dataReferencia: '2026-11-06' })], [], HOJE, []],
        [[conta()], [transacao({ contaId: 'inexistente' })], HOJE, []],
        [[conta()], [aporte()], HOJE, []],
        [[conta()], [], '2026-02-30', []],
        [[conta(), conta()], [], HOJE, []]
    ]) {
        const r = d.calcularSaldos(contas, registros, hoje, investimentos);
        assert.equal(r.disponivel, false);
        assert.equal(r.saldoTotalCentavos, null);
        assert.equal(r.saldoDisponivelCentavos, null);
        assert.equal(r.saldosPorContaCentavos, null);
        assert.ok(r.motivo);
    }
});

test('saldos individuais e soma das contas bloqueiam estouro de inteiros seguros', () => {
    assert.equal(d.calcularSaldos([conta({ saldoInicial: LIMITE_VALIDO })],
        [transacao({ valor: 0.02 })], HOJE).disponivel, false);
    const total = d.calcularSaldos([conta({ saldoInicial: LIMITE_VALIDO }),
        conta({ id: 'conta-b', saldoInicial: LIMITE_VALIDO })], [], HOJE);
    assert.equal(total.disponivel, false);
    assert.equal(total.saldoTotalCentavos, null);
});

test('totais do Resumo incluem datas futuras e excluem aportes/resgates', () => {
    const total = d.calcularTotaisResumo([transacao({ valor: 10.25, data: '2027-01-01' }),
        transacao({ id: 'despesa', tipo: 'despesa', valor: 3.10, data: '2027-01-01' }),
        aporte({ valor: 999 }), resgate({ valor: 888 })]);
    assert.deepEqual(total, { receitasCentavos: 1025, despesasCentavos: 310 });
    assert.deepEqual(d.calcularTotaisResumo([]), { receitasCentavos: 0, despesasCentavos: 0 });
});

test('muitos valores pequenos são somados em centavos, sem erro binário acumulado', () => {
    const registros = Array.from({ length: 2000 }, (_, i) => transacao({ id: `pequena-${i}`, valor: 0.01 }));
    assert.equal(d.calcularTotaisResumo(registros).receitasCentavos, 2000);
    assert.equal(d.calcularSaldos([conta({ saldoInicial: 0 })], registros, HOJE).saldoTotalCentavos, 2000);
});

test('total inválido é indisponível, sem mascarar o outro indicador válido', () => {
    const total = d.calcularTotaisResumo([transacao({ valor: LIMITE_VALIDO }),
        transacao({ id: 'excesso', valor: 0.02 }), transacao({ id: 'despesa', tipo: 'despesa', valor: 2 })]);
    assert.deepEqual(total, { receitasCentavos: null, despesasCentavos: 200 });
    assert.deepEqual(d.calcularTotaisResumo([transacao({ valor: 0.006 })]),
        { receitasCentavos: null, despesasCentavos: null });
});

test('cálculos de saldo e totais não alteram registros, nem acrescentam saldoAtual', () => {
    const contas = congelar([conta()]);
    const registros = congelar([transacao()]);
    const antes = JSON.stringify({ contas, registros });
    d.calcularSaldos(contas, registros, HOJE);
    d.calcularTotaisResumo(registros);
    assert.equal(JSON.stringify({ contas, registros }), antes);
    assert.equal(Object.hasOwn(contas[0], 'saldoAtual'), false);
});
