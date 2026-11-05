import { dataValida, obterDataLocal, converterParaCentavos } from "./valores-datas.js";
import { validarColecao, validarConta, validarTransacao, validarInvestimento, validarVinculosTransacoes, ehMovimentacaoInvestimento, CLASSIFICACOES_DESPESAS } from "./validacoes.js";

export function saldosIndisponiveis(motivo) {
    return {
        disponivel: false,
        motivo,
        saldosPorContaCentavos: null,
        saldoTotalCentavos: null,
        saldoDisponivelCentavos: null
    };
}

export function capitaisIndisponiveis(motivo) {
    return { disponivel: false, motivo, capitaisPorInvestimentoCentavos: null };
}

export function calcularCapitaisAplicados(investimentosCadastrados, registros, hoje = obterDataLocal()) {
    if (!dataValida(hoje) || !validarColecao(investimentosCadastrados, validarInvestimento)
        || !validarColecao(registros, validarTransacao)) {
        return capitaisIndisponiveis("Investimentos, transações ou data inválidos para calcular o capital.");
    }
    const porId = new Map(investimentosCadastrados.map((item) => [item.id, item]));
    const movimentosPorDia = new Map(investimentosCadastrados.map((item) => [item.id, new Map()]));
    for (const registro of registros) {
        if (!ehMovimentacaoInvestimento(registro)) continue;
        const investimento = porId.get(registro.investimentoId);
        if (!investimento) return capitaisIndisponiveis("Há uma movimentação vinculada a um investimento inexistente.");
        // A base é consolidada ao final da referência. Não conhecemos o capital anterior.
        if (registro.data <= investimento.dataReferenciaCapital) continue;
        const dias = movimentosPorDia.get(investimento.id);
        const totais = dias.get(registro.data) || { aportes: 0, retiradas: 0 };
        const campo = registro.tipo === "aporte" ? "aportes" : "retiradas";
        const valor = converterParaCentavos(registro.tipo === "aporte" ? registro.valor : registro.capitalRetirado);
        const acumulado = totais[campo] + valor;
        if (!Number.isSafeInteger(valor) || !Number.isSafeInteger(acumulado)) {
            return capitaisIndisponiveis("Um movimento diário ultrapassa o limite seguro em centavos.");
        }
        totais[campo] = acumulado;
        dias.set(registro.data, totais);
    }
    const capitaisPorInvestimentoCentavos = new Map();
    for (const investimento of investimentosCadastrados) {
        let capital = converterParaCentavos(investimento.capitalInicial);
        if (!Number.isSafeInteger(capital)) return capitaisIndisponiveis("Capital inicial fora do limite seguro.");
        let corrente = capital;
        // Sem horário, valida-se o fechamento de cada dia, independentemente da ordem do array.
        const dias = [...movimentosPorDia.get(investimento.id)].sort(([a], [b]) => a.localeCompare(b));
        for (const [data, totais] of dias) {
            capital += totais.aportes - totais.retiradas;
            if (!Number.isSafeInteger(capital) || capital < 0) {
                return capitaisIndisponiveis(`Capital inconsistente no investimento "${investimento.nome}" em ${data}: saldo negativo ou fora do limite seguro.`);
            }
            if (data <= hoje) corrente = capital;
        }
        capitaisPorInvestimentoCentavos.set(investimento.id, corrente);
    }
    return { disponivel: true, motivo: "", capitaisPorInvestimentoCentavos };
}

export function verificarIntegridadeTransacoes(registros, contasCadastradas, investimentosCadastrados) {
    if (!validarColecao(registros, validarTransacao) || !validarColecao(contasCadastradas, validarConta)
        || !validarVinculosTransacoes(registros, contasCadastradas, investimentosCadastrados)) {
        return { disponivel: false, motivo: "Há dados inválidos ou vínculos com contas/investimentos inexistentes." };
    }
    // Uma coleção de investimentos indisponível não invalida receitas/despesas sem esses vínculos.
    return registros.some(ehMovimentacaoInvestimento)
        ? calcularCapitaisAplicados(investimentosCadastrados, registros)
        : { disponivel: true, motivo: "" };
}

export function valoresInvestimentosIndisponiveis(motivo) {
    return { disponivel: false, motivo, valoresPorInvestimento: null, totalValorCentavos: null };
}

