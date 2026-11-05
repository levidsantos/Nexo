const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Script, createContext } = require('node:vm');

// Ponte temporária para o script clássico. Ao extrair ESM, substituir por imports.
// Não executa o bootstrap, não fornece DOM/storage e não copia regras financeiras.
const arquivo = resolve(__dirname, '../../../frontend/js/script.js');
const fonte = readFileSync(arquivo, 'utf8');
const funcoes = [
    'textoPreenchido', 'textoOpcional', 'ehMovimentacaoInvestimento',
    'validarVinculosTransacoes', 'dataValida', 'validarTransacao',
    'prepararMovimentacaoInvestimento', 'validarConta', 'validarColecao',
    'valorInvestimentoValido', 'valorMonetarioValido', 'validarInvestimento',
    'obterDataLocal', 'converterParaCentavos', 'saldosIndisponiveis',
    'capitaisIndisponiveis', 'calcularCapitaisAplicados', 'verificarIntegridadeTransacoes',
    'valoresInvestimentosIndisponiveis', 'calcularValoresInvestimentos',
    'movimentoBancarioCentavos', 'calcularSaldos', 'classificacaoDespesaValida',
    'validarTransacaoParaGravacao', 'formatarCentavos', 'calcularTotaisResumo'
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
trechos.push(declaracao('formatadorMoeda',
    /^const formatadorMoeda = new Intl\.NumberFormat\([^]*?^\}\);/gm));
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
    const contexto = createContext({ Date: DataFixa, transacoes: structuredClone(transacoesLegadas) });
    const programa = `${trechos.join('\n\n')}\n({ ${funcoes.join(', ')} })`;
    const dominio = new Script(programa, { filename: `${arquivo}#dominio-selecionado` })
        .runInContext(contexto, { timeout: 1000 });
    // Normaliza apenas os protótipos dos resultados para assert/strict entre realms.
    return Object.fromEntries(funcoes.map((nome) => [nome,
        (...argumentos) => structuredClone(dominio[nome](...argumentos))]));
}

module.exports = { carregarDominio };
