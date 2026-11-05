export const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});

export function dataValida(data) {
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
    const [ano, mes, dia] = data.split("-").map(Number);
    if (ano < 1 || mes < 1 || mes > 12 || dia < 1) return false;
    const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
    const diasPorMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return dia <= diasPorMes[mes - 1];
}

export function obterDataLocal(data = new Date()) {
    const ano = String(data.getFullYear()).padStart(4, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

export function converterParaCentavos(valor) {
    if ((typeof valor !== "number" && typeof valor !== "string")
        || String(valor).trim() === "" || !Number.isFinite(Number(valor)) || Number(valor) < 0) return NaN;
    // Opera sobre dígitos decimais, sem arredondar frações de centavo.
    const lerDecimal = (texto) => {
        const partes = /^[-+]?(\d*)(?:\.(\d*))?(?:e([-+]?\d+))?$/i.exec(texto);
        if (!partes || !(partes[1] + (partes[2] || "")).length) return NaN;
        let digitos = (partes[1] + (partes[2] || "")).replace(/^0+/, "");
        if (!digitos) return 0;
        let deslocamento = 2 + Number(partes[3] || 0) - (partes[2] || "").length;
        const semZerosFinais = digitos.replace(/0+$/, "");
        deslocamento += digitos.length - semZerosFinais.length;
        digitos = semZerosFinais;
        if (deslocamento < 0 || digitos.length + deslocamento > 16) return NaN;
        const centavos = Number(digitos + "0".repeat(deslocamento));
        return Number.isSafeInteger(centavos) ? centavos : NaN;
    };
    const centavos = lerDecimal(String(valor).trim());
    // A entrada do formulário também precisa sobreviver ao armazenamento como Number.
    return centavos === lerDecimal(String(Number(valor))) ? centavos : NaN;
}

export function formatarCentavos(centavos) {
    if (!Number.isSafeInteger(centavos)) return "Indisponível";
    // Evita perder o último centavo ao dividir totais elevados por 100 como Number.
    const inteiro = BigInt(centavos);
    const fracao = String(inteiro < 0n ? -(inteiro % 100n) : inteiro % 100n).padStart(2, "0");
    const partes = formatadorMoeda.formatToParts(inteiro / 100n);
    const texto = partes.map((parte) => parte.type === "fraction" ? fracao : parte.value).join("");
    return inteiro < 0n && inteiro > -100n ? `-${texto}` : texto;
}