export function calcularValoresInvestimentos(investimentosCadastrados, registros, hoje = obterDataLocal()) {
    if (!dataValida(hoje) || !validarColecao(investimentosCadastrados, validarInvestimento)
        || !validarColecao(registros, validarTransacao)) {
        return valoresInvestimentosIndisponiveis("Dados ou data inválidos para estimar as posições.");
    }
    const valoresPorInvestimento = new Map(investimentosCadastrados.map((item) => [item.id, {
        disponivel: true, valorCentavos: converterParaCentavos(item.valorInformado),
        ajustado: false, motivo: "", aportes: 0, retiradas: 0
    }]));
    const porId = new Map(investimentosCadastrados.map((item) => [item.id, item]));
    for (const movimento of registros) {
        if (!ehMovimentacaoInvestimento(movimento)) continue;
        const investimento = porId.get(movimento.investimentoId);
        if (!investimento) return valoresInvestimentosIndisponiveis("Movimentação sem investimento válido.");
        if (movimento.data <= investimento.dataReferenciaValor || movimento.data > hoje) continue;
        const posicao = valoresPorInvestimento.get(investimento.id);
        const campo = movimento.tipo === "aporte" ? "aportes" : "retiradas";
        posicao[campo] += converterParaCentavos(movimento.tipo === "aporte"
            ? movimento.valor : movimento.valorRetiradoInvestimento);
        posicao.ajustado = true;
        if (!Number.isSafeInteger(posicao[campo])) posicao.disponivel = false;
    }
    let totalValorCentavos = 0;
    let disponivel = true;
    for (const posicao of valoresPorInvestimento.values()) {
        const valor = posicao.valorCentavos + (posicao.aportes - posicao.retiradas);
        if (!posicao.disponivel || !Number.isSafeInteger(valor) || valor < 0) {
            posicao.disponivel = false;
            posicao.valorCentavos = null;
            posicao.motivo = "Estimativa inconsistente: atualize o valor manual ou revise as movimentações. Não foi aplicado ajuste automático.";
            disponivel = false;
        } else {
            posicao.valorCentavos = valor;
            totalValorCentavos += valor;
            if (!Number.isSafeInteger(totalValorCentavos)) disponivel = false;
        }
        delete posicao.aportes;
        delete posicao.retiradas;
    }
    return { disponivel, motivo: disponivel ? "" : "Valor total indisponível: há estimativa inconsistente ou limite numérico excedido.",
        valoresPorInvestimento, totalValorCentavos: disponivel ? totalValorCentavos : null };
}

export function movimentoBancarioCentavos(transacao) {
    const valor = converterParaCentavos(transacao.valor);
    switch (transacao.tipo) {
        case "receita": case "resgate": return valor;
        case "despesa": case "aporte": return -valor;
        default: return null;
    }
}

// Recebe as coleções completas. Todos os valores retornados estão em centavos.
// O parâmetro hoje permite testar datas sem depender do relógio da execução.
export function calcularSaldos(contasCadastradas, registrosTransacoes, hoje = obterDataLocal(), investimentosCadastrados = []) {
    if (!dataValida(hoje) || !validarColecao(contasCadastradas, validarConta)
        || !validarColecao(registrosTransacoes, validarTransacao)) {
        return saldosIndisponiveis("Dados ou data inválidos para calcular os saldos.");
    }
    const integridade = verificarIntegridadeTransacoes(registrosTransacoes, contasCadastradas, investimentosCadastrados);
    if (!integridade.disponivel) return saldosIndisponiveis(integridade.motivo);

    const contasPorId = new Map();
    const saldosPorContaCentavos = new Map();
    for (const conta of contasCadastradas) {
        const inicial = converterParaCentavos(conta.saldoInicial);
        if (!Number.isSafeInteger(inicial)) {
            return saldosIndisponiveis("O saldo inicial ultrapassa o limite de cálculo seguro em centavos.");
        }
        contasPorId.set(conta.id, conta);
        saldosPorContaCentavos.set(conta.id, inicial);
    }

    for (const transacao of registrosTransacoes) {
        const conta = contasPorId.get(transacao.contaId);
        if (transacao.data <= conta.dataReferencia || transacao.data > hoje) continue;
        const valor = converterParaCentavos(transacao.valor);
        const movimento = movimentoBancarioCentavos(transacao);
        const saldo = saldosPorContaCentavos.get(conta.id) + movimento;
        if (!Number.isSafeInteger(valor) || !Number.isSafeInteger(saldo)) {
            return saldosIndisponiveis("Um movimento ou saldo ultrapassa o limite de cálculo seguro em centavos.");
        }
        saldosPorContaCentavos.set(conta.id, saldo);
    }

    let saldoTotalCentavos = 0;
    let saldoDisponivelCentavos = 0;
    for (const conta of contasCadastradas) {
        const saldo = saldosPorContaCentavos.get(conta.id);
        saldoTotalCentavos += saldo;
        if (conta.incluirNoSaldoDisponivel === true) saldoDisponivelCentavos += saldo;
        if (!Number.isSafeInteger(saldoTotalCentavos) || !Number.isSafeInteger(saldoDisponivelCentavos)) {
            return saldosIndisponiveis("Os totais ultrapassam o limite de cálculo seguro em centavos.");
        }
    }
    return {
        disponivel: true,
        motivo: "",
        saldosPorContaCentavos,
        saldoTotalCentavos,
        saldoDisponivelCentavos
    };
}

