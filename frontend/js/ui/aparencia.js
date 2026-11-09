// Preferência exclusivamente visual. O head já aplicou a preferência antes do CSS.
export function criarAparencia({ document, larguraMobile, aoAlterarTema, gravarPreferencia = (tema) => globalThis.localStorage.setItem("nexo-tema", tema) }) {
    let inicializado = false;
    const removerListeners = [];
    const raiz = document.documentElement;
    const opcoes = [...document.querySelectorAll("[data-opcao-tema]")];
    const botao = document.getElementById("abrir-configuracoes");
    const painel = document.getElementById("painel-configuracoes");
    const configuracoes = botao.parentElement;
    function escutar(alvo, tipo, callback) {
        alvo.addEventListener(tipo, callback);
        removerListeners.push(() => alvo.removeEventListener(tipo, callback));
    }
    function sincronizar() {
        const tema = raiz.dataset.tema === "escuro" ? "escuro" : "claro";
        raiz.dataset.tema = tema;
        opcoes.forEach((opcao) => { opcao.checked = opcao.value === tema; });
    }
    function fecharConfiguracoes(restaurarFoco = false) {
        const estavaAberto = !painel.hidden;
        painel.hidden = true;
        botao.setAttribute("aria-expanded", "false");
        if (estavaAberto && restaurarFoco) botao.focus({ preventScroll: true });
    }
    function alterarTema(evento) {
        const tema = evento.target.value;
        if (!evento.target.checked || !["claro", "escuro"].includes(tema) || raiz.dataset.tema === tema) return;
        raiz.dataset.tema = tema;
        sincronizar();
        try { gravarPreferencia(tema); } catch { /* A escolha continua válida nesta sessão. */ }
        aoAlterarTema();
    }
    function inicializar() {
        if (inicializado) return;
        inicializado = true;
        sincronizar();
        opcoes.forEach((opcao) => escutar(opcao, "change", alterarTema));
        escutar(botao, "click", () => {
            if (!larguraMobile.matches) return;
            painel.hidden = !painel.hidden;
            botao.setAttribute("aria-expanded", String(!painel.hidden));
        });
        escutar(document, "click", (evento) => {
            if (!configuracoes.contains(evento.target)) fecharConfiguracoes();
        });
        escutar(document, "keydown", (evento) => {
            if (evento.key === "Escape" && !painel.hidden) {
                evento.preventDefault();
                fecharConfiguracoes(true);
            }
        });
        escutar(larguraMobile, "change", () => {
            const focoNasConfiguracoes = configuracoes.contains(document.activeElement);
            fecharConfiguracoes();
            if (focoNasConfiguracoes && !larguraMobile.matches) opcoes.find((opcao) => opcao.name === "tema-desktop" && opcao.checked)?.focus({ preventScroll: true });
        });
        raiz.classList.add("aparencia-pronta");
    }
    function encerrar() {
        fecharConfiguracoes();
        for (const remover of removerListeners.splice(0)) remover();
        raiz.classList.remove("aparencia-pronta");
        inicializado = false;
    }
    return { inicializar, fecharConfiguracoes, encerrar };
}
