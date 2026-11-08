import { formatarCentavos } from "../dominio/valores-datas.js";

// Somente apresentação: os dados e resultados são preparados pelo ponto de entrada.
export function criarResumo({ valorRecebido, valorDespesas, valorSaldo, listaContas, abrirCadastroConta }) {
    function renderizarIndicadores({ receitasCentavos, despesasCentavos }) {
        valorRecebido.textContent = formatarCentavos(receitasCentavos);
        valorDespesas.textContent = formatarCentavos(despesasCentavos);
    }

    function renderizarSaldo(saldos) {
        valorSaldo.textContent = saldos.disponivel
            ? formatarCentavos(saldos.saldoDisponivelCentavos) : "Indisponível";
    }

    function renderizarContas({ contas, saldos }) {
        const document = listaContas.ownerDocument;
        listaContas.replaceChildren();
        if (!saldos.disponivel || contas.length === 0) {
            const mensagem = document.createElement("p");
            mensagem.classList.add("mensagem-vazia");
            mensagem.textContent = !saldos.disponivel
                ? `Dados de saldo indisponíveis. ${saldos.motivo}`
                : "Cadastre sua primeira conta para acompanhar seus saldos.";
            listaContas.appendChild(mensagem);
            if (saldos.disponivel) {
                const cadastrar = document.createElement("button");
                cadastrar.type = "button";
                cadastrar.classList.add("btn-primario");
                cadastrar.textContent = "Cadastrar primeira conta";
                cadastrar.addEventListener("click", () => abrirCadastroConta());
                listaContas.appendChild(cadastrar);
            }
            return;
        }
        const itens = document.createElement("ul");
        itens.classList.add("lista-contas-resumo");
        contas.slice(0, 3).forEach((conta) => {
            const item = document.createElement("li");
            const nome = document.createElement("span");
            nome.textContent = conta.nome;
            const saldo = document.createElement("strong");
            saldo.textContent = formatarCentavos(saldos.saldosPorContaCentavos.get(conta.id));
            item.append(nome, saldo);
            itens.appendChild(item);
        });
        listaContas.appendChild(itens);
    }

    return { renderizarIndicadores, renderizarSaldo, renderizarContas };
}
