// O armazenamento opcional permite testes isolados. O acesso ao localStorage
// permanece dentro do try: até obter essa propriedade pode falhar no navegador.
export function lerDados(chave, armazenamento) {
    try {
        const origem = armazenamento === undefined ? globalThis.localStorage : armazenamento;
        const conteudo = origem.getItem(chave);
        if (conteudo === null) return { sucesso: true, ausente: true, dados: null };
        return { sucesso: true, ausente: false, dados: JSON.parse(conteudo) };
    } catch (erro) {
        return { sucesso: false, erro };
    }
}

export function gravarDados(chave, registros, armazenamento) {
    try {
        const destino = armazenamento === undefined ? globalThis.localStorage : armazenamento;
        destino.setItem(chave, JSON.stringify(registros));
        return { sucesso: true };
    } catch (erro) {
        return { sucesso: false, erro };
    }
}
