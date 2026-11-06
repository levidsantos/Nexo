import { lerDados, gravarDados } from "./repositorio.js";
import { validarConta, validarColecao, validarTransacao, classificacaoDespesaValida,
    ehMovimentacaoInvestimento } from "../dominio/validacoes.js";
import { verificarIntegridadeTransacoes } from "../dominio/calculos.js";

// Copia uma vez por versão, preservando também campos adicionais de registros
// antigos. Consultas compartilham a versão congelada, sem clonagem por cálculo.
function prepararColecao(registros) {
    const copia = structuredClone(registros);
    const congelar = (valor) => {
        if (valor && typeof valor === "object" && !Object.isFrozen(valor)) {
            Object.freeze(valor);
            Object.values(valor).forEach(congelar);
        }
    };
    congelar(copia);
    return copia;
}

// Investimentos e decisões de exclusão permanecem no consumidor.
export function criarEstadoDisponibilidade({ ler = lerDados, gravar = gravarDados } = {}) {
    const colecoesBloqueadas = new Set();
    let contas = Object.freeze([]);
    let contasInicializadas = false;
    let resultadoInicializacao = null;
    let transacoes = Object.freeze([]);
    let transacoesInicializadas = false;
    let resultadoInicializacaoTransacoes = null;
    let vinculosTransacoesVerificados = false;
    let compatibilidadePreparada = false;
    const despesasLegadasSemClassificacao = new Map();

    function validarTransacaoParaGravacao(registro) {
        if (!validarTransacao(registro)) return false;
        return registro.tipo !== "despesa" || classificacaoDespesaValida(registro.classificacao)
            // A coleção inteira é gravada: apenas legados integralmente inalterados são preservados.
            || despesasLegadasSemClassificacao.get(registro.id) === JSON.stringify(registro);
    }

    return {
        colecaoEstaBloqueada(chave) {
            return colecoesBloqueadas.has(chave);
        },
        bloquearColecao(chave) {
            colecoesBloqueadas.add(chave);
        },
        consultarContas() {
            return contas;
        },
        contasEstaoDisponiveis() {
            return contasInicializadas && !colecoesBloqueadas.has("contas");
        },
        inicializarContas() {
            if (contasInicializadas) return { ...resultadoInicializacao };
            contasInicializadas = true;
            try {
                const leitura = ler("contas");
                if (!leitura.sucesso) throw leitura.erro;
                const registros = leitura.ausente ? [] : leitura.dados;
                if (!validarColecao(registros, validarConta)) {
                    throw new Error("A coleção não é um array válido ou há registros inválidos/IDs repetidos.");
                }
                contas = prepararColecao(registros);
                resultadoInicializacao = { sucesso: true };
            } catch (erro) {
                colecoesBloqueadas.add("contas");
                resultadoInicializacao = { sucesso: false, erro };
            }
            return { ...resultadoInicializacao };
        },
        confirmarContas(candidatas) {
            if (colecoesBloqueadas.has("contas")) return { sucesso: false, motivo: "bloqueada" };
            if (!contasInicializadas) return { sucesso: false, motivo: "nao-inicializada" };
            if (!validarColecao(candidatas, validarConta)) return { sucesso: false, motivo: "invalida" };
            try {
                // Preparar antes de gravar evita trabalho sujeito a falha entre
                // a confirmação do armazenamento e a substituição em memória.
                const proximasContas = prepararColecao(candidatas);
                const gravacao = gravar("contas", proximasContas);
                if (!gravacao.sucesso) return { sucesso: false, motivo: "gravacao", erro: gravacao.erro };
                contas = proximasContas;
                return { sucesso: true };
            } catch (erro) {
                return { sucesso: false, motivo: "gravacao", erro };
            }
        },
        consultarTransacoes() {
            return transacoes;
        },
        transacoesEstaoDisponiveis() {
            return transacoesInicializadas && !colecoesBloqueadas.has("transacoes");
        },
        inicializarTransacoes() {
            if (transacoesInicializadas) return { ...resultadoInicializacaoTransacoes };
            transacoesInicializadas = true;
            try {
                const leitura = ler("transacoes");
                if (!leitura.sucesso) throw leitura.erro;
                const registros = leitura.ausente ? [] : leitura.dados;
                if (!validarColecao(registros, validarTransacao)) {
                    throw new Error("A coleção não é um array válido ou há registros inválidos/IDs repetidos.");
                }
                transacoes = prepararColecao(registros);
                resultadoInicializacaoTransacoes = { sucesso: true };
            } catch (erro) {
                colecoesBloqueadas.add("transacoes");
                resultadoInicializacaoTransacoes = { sucesso: false, erro };
            }
            return { ...resultadoInicializacaoTransacoes };
        },
        verificarTransacoesCarregadas(investimentosCadastrados) {
            if (colecoesBloqueadas.has("transacoes")) return { disponivel: false, motivo: "" };
            if (!transacoesInicializadas || !contasInicializadas) {
                return { disponivel: false, motivo: "As coleções ainda não foram inicializadas." };
            }
            const integridade = verificarIntegridadeTransacoes(transacoes, contas, investimentosCadastrados);
            vinculosTransacoesVerificados = true;
            if (colecoesBloqueadas.has("contas") || !integridade.disponivel) {
                colecoesBloqueadas.add("transacoes");
                // Fallback de apresentação; o conteúdo armazenado permanece intacto.
                transacoes = Object.freeze([]);
                return { disponivel: false, motivo: integridade.motivo };
            }
            return integridade;
        },
        prepararCompatibilidadeTransacoes() {
            if (compatibilidadePreparada) return { sucesso: true };
            if (!transacoesInicializadas || (!vinculosTransacoesVerificados && !colecoesBloqueadas.has("transacoes"))) {
                return { sucesso: false, motivo: "nao-inicializada" };
            }
            // Retratos dos registros carregados: não são flags nem migrações no localStorage.
            transacoes.filter((registro) => registro.tipo === "despesa" && !classificacaoDespesaValida(registro.classificacao))
                .forEach((registro) => despesasLegadasSemClassificacao.set(registro.id, JSON.stringify(registro)));
            compatibilidadePreparada = true;
            return { sucesso: true };
        },
        validarTransacaoParaGravacao,
        confirmarTransacoes(candidatas, investimentosCadastrados) {
            if (colecoesBloqueadas.has("transacoes")) return { sucesso: false, motivo: "bloqueada" };
            if (!transacoesInicializadas || !compatibilidadePreparada) return { sucesso: false, motivo: "nao-inicializada" };
            if (!validarColecao(candidatas, validarTransacaoParaGravacao)) return { sucesso: false, motivo: "invalida" };
            const dependenciasBloqueadas = colecoesBloqueadas.has("contas")
                || candidatas.some(ehMovimentacaoInvestimento) && colecoesBloqueadas.has("investimentos");
            if (dependenciasBloqueadas) return { sucesso: false, motivo: "dependencias" };
            const integridade = verificarIntegridadeTransacoes(candidatas, contas, investimentosCadastrados);
            if (!integridade.disponivel) return { sucesso: false, motivo: "integridade", detalhe: integridade.motivo };
            try {
                const legadosMantidos = new Set(candidatas
                    .filter((registro) => despesasLegadasSemClassificacao.get(registro.id) === JSON.stringify(registro))
                    .map((registro) => registro.id));
                const proximasTransacoes = prepararColecao(candidatas);
                const gravacao = gravar("transacoes", proximasTransacoes);
                if (!gravacao.sucesso) return { sucesso: false, motivo: "gravacao", erro: gravacao.erro };
                transacoes = proximasTransacoes;
                for (const id of despesasLegadasSemClassificacao.keys()) {
                    if (!legadosMantidos.has(id)) despesasLegadasSemClassificacao.delete(id);
                }
                return { sucesso: true };
            } catch (erro) {
                return { sucesso: false, motivo: "gravacao", erro };
            }
        }
    };
}