export function historicoMensalIndisponivel(motivo) {
    return { disponivel: false, motivo, vazio: null, meses: null,
        primeiroMes: null, ultimoMes: null, mesFinal: null, duracao: null };
}

// A duração e o mês final selecionam a janela; a agregação financeira é compartilhada.
// Datas são comparadas como YYYY-MM-DD; não há conversão UTC nem referência de conta.
export function prepararHistoricoMensal(registros, hoje = obterDataLocal(), mesFinal = null, duracao = 6) {
    if (!dataValida(hoje) || !validarColecao(registros, validarTransacao)
        || ![3, 6, 12].includes(duracao)
        || (mesFinal !== null && !dataValida(`${mesFinal}-01`))) {
        return historicoMensalIndisponivel("Transações, data ou período inválidos para preparar o histórico.");
    }

    const totaisPorMes = new Map();
    let primeiroIndice = null;
    for (const transacao of registros) {
        if (transacao.tipo !== "receita" && transacao.tipo !== "despesa") continue;
        if (transacao.data > hoje) continue;
        const ano = Number(transacao.data.slice(0, 4));
        const mes = Number(transacao.data.slice(5, 7));
        const indice = ano * 12 + mes - 1;
        const totais = totaisPorMes.get(indice) || { receitasCentavos: 0, despesasCentavos: 0 };
        const campo = transacao.tipo === "receita" ? "receitasCentavos" : "despesasCentavos";
        const valor = converterParaCentavos(transacao.valor);
        const total = totais[campo] + valor;
        if (!Number.isSafeInteger(valor) || !Number.isSafeInteger(total)) {
            return historicoMensalIndisponivel("Um valor ou total mensal ultrapassa o limite seguro em centavos.");
        }
        totais[campo] = total;
        totaisPorMes.set(indice, totais);
        primeiroIndice = primeiroIndice === null ? indice : Math.min(primeiroIndice, indice);
    }

    if (primeiroIndice === null) {
        return { disponivel: true, motivo: "Nenhuma movimentação até a data atual.", vazio: true,
            meses: [], primeiroMes: null, ultimoMes: null, mesFinal: null, duracao };
    }

    const indiceAtual = Number(hoje.slice(0, 4)) * 12 + Number(hoje.slice(5, 7)) - 1;
    const fim = mesFinal === null ? indiceAtual
        : Number(mesFinal.slice(0, 4)) * 12 + Number(mesFinal.slice(5, 7)) - 1;
    if (fim < primeiroIndice || fim > indiceAtual) {
        return historicoMensalIndisponivel("O mês final está fora do histórico disponível.");
    }
    const inicio = fim - duracao + 1;
    const chaveMes = (indice) => `${String(Math.floor(indice / 12)).padStart(4, "0")}-${String(indice % 12 + 1).padStart(2, "0")}`;
    const meses = [];
    for (let indice = inicio; indice <= fim; indice++) {
        const totais = totaisPorMes.get(indice) || { receitasCentavos: 0, despesasCentavos: 0 };
        meses.push({ mes: chaveMes(indice), ...totais });
    }
    return { disponivel: true, motivo: "", vazio: false, meses,
        primeiroMes: chaveMes(primeiroIndice), ultimoMes: chaveMes(indiceAtual),
        mesFinal: chaveMes(fim), duracao };
}

export function distribuicaoDespesasIndisponivel(motivo) {
    return { disponivel: false, motivo, vazio: null, mesInicial: null, mesFinal: null,
        totalCentavos: null, classificacoes: null };
}

