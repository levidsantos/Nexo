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
