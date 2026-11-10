import { dataValida, obterDataLocal } from './valores-datas.js';

export const INDICADORES = Object.freeze({
    selic: { codigo: 432, titulo: 'Selic Meta', unidade: '% ao ano', ttl: 6 * 3600000, mensal: false, periodos: [1, 3, 6, 12], padrao: 12, contexto: 'Meta da taxa básica de juros definida pelo Copom.' },
    ipca: { codigo: 433, titulo: 'IPCA mensal', unidade: '% no mês', ttl: 24 * 3600000, mensal: true, periodos: [12, 24, 60], padrao: 12, contexto: 'Mede a variação de preços no mês de referência. Pode ser negativa ou zero.' },
    ipca12: { codigo: 13522, titulo: 'IPCA acumulado em 12 meses', unidade: '% em 12 meses', ttl: 24 * 3600000, mensal: true, periodos: [12, 24, 60], padrao: 24, contexto: 'Inflação acumulada em 12 meses, conforme a série oficial do IBGE disponibilizada pelo Banco Central.' },
    dolar: { codigo: 1, titulo: 'Dólar PTAX venda', unidade: 'R$/US$', ttl: 6 * 3600000, mensal: false, periodos: [1, 3, 6, 12], padrao: 3, contexto: 'Taxa de referência de venda calculada pelo Banco Central. Não é uma cotação em tempo real.' }
});

export function normalizarIndicador(registros, indicador, inicio, fim) {
    if (!Array.isArray(registros)) throw new Error('Resposta inválida do Banco Central.');
    const datas = new Set();
    return registros.map((registro) => {
        const partes = typeof registro?.data === 'string' && /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(registro.data);
        const data = partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : '';
        const decimal = typeof registro?.valor === 'string' && /^-?\d+(?:\.\d+)?$/.test(registro.valor);
        const valor = decimal ? Number(registro.valor) : NaN;
        if (!dataValida(data) || data < inicio || data > fim || datas.has(data)
            || !Number.isFinite(valor) || Math.abs(valor) > Number.MAX_SAFE_INTEGER
            || (!indicador.mensal && valor < 0) || (indicador.mensal && !data.endsWith('-01'))) {
            throw new Error('Dados inválidos no retorno do Banco Central.');
        }
        datas.add(data);
        return { data, valor: registro.valor };
    }).sort((a, b) => a.data.localeCompare(b.data));
}

export function intervaloIndicador(hoje = obterDataLocal()) {
    if (!dataValida(hoje)) throw new Error('Data de consulta inválida.');
    return { inicio: `${Number(hoje.slice(0, 4)) - 1}-01-01`, fim: hoje };
}

export function intervaloHistorico(chave, meses, hoje = obterDataLocal()) {
    const indicador = INDICADORES[chave];
    if (!indicador || !indicador.periodos.includes(meses) || !dataValida(hoje)) throw new Error('Período inválido.');
    const [ano, mes, dia] = hoje.split('-').map(Number);
    const base = new Date(Date.UTC(ano, mes - 1 - meses + (indicador.mensal ? 1 : 0), 1));
    const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(indicador.mensal ? 1 : Math.min(dia, ultimoDia));
    return { inicio: base.toISOString().slice(0, 10), fim: hoje };
}
