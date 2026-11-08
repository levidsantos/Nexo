const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepararHistoricoMensal, definirPeriodoDespesas, prepararDistribuicaoDespesas } =
    require('../../frontend/js/dominio/calculos.js');
const { transacao, congelar } = require('./support/fixtures.cjs');

test('histórico importado mantém janela completa, centavos, virada de ano e exclusão de futuros', () => {
    const registros = congelar([
        transacao({ id: 'r', data: '2025-12-01', valor: 12.34 }),
        transacao({ id: 'd', tipo: 'despesa', data: '2026-02-02', valor: 0.01 }),
        transacao({ id: 'f', data: '2026-02-06', valor: 99 })
    ]);
    const antes = JSON.stringify(registros);
    const resultado = prepararHistoricoMensal(registros, '2026-02-05', null, 6);
    assert.equal(resultado.disponivel, true);
    assert.deepEqual(resultado.meses.map((item) => item.mes),
        ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
    assert.equal(resultado.meses[3].receitasCentavos, 1234);
    assert.equal(resultado.meses[4].receitasCentavos, 0);
    assert.equal(resultado.meses[5].receitasCentavos, 0);
    assert.equal(resultado.meses[5].despesasCentavos, 1);
    assert.equal(JSON.stringify(registros), antes);
});

test('períodos importados preservam mês anterior, intervalos inclusivos e rejeições', () => {
    assert.equal(definirPeriodoDespesas('anterior', null, null, '2026-01-05').mesInicial, '2025-12');
    assert.equal(definirPeriodoDespesas('atual', null, null, '2026-01-05').mesFinal, '2026-01');
    assert.equal(definirPeriodoDespesas('personalizado', '2025-12', '2026-02', '2026-01-05').disponivel, true);
    assert.equal(definirPeriodoDespesas('personalizado', '2026-02', '2026-03', '2026-01-05').disponivel, false);
    assert.equal(definirPeriodoDespesas('personalizado', '2026-01', '2025-12', '2026-01-05').disponivel, false);
});

test('distribuição importada mantém classificação, valores, percentuais e imutabilidade', () => {
    const registros = congelar([
        transacao({ id: 'a', tipo: 'despesa', classificacao: 'Essencial', valor: 0.01, data: '2025-12-31' }),
        transacao({ id: 'b', tipo: 'despesa', classificacao: 'Desejo', valor: 0.03, data: '2026-01-01' }),
        transacao({ id: 'r', valor: 50, data: '2026-01-01' }),
        transacao({ id: 'f', tipo: 'despesa', classificacao: 'Essencial', valor: 99, data: '2026-01-06' })
    ]);
    const antes = JSON.stringify(registros);
    const resultado = prepararDistribuicaoDespesas(registros, '2025-12', '2026-01', '2026-01-05');
    assert.equal(resultado.totalCentavos, 4);
    const essenciais = resultado.classificacoes.find((item) => item.id === 'Essencial');
    assert.equal(essenciais.totalCentavos, 1);
    assert.equal(essenciais.percentual, 25);
    assert.equal(essenciais.cor, '#289568');
    assert.equal(resultado.classificacoes.find((item) => item.id === 'Desejo').percentual, 75);
    assert.equal(JSON.stringify(registros), antes);
});

test('agregações importadas distinguem vazio, coleção inválida e classificação ausente', () => {
    assert.equal(prepararHistoricoMensal([], '2026-01-05').vazio, true);
    assert.equal(prepararHistoricoMensal(null, '2026-01-05').disponivel, false);
    assert.equal(prepararDistribuicaoDespesas([], '2026-01', '2026-01', '2026-01-05').vazio, true);
    assert.equal(prepararDistribuicaoDespesas(null, '2026-01', '2026-01', '2026-01-05').disponivel, false);
    assert.equal(prepararDistribuicaoDespesas([
        transacao({ tipo: 'despesa', classificacao: '', data: '2026-01-01' })
    ], '2026-01', '2026-01', '2026-01-05').disponivel, false);
});
