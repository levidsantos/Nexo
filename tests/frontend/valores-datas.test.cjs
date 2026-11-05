const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregarDominio } = require('./support/carregar-dominio.cjs');
const utilitarios = require('../../frontend/js/dominio/valores-datas.js');
const d = { ...utilitarios, valorMonetarioValido: carregarDominio().valorMonetarioValido };

for (const [entrada, esperado] of [[0, 0], [0.01, 1], [12.34, 1234], ['1.2300', 123],
    [' 0.50 ', 50], ['1e-2', 1], ['+1.20', 120], [90071992547409.9, 9007199254740990]]) {
    test(`centavos: aceita ${JSON.stringify(entrada)} sem arredondar`, () => {
        assert.equal(d.converterParaCentavos(entrada), esperado);
        assert.equal(d.valorMonetarioValido(entrada), true);
    });
}

for (const entrada of [NaN, Infinity, -Infinity, -1, '', ' ', null, undefined, true, {}, [],
    '1,23', 'R$ 1.00', '0x10', 0.006, '1e-3', 1.234, 100000000000000,
    '90071992547409.91', '1000000000000.001', 0.1 + 0.2]) {
    test(`centavos: rejeita ${String(entrada)} (${typeof entrada})`, () => {
        assert.ok(Number.isNaN(d.converterParaCentavos(entrada)));
        assert.equal(d.valorMonetarioValido(entrada), false);
    });
}

test('formatação BRL preserva centavos, negativos pequenos e limite inteiro seguro', () => {
    const formatar = (v) => d.formatarCentavos(v).replace(/\s/g, ' ');
    assert.equal(formatar(0), 'R$ 0,00');
    assert.equal(formatar(12345), 'R$ 123,45');
    assert.equal(formatar(-1), '-R$ 0,01');
    assert.equal(formatar(-12345), '-R$ 123,45');
    assert.equal(formatar(Number.MAX_SAFE_INTEGER), 'R$ 90.071.992.547.409,91');
    for (const valor of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        assert.equal(formatar(valor), 'Indisponível');
    }
});

for (const data of ['2024-02-29', '2000-02-29', '2026-12-31', '0001-01-01']) {
    test(`data válida: ${data}`, () => assert.equal(d.dataValida(data), true));
}
for (const data of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01',
    '2026-13-01', '2026-01-00', '0000-01-01', '2026-1-01', '05/11/2026', '', null]) {
    test(`data inválida: ${data}`, () => assert.equal(d.dataValida(data), false));
}

test('data local usa calendário local, inclusive meia-noite e virada do ano', () => {
    assert.equal(d.obterDataLocal(), '2026-11-05');
    assert.equal(d.obterDataLocal(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
    assert.equal(d.obterDataLocal(new Date(2025, 11, 31, 23, 59)), '2025-12-31');
    assert.equal(d.obterDataLocal(new Date(2026, 1, 3, 12)), '2026-02-03');
});
