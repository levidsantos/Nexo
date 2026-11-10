import { INDICADORES, normalizarIndicador } from '../dominio/indicadores-economicos.js';
import { dataValida } from '../dominio/valores-datas.js';

export async function consultarIndicador(chave, inicio, fim, { solicitar = globalThis.fetch, timeout = 12000 } = {}) {
    const indicador = INDICADORES[chave];
    if (!indicador || !dataValida(inicio) || !dataValida(fim) || inicio > fim
        || Number(fim.slice(0, 4)) - Number(inicio.slice(0, 4)) > 9) throw new Error('Intervalo de consulta inválido.');
    const brasileira = (data) => data.split('-').reverse().join('/');
    const parametros = new URLSearchParams({ formato: 'json', dataInicial: brasileira(inicio), dataFinal: brasileira(fim) });
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeout);
    try {
        const resposta = await solicitar(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${indicador.codigo}/dados?${parametros}`, { signal: controlador.signal, credentials: 'omit' });
        if (resposta.status === 404) {
            const corpo = await resposta.json();
            if (corpo?.erro?.detail?.includes('Value(s) not found')) return [];
            throw new Error('Série não encontrada no Banco Central.');
        }
        if (!resposta.ok) throw new Error(`Banco Central indisponível (HTTP ${resposta.status}).`);
        return normalizarIndicador(await resposta.json(), indicador, inicio, fim);
    } catch (erro) {
        if (controlador.signal.aborted) throw new Error('O Banco Central demorou a responder.');
        throw erro;
    } finally { clearTimeout(temporizador); }
}
