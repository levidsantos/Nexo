import { dataValida, obterDataLocal, converterParaCentavos } from "./valores-datas.js";

// Chaves idênticas aos valores persistidos pelo formulário; cores independem da ordem dos dados.
export const CLASSIFICACOES_DESPESAS = Object.freeze({
    Essencial: Object.freeze({ nome: "Necessidades", cor: "#289568" }),
    Desnecessario: Object.freeze({ nome: "Desnecessários", cor: "#DC5252" }),
    Imprevisto: Object.freeze({ nome: "Imprevistos", cor: "#E4B044" }),
    Investimento: Object.freeze({ nome: "Investimentos", cor: "#E58A45" }),
    Desejo: Object.freeze({ nome: "Desejos", cor: "#9164CB" })
});

export function textoPreenchido(valor) {
    return typeof valor === "string" && valor.trim() !== "";
}

export function textoOpcional(valor) {
    return valor == null || typeof valor === "string";
}

export function ehMovimentacaoInvestimento(registro) {
    return registro.tipo === "aporte" || registro.tipo === "resgate";
}

export function validarVinculosTransacoes(registros, contasCadastradas, investimentosCadastrados = []) {
    const idsContas = new Set(contasCadastradas.map((conta) => conta.id));
    const idsInvestimentos = new Set(investimentosCadastrados.map((item) => item.id));
    return registros.every((transacao) => idsContas.has(transacao.contaId)
        && (!ehMovimentacaoInvestimento(transacao) || idsInvestimentos.has(transacao.investimentoId)));
}

export function validarTransacao(registro) {
    const baseValida = registro !== null && typeof registro === "object" && !Array.isArray(registro)
        && textoPreenchido(registro.id)
        && ["receita", "despesa", "aporte", "resgate"].includes(registro.tipo)
        && textoPreenchido(registro.nome)
        // Os vínculos são verificados depois de carregar todas as coleções.
        && textoPreenchido(registro.contaId)
        && Number.isFinite(registro.valor) && valorMonetarioValido(registro.valor) && registro.valor > 0
        && dataValida(registro.data);
    if (!baseValida) return false;
    if (!ehMovimentacaoInvestimento(registro)) {
        // Na leitura e nos cálculos, preserva despesas antigas sem classificação.
        // Novas despesas e alterações têm validação adicional na gravação.
        return textoPreenchido(registro.categoria) && textoOpcional(registro.pagamento)
            && textoOpcional(registro.classificacao);
    }
    return textoPreenchido(registro.investimentoId) && valorInvestimentoValido(registro.valor)
        && textoOpcional(registro.observacoes)
        && (registro.observacoes == null || registro.observacoes.length <= 500)
        && (registro.tipo !== "resgate" || (
            valorInvestimentoValido(registro.capitalRetirado) && registro.capitalRetirado > 0
            && valorInvestimentoValido(registro.valorRetiradoInvestimento) && registro.valorRetiradoInvestimento > 0));
}

export function validarConta(registro) {
    return registro !== null && typeof registro === "object" && !Array.isArray(registro)
        && textoPreenchido(registro.id)
        && textoPreenchido(registro.nome)
        && ["corrente", "poupanca", "reserva", "carteira"].includes(registro.tipo)
        && Number.isFinite(registro.saldoInicial) && valorMonetarioValido(registro.saldoInicial)
        && dataValida(registro.dataReferencia)
        && registro.dataReferencia <= obterDataLocal()
        && typeof registro.incluirNoSaldoDisponivel === "boolean"
        && textoOpcional(registro.instituicao);
}

export function validarColecao(registros, validarRegistro) {
    if (!Array.isArray(registros)) return false;
    const ids = new Set();
    for (const registro of registros) {
        if (!validarRegistro(registro) || ids.has(registro.id)) return false;
        ids.add(registro.id);
    }
    return true;
}

export function valorInvestimentoValido(valor) {
    return Number.isFinite(valor) && valorMonetarioValido(valor);
}

export function valorMonetarioValido(valor) {
    return Number.isSafeInteger(converterParaCentavos(valor));
}

export function validarInvestimento(registro) {
    if (registro === null || typeof registro !== "object" || Array.isArray(registro)) return false;
    const hoje = obterDataLocal();
    const instante = typeof registro.atualizadoEm === "string" ? new Date(registro.atualizadoEm) : null;
    return typeof registro.id === "string"
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(registro.id)
        && textoPreenchido(registro.nome) && textoPreenchido(registro.tipo)
        && textoOpcional(registro.instituicao)
        && valorInvestimentoValido(registro.capitalInicial) && valorInvestimentoValido(registro.valorInformado)
        && dataValida(registro.dataReferenciaCapital) && registro.dataReferenciaCapital <= hoje
        && dataValida(registro.dataReferenciaValor) && registro.dataReferenciaValor <= hoje
        && instante !== null && Number.isFinite(instante.getTime())
        && instante.toISOString() === registro.atualizadoEm
        && textoOpcional(registro.observacoes)
        && (registro.observacoes == null || registro.observacoes.length <= 500);
}

export function classificacaoDespesaValida(classificacao) {
    return typeof classificacao === "string" && Object.hasOwn(CLASSIFICACOES_DESPESAS, classificacao);
}
