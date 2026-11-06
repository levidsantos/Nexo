const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Script, createContext } = require('node:vm');
const validacoes = require('../../../frontend/js/dominio/validacoes.js');
const calculos = require('../../../frontend/js/dominio/calculos.js');
const { criarEstadoDisponibilidade } = require('../../../frontend/js/dados/estado.js');
const { conta } = require('./fixtures.cjs');
const { beforeEach } = require('node:test');

// O relógio é fixado no teste, sem substituir as implementações importadas.
beforeEach((t) => t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 5, 12) }));

// Ponte temporária para as funções ainda não extraídas do ponto de entrada ESM.
// Node 24 carrega os módulos reais; somente a preparação de movimentações permanece na VM.
// Não executa o bootstrap, não fornece DOM/storage e não copia regras financeiras.
const arquivo = resolve(__dirname, '../../../frontend/js/script.js');
const fonte = readFileSync(arquivo, 'utf8');
const funcoes = ['prepararMovimentacaoInvestimento'];

function declaracao(nome, padrao) {
    const correspondencias = [...fonte.matchAll(padrao)];
    if (correspondencias.length !== 1) {
        throw new Error(`Adaptador: esperada uma declaração de ${nome}; encontradas ${correspondencias.length}. Revise a ponte, não as expectativas financeiras.`);
    }
    const trecho = correspondencias[0][0];
    // O recorte exige a formatação atual (declaração/fechamento na coluna zero).
    // Uma mudança estrutural deve falhar explicitamente, nunca executar o arquivo inteiro.
    new Script(trecho, { filename: `${arquivo}#${nome}` });
    return trecho;
}

const trechos = funcoes.map((nome) => declaracao(nome,
    new RegExp(`^function ${nome}\\([^]*?^\\}`, 'gm')));

function carregarDominio({ transacoesLegadas = [] } = {}) {
    const estado = criarEstadoDisponibilidade({
        ler: (chave) => ({ sucesso: true, dados: chave === "transacoes" ? transacoesLegadas : chave === "investimentos" ? [] : [conta()] })
    });
    estado.inicializarTransacoes();
    estado.inicializarContas();
    estado.inicializarInvestimentos();
    estado.verificarTransacoesCarregadas();
    estado.prepararCompatibilidadeTransacoes();
    const contexto = createContext({
        ...validacoes
    });
    const programa = `${trechos.join('\n\n')}\n({ ${funcoes.join(', ')} })`;
    const dominio = new Script(programa, { filename: `${arquivo}#dominio-selecionado` })
        .runInContext(contexto, { timeout: 1000 });
    // Normaliza apenas os protótipos dos resultados para assert/strict entre realms.
    return { ...validacoes, ...calculos, validarTransacaoParaGravacao: estado.validarTransacaoParaGravacao, ...Object.fromEntries(funcoes.map((nome) => [nome,
        (...argumentos) => structuredClone(dominio[nome](...argumentos))])) };
}

module.exports = { carregarDominio };
