// Um controlador por documento mantém um único ciclo de foco e listeners.
const controladores = new WeakMap();

export function criarModais({
    document, movimentoReduzido, podeReceberFoco, obterFocoAlternativo,
    prepararNotificacoes, posicionarNotificacoesModal, concluirNotificacoes,
    aoEscape = () => {}, focarRetorno = (destino) => destino.focus()
}) {
    const existente = controladores.get(document);
    if (existente) return existente;
    let modalAtivo = null;
    let focoAnteriorModal = null;
    let elementosInertes = [];
    let transicaoModal = null;
    let limpezaModal = null;
    let encerrado = false;
    const movimentoReduzidoModais = movimentoReduzido;

    function abrirModal(modal, focoInicial) {
        if (encerrado) return;
        const focoRetorno = focoAnteriorModal;
        if (modalAtivo && modalAtivo !== modal) concluirFechamentoModal(modalAtivo, false);
        const reabrindo = modalAtivo === modal;
        cancelarTransicaoModal();
        limpezaModal = null;
        if (!reabrindo) {
            focoAnteriorModal = document.activeElement;
            if (focoRetorno) focoAnteriorModal = focoRetorno;
            modalAtivo = modal;
            modal.classList.remove("hidden");
            prepararNotificacoes(modal);

            // Inativa apenas irmãos no caminho até o body, nunca um ancestral do modal.
            let elemento = modal;
            while (elemento !== document.body) {
                for (const irmao of elemento.parentElement.children) {
                    if (irmao !== elemento) {
                        elementosInertes.push({ elemento: irmao, inert: irmao.inert });
                        irmao.inert = true;
                    }
                }
                elemento = elemento.parentElement;
            }
        }
        modal.classList.remove("modal-saindo", "modal-entrando");
        modal.classList.add("modal-abrindo");
        if (!movimentoReduzidoModais.matches) {
            // Fora do painel transformado, os toasts continuam fixos na viewport.
            posicionarNotificacoesModal(modal, false);
            if (!reabrindo) {
                modal.classList.add("modal-entrando");
                void modal.offsetWidth;
                modal.classList.remove("modal-entrando");
            }
            aguardarTransicaoModal(modal, 200, () => {
                modal.classList.remove("modal-abrindo");
                posicionarNotificacoesModal(modal, true);
            });
        } else {
            modal.classList.remove("modal-abrindo");
            posicionarNotificacoesModal(modal, true);
        }
        focoInicial.focus();
    }

    function cancelarTransicaoModal() {
        if (transicaoModal) transicaoModal();
        transicaoModal = null;
    }

    function aguardarTransicaoModal(modal, duracao, concluir) {
        let cancelada = false;
        const finalizar = () => {
            if (cancelada) return;
            cancelarTransicaoModal();
            concluir();
        };
        const aoTerminar = (evento) => {
            if (evento.target === modal && evento.propertyName === "opacity") finalizar();
        };
        // Fallback para abas suspensas ou ausência de transitionend.
        const temporizador = setTimeout(finalizar, duracao + 50);
        modal.addEventListener("transitionend", aoTerminar);
        transicaoModal = () => {
            cancelada = true;
            clearTimeout(temporizador);
            modal.removeEventListener("transitionend", aoTerminar);
        };
    }

    function fecharModal(modal, aoFechar = null) {
        if (modal !== modalAtivo || modal.classList.contains("modal-saindo")) return;
        cancelarTransicaoModal();
        limpezaModal = aoFechar;
        if (movimentoReduzidoModais.matches) {
            concluirFechamentoModal(modal);
            return;
        }
        posicionarNotificacoesModal(modal, false);
        modal.classList.add("modal-saindo");
        aguardarTransicaoModal(modal, 150, () => concluirFechamentoModal(modal));
    }

    function concluirFechamentoModal(modal, restaurarFoco = true) {
        cancelarTransicaoModal();
        modal.classList.add("hidden");
        modal.classList.remove("modal-abrindo", "modal-entrando", "modal-saindo");
        const limpar = limpezaModal;
        limpezaModal = null;
        if (limpar) limpar();
        for (const estado of elementosInertes) {
            estado.elemento.inert = estado.inert;
        }
        elementosInertes = [];
        modalAtivo = null;
        concluirNotificacoes();

        const destino = podeReceberFoco(focoAnteriorModal) ? focoAnteriorModal : obterFocoAlternativo();
        if (restaurarFoco) focarRetorno(destino);
        focoAnteriorModal = null;
    }

    // Captura mantém o diálogo modal durante a saída, sem executar ações repetidas.
    const bloquearDuranteSaida = (evento) => {
        if (!modalAtivo?.classList.contains("modal-saindo")
            || (evento.type === "keydown" && evento.key === "Tab")) return;
        evento.preventDefault();
        evento.stopImmediatePropagation();
    };
    const tratarTeclado = (event) => {
        if (event.key === "Escape") aoEscape(modalAtivo);
        if (event.key === "Tab" && modalAtivo) {
            const campos = [...modalAtivo.querySelectorAll(
                'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
            )].filter(podeReceberFoco);
            const primeiro = campos[0];
            const ultimo = campos[campos.length - 1];
            if (!primeiro) {
                event.preventDefault();
                modalAtivo.querySelector('[role="dialog"]').focus();
            } else if (!campos.includes(document.activeElement)
                || (event.shiftKey && document.activeElement === primeiro)
                || (!event.shiftKey && document.activeElement === ultimo)) {
                event.preventDefault();
                (event.shiftKey ? ultimo : primeiro).focus();
            }
        }
    };
    const aoMudarMovimento = () => {
        if (!movimentoReduzidoModais.matches || !modalAtivo) return;
        if (modalAtivo.classList.contains("modal-saindo")) concluirFechamentoModal(modalAtivo);
        else {
            cancelarTransicaoModal();
            modalAtivo.classList.remove("modal-abrindo", "modal-entrando");
            posicionarNotificacoesModal(modalAtivo, true);
        }
    };
    for (const tipo of ["click", "submit", "keydown"]) document.addEventListener(tipo, bloquearDuranteSaida, true);
    document.addEventListener("keydown", tratarTeclado);
    movimentoReduzidoModais.addEventListener("change", aoMudarMovimento);

    function encerrar() {
        if (encerrado) return;
        encerrado = true;
        try {
            if (modalAtivo) concluirFechamentoModal(modalAtivo);
            else cancelarTransicaoModal();
        } finally {
            for (const tipo of ["click", "submit", "keydown"]) document.removeEventListener(tipo, bloquearDuranteSaida, true);
            document.removeEventListener("keydown", tratarTeclado);
            movimentoReduzidoModais.removeEventListener("change", aoMudarMovimento);
            controladores.delete(document);
        }
    }

    const controlador = {
        abrirModal, fecharModal,
        obterModalAtivo: () => modalAtivo,
        definirFocoRetorno: (elemento) => { if (!encerrado) focoAnteriorModal = elemento; },
        encerrar
    };
    controladores.set(document, controlador);
    return controlador;
}
