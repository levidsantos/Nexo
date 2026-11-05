// Cada instância mantém somente a disponibilidade das coleções nesta sessão.
// As decisões de bloqueio continuam nos fluxos que validam os dados.
export function criarEstadoDisponibilidade() {
    const colecoesBloqueadas = new Set();

    return {
        colecaoEstaBloqueada(chave) {
            return colecoesBloqueadas.has(chave);
        },
        bloquearColecao(chave) {
            colecoesBloqueadas.add(chave);
        }
    };
}
