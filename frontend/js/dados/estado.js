import { lerDados, gravarDados } from "./repositorio.js";
import { validarConta, validarColecao } from "../dominio/validacoes.js";

// Copia uma vez por versão, preservando também campos adicionais de registros
// antigos. Consultas compartilham a versão congelada, sem clonagem por cálculo.
function prepararContas(registros) {
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

// Transações, investimentos e decisões de exclusão permanecem no consumidor.
export function criarEstadoDisponibilidade({ ler = lerDados, gravar = gravarDados } = {}) {
    const colecoesBloqueadas = new Set();
    let contas = Object.freeze([]);
    let contasInicializadas = false;
    let resultadoInicializacao = null;

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
                contas = prepararContas(registros);
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
                const proximasContas = prepararContas(candidatas);
                const gravacao = gravar("contas", proximasContas);
                if (!gravacao.sucesso) return { sucesso: false, motivo: "gravacao", erro: gravacao.erro };
                contas = proximasContas;
                return { sucesso: true };
            } catch (erro) {
                return { sucesso: false, motivo: "gravacao", erro };
            }
        }
    };
}
