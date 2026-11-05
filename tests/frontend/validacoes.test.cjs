const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregarDominio } = require('./support/carregar-dominio.cjs');
const { conta, transacao, investimento, aporte, resgate, congelar } = require('./support/fixtures.cjs');
const d = carregarDominio();

test('contas: tipos atuais, saldo zero, instituição opcional e referência de hoje', () => {
    for (const tipo of ['corrente', 'poupanca', 'reserva', 'carteira']) {
        assert.equal(d.validarConta(conta({ tipo, saldoInicial: 0, dataReferencia: '2026-11-05' })), true);
    }
    assert.equal(d.validarConta(conta({ incluirNoSaldoDisponivel: false })), true);
    // Compatibilidade real: o validador de contas aceita IDs textuais já existentes.
    assert.equal(d.validarConta(conta({ id: 'id-antigo' })), true);
});

test('contas: rejeita registro, campos, valores e referência incompatíveis', () => {
    for (const registro of [null, [], {}, conta({ nome: ' ' }), conta({ tipo: 'credito' }),
        conta({ saldoInicial: -1 }), conta({ saldoInicial: 0.006 }), conta({ saldoInicial: '10' }),
        conta({ saldoInicial: 100000000000000 }), conta({ incluirNoSaldoDisponivel: 'true' }),
        conta({ dataReferencia: '2026-11-06' }), conta({ dataReferencia: '2026-02-30' })]) {
        assert.equal(d.validarConta(registro), false, JSON.stringify(registro));
    }
});

test('transações: aceita histórico, futuro e quatro tipos sem exigir campos de despesa nas movimentações', () => {
    assert.equal(d.validarTransacao(transacao({ data: '2020-01-01' })), true);
    assert.equal(d.validarTransacao(transacao({ data: '2027-01-01' })), true);
    assert.equal(d.validarTransacao(transacao({ tipo: 'despesa', classificacao: 'Essencial' })), true);
    assert.equal(d.validarTransacao(aporte({ categoria: undefined })), true);
    assert.equal(d.validarTransacao(resgate({ categoria: undefined })), true);
});

test('transações: exige número positivo seguro e os campos próprios do tipo', () => {
    for (const registro of [transacao({ valor: 0 }), transacao({ valor: -1 }), transacao({ valor: '10' }),
        transacao({ valor: 0.006 }), transacao({ contaId: '' }), transacao({ categoria: '' }),
        transacao({ tipo: 'transferencia' }), transacao({ data: '2026-02-30' }),
        aporte({ investimentoId: '' }), resgate({ capitalRetirado: 0 }),
        resgate({ valorRetiradoInvestimento: 0 }), resgate({ capitalRetirado: 0.006 })]) {
        assert.equal(d.validarTransacao(registro), false, JSON.stringify(registro));
    }
});

test('investimentos: zero, perda de valor e tipo livre são válidos', () => {
    assert.equal(d.validarInvestimento(investimento({ capitalInicial: 0, valorInformado: 0 })), true);
    assert.equal(d.validarInvestimento(investimento({ capitalInicial: 100, valorInformado: 50 })), true);
    assert.equal(d.validarInvestimento(investimento({ instituicao: undefined, observacoes: undefined })), true);
    assert.equal(d.validarInvestimento(investimento({ observacoes: 'a'.repeat(500) })), true);
});

test('investimentos: UUID, referências, ISO, precisão e limites são validados', () => {
    for (const registro of [investimento({ id: 'id-antigo' }), investimento({ nome: '' }),
        investimento({ tipo: '' }), investimento({ capitalInicial: -1 }), investimento({ valorInformado: 0.006 }),
        investimento({ capitalInicial: 100000000000000 }), investimento({ dataReferenciaCapital: '2026-11-06' }),
        investimento({ dataReferenciaValor: '2026-11-06' }), investimento({ atualizadoEm: '2026-11-01' }),
        investimento({ atualizadoEm: 'inválido' }), investimento({ observacoes: 'a'.repeat(501) })]) {
        assert.equal(d.validarInvestimento(registro), false, JSON.stringify(registro));
    }
});

test('coleções exigem array válido e IDs únicos', () => {
    assert.equal(d.validarColecao([], d.validarConta), true);
    assert.equal(d.validarColecao({}, d.validarConta), false);
    assert.equal(d.validarColecao([conta(), conta()], d.validarConta), false);
    assert.equal(d.validarColecao([conta(), conta({ id: 'conta-b' })], d.validarConta), true);
    assert.equal(d.validarColecao([transacao(), transacao()], d.validarTransacao), false);
    assert.equal(d.validarColecao([investimento(), investimento()], d.validarInvestimento), false);
});

test('vínculos usam IDs, preservam renomeações e rejeitam destinos inexistentes', () => {
    assert.equal(d.validarVinculosTransacoes([aporte()], [conta({ nome: 'Renomeada' })],
        [investimento({ nome: 'Novo nome' })]), true);
    assert.equal(d.validarVinculosTransacoes([transacao({ contaId: 'ausente' })], [conta()]), false);
    assert.equal(d.validarVinculosTransacoes([aporte()], [conta()], []), false);
});

test('legados sem classificação só podem ser gravados integralmente inalterados', () => {
    for (const classificacao of [undefined, '', 'Desconhecida']) {
        const antigo = congelar(transacao({ tipo: 'despesa', classificacao }));
        const legado = carregarDominio({ transacoesLegadas: [antigo] });
        assert.equal(legado.validarTransacao(antigo), true);
        assert.equal(legado.validarTransacaoParaGravacao(antigo), true);
        assert.equal(legado.validarTransacaoParaGravacao({ ...antigo, nome: 'Editada' }), false);
        assert.equal(legado.validarTransacaoParaGravacao({ ...antigo, id: 'nova' }), false);
        assert.equal(legado.validarTransacaoParaGravacao({ ...antigo, classificacao: 'Essencial' }), true);
        assert.equal(legado.validarColecao([antigo, transacao({ id: 'receita-nova' })],
            legado.validarTransacaoParaGravacao), true);
        assert.equal(d.validarTransacaoParaGravacao(antigo), false);
    }
    assert.equal(d.validarTransacaoParaGravacao(transacao()), true);
    assert.equal(d.validarTransacaoParaGravacao(aporte()), true);
});

test('registros monetariamente válidos continuam válidos após serialização JSON', () => {
    for (const [registro, validar] of [
        [conta({ saldoInicial: 123.45 }), d.validarConta],
        [transacao({ valor: 0.01 }), d.validarTransacao],
        [investimento({ capitalInicial: 0, valorInformado: 90071992547409.9 }), d.validarInvestimento],
        [resgate({ valor: 12.34, capitalRetirado: 5.67, valorRetiradoInvestimento: 8.90 }), d.validarTransacao]
    ]) {
        const salvo = JSON.parse(JSON.stringify(registro));
        assert.equal(validar(salvo), true);
        assert.deepEqual(salvo, registro);
    }
});