export function definirPeriodoDespesas(tipo = "atual", mesInicial = null, mesFinal = null, hoje = obterDataLocal()) {
    if (!dataValida(hoje)) return { disponivel: false, motivo: "Data local inválida." };
    if (tipo === "atual") {
        mesInicial = mesFinal = hoje.slice(0, 7);
    } else if (tipo === "anterior") {
        const ano = Number(hoje.slice(0, 4));
        const mes = Number(hoje.slice(5, 7));
        mesInicial = mesFinal = mes === 1 ? `${String(ano - 1).padStart(4, "0")}-12`
            : `${ano.toString().padStart(4, "0")}-${String(mes - 1).padStart(2, "0")}`;
    } else if (tipo !== "personalizado") {
        return { disponivel: false, motivo: "Tipo de período inválido." };
    }
    if (typeof mesInicial !== "string" || typeof mesFinal !== "string"
        || !dataValida(`${mesInicial}-01`) || !dataValida(`${mesFinal}-01`)) {
        return { disponivel: false, motivo: "Informe meses válidos no formato YYYY-MM." };
    }
    if (mesInicial > mesFinal) {
        return { disponivel: false, motivo: "O mês inicial não pode ser posterior ao mês final." };
    }
    if (mesInicial > hoje.slice(0, 7)) {
        return { disponivel: false, motivo: "O período não pode ser inteiramente futuro." };
    }
    return { disponivel: true, motivo: "", mesInicial, mesFinal };
}

// Função pura: meses inclusivos, sem referência de saldo e sem depender da interface.
export function prepararDistribuicaoDespesas(registros, mesInicial, mesFinal, hoje = obterDataLocal()) {
    const periodo = definirPeriodoDespesas("personalizado", mesInicial, mesFinal, hoje);
    if (!periodo.disponivel) return distribuicaoDespesasIndisponivel(periodo.motivo);
    if (!validarColecao(registros, validarTransacao)) {
        return distribuicaoDespesasIndisponivel("A coleção de transações contém dados inválidos.");
    }
    const totais = new Map(Object.keys(CLASSIFICACOES_DESPESAS).map((id) => [id, 0]));
    let totalCentavos = 0;
    for (const transacao of registros) {
        const mes = transacao.data.slice(0, 7);
        if (transacao.tipo !== "despesa" || mes < mesInicial || mes > mesFinal || transacao.data > hoje) continue;
        if (!totais.has(transacao.classificacao)) {
            return distribuicaoDespesasIndisponivel("Há despesas no período sem classificação ou com classificação desconhecida. Revise os registros; nenhum dado foi alterado.");
        }
        const valor = converterParaCentavos(transacao.valor);
        const subtotal = totais.get(transacao.classificacao) + valor;
        const proximoTotal = totalCentavos + valor;
        if (!Number.isSafeInteger(valor) || !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(proximoTotal)) {
            return distribuicaoDespesasIndisponivel("Um valor ou total de despesas ultrapassa o limite seguro em centavos.");
        }
        totais.set(transacao.classificacao, subtotal);
        totalCentavos = proximoTotal;
    }
    const classificacoes = Object.entries(CLASSIFICACOES_DESPESAS).map(([id, definicao]) => ({
        id, ...definicao, totalCentavos: totais.get(id),
        // Não arredondar aqui: a futura interface decide a precisão de apresentação.
        percentual: totalCentavos === 0 ? 0 : (totais.get(id) / totalCentavos) * 100
    }));
    return { disponivel: true, motivo: totalCentavos === 0 ? "Nenhuma despesa no período até a data atual." : "",
        vazio: totalCentavos === 0, mesInicial, mesFinal, totalCentavos, classificacoes };
}

export function calcularTotaisResumo(registros) {
    if (!validarColecao(registros, validarTransacao)) return { receitasCentavos: null, despesasCentavos: null };
    const totais = { receitasCentavos: 0, despesasCentavos: 0 };
    for (const transacao of registros) {
        if (transacao.tipo !== "receita" && transacao.tipo !== "despesa") continue;
        const campo = transacao.tipo === "receita" ? "receitasCentavos" : "despesasCentavos";
        if (totais[campo] === null) continue;
        const valor = converterParaCentavos(transacao.valor);
        const total = totais[campo] + valor;
        totais[campo] = Number.isSafeInteger(valor) && Number.isSafeInteger(total) ? total : null;
    }
    return totais;
}
