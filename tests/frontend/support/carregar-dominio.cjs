const validacoes = require('../../../frontend/js/dominio/validacoes.js');
const calculos = require('../../../frontend/js/dominio/calculos.js');
const { criarEstadoFinanceiro } = require('../../../frontend/js/dados/estado.js');
const { prepararMovimentacaoInvestimento } = require('../../../frontend/js/funcionalidades/operacoes-investimentos.js');
const { conta } = require('./fixtures.cjs');
const { beforeEach } = require('node:test');

// Relógio e estado isolados para os testes de compatibilidade legada.
beforeEach((t) => t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 5, 12) }));

function carregarDominio({ transacoesLegadas = [] } = {}) {
    const estado = criarEstadoFinanceiro({
        ler: (chave) => ({ sucesso: true, dados: chave === "transacoes" ? transacoesLegadas : chave === "investimentos" ? [] : [conta()] })
    });
    estado.inicializarTransacoes();
    estado.inicializarContas();
    estado.inicializarInvestimentos();
    estado.verificarTransacoesCarregadas();
    estado.prepararCompatibilidadeTransacoes();
    return { ...validacoes, ...calculos, prepararMovimentacaoInvestimento, validarTransacaoParaGravacao: estado.validarTransacaoParaGravacao };
}

module.exports = { carregarDominio };
