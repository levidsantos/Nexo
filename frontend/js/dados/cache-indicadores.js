import { INDICADORES, intervaloIndicador, intervaloHistorico, normalizarIndicador } from '../dominio/indicadores-economicos.js';
import { obterDataLocal, dataValida } from '../dominio/valores-datas.js';
import { consultarIndicador } from './api-bcb.js';

export function criarCacheIndicadores({ consultar = consultarIndicador, armazenamento = () => globalThis.localStorage, agora = () => Date.now(), hoje = () => obterDataLocal() } = {}) {
    const memoria = new Map(), pendentes = new Map();
    function ler(chave, intervalo, identificador, historico) {
        try {
            const item = memoria.get(identificador) ?? JSON.parse(armazenamento().getItem(`nexo-indicadores:v1:${identificador}`));
            if (!item || item.versao !== 1 || item.codigo !== INDICADORES[chave].codigo || !Number.isFinite(item.consultadoEm)
                || item.consultadoEm < 0 || item.consultadoEm > agora() || !dataValida(item.inicio) || !dataValida(item.fim)
                || item.inicio > item.fim || item.fim > intervalo.fim) return null;
            const dados = normalizarIndicador(item.dados, INDICADORES[chave], item.inicio, item.fim);
            if (!dados.length && !historico) return null;
            return { ...item, observacao: dados.at(-1) };
        } catch { return null; }
    }
    function obter(chave, meses = null) {
        if (!INDICADORES[chave]) return Promise.reject(new Error('Indicador desconhecido.'));
        const historico = meses !== null;
        const intervalo = historico ? intervaloHistorico(chave, meses, hoje()) : intervaloIndicador(hoje());
        const identificador = historico ? `historico:${chave}:${meses}` : chave;
        if (pendentes.has(identificador)) return pendentes.get(identificador);
        const anterior = ler(chave, intervalo, identificador, historico);
        if (anterior && anterior.inicio === intervalo.inicio && anterior.fim === intervalo.fim && agora() - anterior.consultadoEm < INDICADORES[chave].ttl) {
            return Promise.resolve({ ...anterior, estado: 'atual' });
        }
        const promessa = (async () => {
            try {
                const dados = await consultar(chave, intervalo.inicio, intervalo.fim);
                const normalizados = normalizarIndicador(dados.map(p => ({ data: p.data.split('-').reverse().join('/'), valor: p.valor })), INDICADORES[chave], intervalo.inicio, intervalo.fim);
                if (!normalizados.length && !historico) throw new Error('Nenhum dado disponível no período consultado.');
                const item = { versao: 1, codigo: INDICADORES[chave].codigo, ...intervalo, consultadoEm: agora(), dados: normalizados.map(p => ({ data: p.data.split('-').reverse().join('/'), valor: p.valor })) };
                memoria.set(identificador, item);
                try { armazenamento().setItem(`nexo-indicadores:v1:${identificador}`, JSON.stringify(item)); } catch { /* Cache opcional. */ }
                return { ...item, observacao: normalizados.at(-1), estado: 'atual' };
            } catch {
                if (anterior) return { ...anterior, estado: 'anterior' };
                return { estado: 'indisponivel' };
            } finally { pendentes.delete(identificador); }
        })();
        pendentes.set(identificador, promessa);
        return promessa;
    }
    return { obter };
}
