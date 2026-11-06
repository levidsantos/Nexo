// Uma instância por contêiner evita repetir listeners em inicializações consecutivas.
const controladores = new WeakMap();

export function criarNotificacoes({
    areaNotificacoes, listaNotificacoes, anuncioNotificacoes, movimentoReduzido,
    podeReceberFoco, obterFocoAlternativo, antesDeExibir = () => {},
    agendarQuadro = (acao) => requestAnimationFrame(acao),
    cancelarQuadro = (quadro) => cancelAnimationFrame(quadro)
}) {
    const existente = controladores.get(areaNotificacoes);
    if (existente) return existente;
    const document = areaNotificacoes.ownerDocument;
    const movimentoReduzidoToasts = movimentoReduzido;
    const notificacoesAtivas = [];
    const filaNotificacoes = [];
    let mensagensParaAnunciar = [];
    let anuncioPendente = null;
    const transicoesToasts = new Map();
    let encerrado = false;
    const aoMudarMovimento = () => {
        if (movimentoReduzidoToasts.matches) {
            for (const transicao of [...transicoesToasts.values()]) transicao.concluir();
        }
    };
    movimentoReduzidoToasts.addEventListener("change", aoMudarMovimento);

    function mostrarToast(mensagem, tipo = "informacao") {
        if (encerrado) return;
        if (!["sucesso", "erro", "informacao"].includes(tipo)) tipo = "informacao";
        const repetida = [...notificacoesAtivas, ...filaNotificacoes].some((notificacao) => {
            return notificacao.mensagem === mensagem && notificacao.tipo === tipo;
        });
        if (repetida) return;

        filaNotificacoes.push({ mensagem, tipo });
        if (notificacoesAtivas.length === 3) {
            const temporaria = notificacoesAtivas.find((notificacao) => {
                return notificacao.tipo !== "erro"
                    && !notificacao.saindo
                    && !notificacao.elemento.contains(document.activeElement);
            });
            if (temporaria) {
                fecharToast(temporaria);
                return;
            }
        }
        exibirProximosToasts();
    }

    function exibirProximosToasts() {
        antesDeExibir();
        const titulos = { sucesso: "Sucesso", erro: "Erro", informacao: "Informação" };
        while (notificacoesAtivas.length < 3 && filaNotificacoes.length > 0) {
            const notificacao = filaNotificacoes.shift();
            const elemento = document.createElement("div");
            elemento.classList.add("notificacao", `notificacao-${notificacao.tipo}`);
            elemento.setAttribute("role", "group");
            elemento.setAttribute("aria-label", titulos[notificacao.tipo]);
            const texto = document.createElement("div");
            texto.classList.add("notificacao-texto");
            const titulo = document.createElement("strong");
            titulo.classList.add("notificacao-titulo");
            titulo.textContent = titulos[notificacao.tipo];
            const mensagem = document.createElement("p");
            mensagem.classList.add("notificacao-mensagem");
            mensagem.textContent = notificacao.mensagem;
            const fechar = document.createElement("button");
            fechar.type = "button";
            fechar.classList.add("fechar-notificacao");
            fechar.setAttribute("aria-label", `Fechar notificação: ${titulos[notificacao.tipo]}`);
            fechar.textContent = "×";
            const removerListeners = [];
            const ouvir = (alvo, tipo, acao) => {
                alvo.addEventListener(tipo, acao);
                removerListeners.push(() => alvo.removeEventListener(tipo, acao));
            };
            notificacao.removerListeners = () => removerListeners.forEach((remover) => remover());
            ouvir(fechar, "click", () => fecharToast(notificacao));
            texto.append(titulo, mensagem);
            elemento.append(texto, fechar);
            listaNotificacoes.appendChild(elemento);
            notificacao.elemento = elemento;
            notificacao.restante = 4000;
            notificacao.temporizador = null;
            notificacoesAtivas.push(notificacao);
            animarToast(notificacao);

            ouvir(elemento, "mouseenter", () => pausarToast(notificacao));
            ouvir(elemento, "mouseleave", () => retomarToast(notificacao));
            ouvir(elemento, "focusin", (evento) => {
                if (!elemento.contains(evento.relatedTarget)) notificacao.focoAnterior = evento.relatedTarget;
                pausarToast(notificacao);
            });
            ouvir(elemento, "focusout", (evento) => {
                if (!elemento.contains(evento.relatedTarget)) retomarToast(notificacao);
            });
            retomarToast(notificacao);
            mensagensParaAnunciar.push(`${titulos[notificacao.tipo]}: ${notificacao.mensagem}`);
        }
        // Agrupa anúncios que surgem juntos, como falhas nas duas coleções ao iniciar.
        if (mensagensParaAnunciar.length > 0 && anuncioPendente === null) {
            anuncioNotificacoes.textContent = "";
            anuncioPendente = setTimeout(() => {
                anuncioNotificacoes.textContent = mensagensParaAnunciar.join(" ");
                mensagensParaAnunciar = [];
                anuncioPendente = null;
            }, 100);
        }
    }

    function pausarToast(notificacao) {
        if (notificacao.temporizador === null) return;
        clearTimeout(notificacao.temporizador);
        notificacao.temporizador = null;
        notificacao.restante = Math.max(0, notificacao.restante - (Date.now() - notificacao.inicio));
    }

    function retomarToast(notificacao) {
        if (notificacao.saindo || !notificacao.elemento.isConnected || notificacao.tipo === "erro" || notificacao.temporizador !== null
            || notificacao.elemento.matches(":hover")
            || notificacao.elemento.contains(document.activeElement)) return;
        notificacao.inicio = Date.now();
        notificacao.temporizador = setTimeout(() => fecharToast(notificacao), notificacao.restante);
    }

    function fecharToast(notificacao) {
        const indice = notificacoesAtivas.indexOf(notificacao);
        if (indice === -1 || notificacao.saindo) return;
        notificacao.saindo = true;
        const tinhaFoco = notificacao.elemento.contains(document.activeElement);
        clearTimeout(notificacao.temporizador);
        notificacao.temporizador = null;
        if (tinhaFoco) {
            const restantes = notificacoesAtivas.filter((item) => !item.saindo);
            const proxima = restantes[Math.min(indice, restantes.length - 1)];
            if (proxima) {
                proxima.elemento.querySelector("button").focus();
            } else if (podeReceberFoco(notificacao.focoAnterior)) {
                notificacao.focoAnterior.focus();
            } else {
                obterFocoAlternativo().focus();
            }
        }
        notificacao.elemento.inert = true;
        animarToast(notificacao, true, () => {
            // Resolve o índice atual: outras notificações podem ter saído antes desta.
            const atual = notificacoesAtivas.indexOf(notificacao);
            if (atual !== -1) notificacoesAtivas.splice(atual, 1);
            notificacao.removerListeners();
            notificacao.elemento.remove();
            exibirProximosToasts();
        });
    }

    function animarToast(notificacao, saindo = false, aoTerminar = () => {}) {
        const elemento = notificacao.elemento;
        let quadroEntrada = null;
        transicoesToasts.get(notificacao)?.cancelar();
        transicoesToasts.delete(notificacao);
        const concluir = () => {
            transicoesToasts.get(notificacao)?.cancelar();
            transicoesToasts.delete(notificacao);
            elemento.classList.remove("notificacao-animando", "notificacao-entrando", "notificacao-saindo");
            aoTerminar();
        };
        if (movimentoReduzidoToasts.matches) {
            concluir();
            return;
        }
        elemento.classList.add("notificacao-animando");
        if (saindo) {
            elemento.classList.remove("notificacao-entrando");
            elemento.classList.add("notificacao-saindo");
        }
        else {
            elemento.classList.add("notificacao-entrando");
            void elemento.offsetWidth;
            quadroEntrada = agendarQuadro(() => {
                quadroEntrada = null;
                elemento.classList.remove("notificacao-entrando");
            });
        }
        const aoFinalizarTransicao = (evento) => {
            if (evento.target === elemento && evento.propertyName === "opacity") concluir();
        };
        const temporizador = setTimeout(concluir, (saindo ? 150 : 220) + 50);
        elemento.addEventListener("transitionend", aoFinalizarTransicao);
        transicoesToasts.set(notificacao, {
            concluir,
            cancelar: () => {
                if (quadroEntrada !== null) cancelarQuadro(quadroEntrada);
                clearTimeout(temporizador);
                elemento.removeEventListener("transitionend", aoFinalizarTransicao);
            }
        });
    }

    function encerrar() {
        if (encerrado) return;
        encerrado = true;
        movimentoReduzidoToasts.removeEventListener("change", aoMudarMovimento);
        if (anuncioPendente !== null) clearTimeout(anuncioPendente);
        anuncioPendente = null;
        mensagensParaAnunciar = [];
        filaNotificacoes.length = 0;
        for (const transicao of transicoesToasts.values()) transicao.cancelar();
        transicoesToasts.clear();
        const focada = notificacoesAtivas.find((notificacao) => notificacao.elemento.contains(document.activeElement));
        if (focada) {
            const destino = podeReceberFoco(focada.focoAnterior) && !areaNotificacoes.contains(focada.focoAnterior)
                ? focada.focoAnterior : obterFocoAlternativo();
            destino.focus();
        }
        for (const notificacao of notificacoesAtivas) {
            clearTimeout(notificacao.temporizador);
            notificacao.removerListeners();
            notificacao.elemento.remove();
        }
        notificacoesAtivas.length = 0;
        anuncioNotificacoes.textContent = "";
        controladores.delete(areaNotificacoes);
    }

    const controlador = { mostrarToast, encerrar };
    controladores.set(areaNotificacoes, controlador);
    return controlador;
}
