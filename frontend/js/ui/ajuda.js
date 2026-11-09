// Conteúdo editorial estático no HTML; este controlador cuida apenas dos acessos e categorias.
export function criarAjuda({ document, modais, larguraMobile, fecharConfiguracoes }) {
    const modal = document.getElementById("modal-ajuda");
    const fechar = document.getElementById("fechar-ajuda");
    const desktop = document.getElementById("abrir-ajuda-desktop");
    const mobile = document.getElementById("abrir-ajuda-mobile");
    const engrenagem = document.getElementById("abrir-configuracoes");
    const seletor = document.getElementById("categoria-ajuda");
    const conteudo = modal.querySelector(".conteudo-ajuda");
    const botoes = [...modal.querySelectorAll("[data-categoria-ajuda]")];
    const categorias = [...modal.querySelectorAll(".ajuda-categoria")];
    let inicializado = false;
    const removerListeners = [];
    const acionadorDisponivel = () => larguraMobile.matches ? engrenagem : desktop;
    function escutar(alvo, tipo, callback) {
        alvo.addEventListener(tipo, callback);
        removerListeners.push(() => alvo.removeEventListener(tipo, callback));
    }
    function selecionarCategoria(chave) {
        if (!categorias.some((categoria) => categoria.id === `ajuda-${chave}`)) return;
        categorias.forEach((categoria) => { categoria.hidden = categoria.id !== `ajuda-${chave}`; });
        botoes.forEach((botao) => botao.setAttribute("aria-pressed", String(botao.dataset.categoriaAjuda === chave)));
        seletor.value = chave;
        conteudo.scrollTop = 0;
    }
    function abrirAjuda() {
        const ativo = modais.obterModalAtivo();
        if (ativo && ativo !== modal) return;
        fecharConfiguracoes();
        modais.abrirModal(modal, fechar);
        modais.definirFocoRetorno(acionadorDisponivel());
    }
    function fecharAjuda() {
        if (modais.obterModalAtivo() !== modal) return;
        modais.definirFocoRetorno(acionadorDisponivel());
        modais.fecharModal(modal);
    }
    function inicializar() {
        if (inicializado) return;
        inicializado = true;
        selecionarCategoria(seletor.value);
        escutar(desktop, "click", abrirAjuda);
        escutar(mobile, "click", abrirAjuda);
        escutar(fechar, "click", fecharAjuda);
        escutar(modal, "click", (evento) => { if (evento.target === modal) fecharAjuda(); });
        botoes.forEach((botao) => escutar(botao, "click", () => selecionarCategoria(botao.dataset.categoriaAjuda)));
        escutar(seletor, "change", () => selecionarCategoria(seletor.value));
        escutar(larguraMobile, "change", () => {
            if (modais.obterModalAtivo() === modal) modais.definirFocoRetorno(acionadorDisponivel());
        });
    }
    function encerrar() {
        fecharAjuda();
        for (const remover of removerListeners.splice(0)) remover();
        inicializado = false;
    }
    return { inicializar, abrirAjuda, fecharAjuda, encerrar };
}
