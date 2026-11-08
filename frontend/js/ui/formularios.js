// Helpers de apresentação: recebem campos/formulários e não registram eventos.
export function mostrarErro(campo, mensagem) {
    const erro = campo.ownerDocument.getElementById(`erro-${campo.id}`);

    erro.textContent = mensagem;
    campo.classList.add("invalido");
    campo.setAttribute("aria-invalid", "true");
}

export function limparErros(formulario) {
    formulario.querySelectorAll(".erro-campo").forEach((erro) => {
        erro.textContent = "";
    });

    formulario.querySelectorAll(".invalido").forEach((campo) => {
        campo.classList.remove("invalido");
        campo.removeAttribute("aria-invalid");
    });
}

export function limparErroCampo(campo) {
    const erro = campo.ownerDocument.getElementById(`erro-${campo.id}`);

    erro.textContent = "";
    campo.classList.remove("invalido");
    campo.removeAttribute("aria-invalid");
}

export function focarPrimeiroErro(formulario) {
    formulario.querySelector(".invalido").focus();
}

// Uma confirmação pendente por controlador. Não registra eventos nem acessa o DOM no import.
export function criarConfirmacaoFinanceira(mostrarToast) {
    let pendente = false;
    return {
        estaPendente: () => pendente,
        async confirmar(acao, registros, botao) {
            if (pendente) return false;
            pendente = true;
            const desabilitado = botao.disabled;
            botao.disabled = true;
            try {
                return await acao(registros);
            } catch (erro) {
                mostrarToast("Ocorreu um erro inesperado ao confirmar a operação. Confira os dados antes de tentar novamente. Os campos preenchidos foram mantidos.", "erro");
                return false;
            } finally {
                pendente = false;
                botao.disabled = desabilitado;
            }
        }
    };
}
