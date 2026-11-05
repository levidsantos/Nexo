const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Script, createContext } = require('node:vm');
const utilitarios = require('../../../frontend/js/dominio/valores-datas.js');

// Ponte temporária para as funções ainda não extraídas do ponto de entrada ESM.
// Node 24 carrega sincronamente o módulo real de utilitários (sem top-level await).
// Não executa o bootstrap, não fornece DOM/storage e não copia regras financeiras.
const arquivo = resolve(__dirname, '../../../frontend/js/script.js');
const fonte = readFileSync(arquivo, 'utf8');
const funcoes = [
    'textoPreenchido', 'textoOpcional', 'ehMovimentacaoInvestimento',
    'validarVinculosTransacoes', 'validarTransacao',
    'prepararMovimentacaoInvestimento', 'validarConta', 'validarColecao',
    'valorInvestimentoValido', 'valorMonetarioValido', 'validarInvestimento',
    'saldosIndisponiveis',
    'capitaisIndisponiveis', 'calcularCapitaisAplicados', 'verificarIntegridadeTransacoes',
    'valoresInvestimentosIndisponiveis', 'calcularValoresInvestimentos',
    'movimentoBancarioCentavos', 'calcularSaldos', 'classificacaoDespesaValida',
    'validarTransacaoParaGravacao', 'calcularTotaisResumo'
];

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
trechos.push(declaracao('CLASSIFICACOES_DESPESAS',
    /^const CLASSIFICACOES_DESPESAS = Object\.freeze\([^]*?^\}\);/gm));
trechos.push(declaracao('despesasLegadasSemClassificacao',
    /^const despesasLegadasSemClassificacao = new Map\([^]*?;/gm));

function carregarDominio({ transacoesLegadas = [] } = {}) {
    // Meio-dia local: determinístico também quando a suíte roda em outro fuso.
    class DataFixa extends Date {
        constructor(...argumentos) {
            if (argumentos.length) super(...argumentos);
            else super(2026, 10, 5, 12, 0, 0, 0);
        }
        static now() { return new DataFixa().getTime(); }
    }
    const contexto = createContext({
        ...utilitarios,
        Date: DataFixa,
        // Injeta apenas o relógio; a implementação de data local é a do módulo real.
        obterDataLocal: (data = new DataFixa()) => utilitarios.obterDataLocal(data),
        transacoes: structuredClone(transacoesLegadas)
    });
    const programa = `${trechos.join('\n\n')}\n({ ${funcoes.join(', ')} })`;
    const dominio = new Script(programa, { filename: `${arquivo}#dominio-selecionado` })
        .runInContext(contexto, { timeout: 1000 });
    // Normaliza apenas os protótipos dos resultados para assert/strict entre realms.
    return Object.fromEntries(funcoes.map((nome) => [nome,
        (...argumentos) => structuredClone(dominio[nome](...argumentos))]));
}

module.exports = { carregarDominio };
