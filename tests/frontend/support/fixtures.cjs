const HOJE = '2026-11-05';
const INVESTIMENTO_ID = '11111111-1111-4111-8111-111111111111';

function conta(alteracoes = {}) {
    return { id: 'conta-a', nome: 'Conta de teste', tipo: 'corrente', instituicao: '',
        saldoInicial: 100, dataReferencia: '2026-10-31', incluirNoSaldoDisponivel: true,
        ...alteracoes };
}

function transacao(alteracoes = {}) {
    return { id: 'transacao-a', nome: 'Movimento de teste', tipo: 'receita', valor: 10,
        contaId: 'conta-a', data: '2026-11-01', categoria: 'Trabalho',
        ...alteracoes };
}

function investimento(alteracoes = {}) {
    return { id: INVESTIMENTO_ID, nome: 'Investimento de teste', tipo: 'Tipo livre',
        instituicao: '', capitalInicial: 100, valorInformado: 120,
        dataReferenciaCapital: '2026-10-31', dataReferenciaValor: '2026-10-31',
        atualizadoEm: '2026-11-01T12:00:00.000Z', observacoes: '', ...alteracoes };
}

function aporte(alteracoes = {}) {
    return transacao({ id: 'aporte-a', tipo: 'aporte', investimentoId: INVESTIMENTO_ID,
        valor: 20, ...alteracoes });
}

function resgate(alteracoes = {}) {
    return transacao({ id: 'resgate-a', tipo: 'resgate', investimentoId: INVESTIMENTO_ID,
        valor: 30, capitalRetirado: 10, valorRetiradoInvestimento: 25, ...alteracoes });
}

function congelar(valor) {
    if (valor && typeof valor === 'object') {
        Object.values(valor).forEach(congelar);
        Object.freeze(valor);
    }
    return valor;
}

module.exports = { HOJE, INVESTIMENTO_ID, conta, transacao, investimento, aporte, resgate, congelar };
