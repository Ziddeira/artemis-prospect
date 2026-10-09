// Valor em reais por extenso, como se escreve em contrato:
// 1500 → "mil e quinhentos reais"; 1520,5 → "mil quinhentos e vinte reais
// e cinquenta centavos". Vai até 999.999.999,99.

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

// De 1 a 999.
function ate999(n: number): string {
  if (n === 100) return "cem";
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

// "e" antes do último grupo só quando ele é menor que 100 ou centena
// redonda ("mil e vinte", "mil e quinhentos", mas "mil, quinhentos e vinte").
function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const unidades = n % 1000;

  const grupos: { texto: string; valor: number }[] = [];
  if (milhoes) grupos.push({ texto: milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`, valor: milhoes });
  if (milhares) grupos.push({ texto: milhares === 1 ? "mil" : `${ate999(milhares)} mil`, valor: milhares });
  if (unidades) grupos.push({ texto: ate999(unidades), valor: unidades });

  return grupos
    .map((g, i) => {
      if (i === 0) return g.texto;
      const curto = g.valor < 100 || g.valor % 100 === 0;
      return `${curto && i === grupos.length - 1 ? " e " : ", "}${g.texto}`;
    })
    .join("");
}

export function valorPorExtenso(valor: number): string {
  const centavosTotais = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;
  if (reais > 999_999_999) return "";

  const partes: string[] = [];
  if (reais) {
    // "um milhão de reais", "dois milhões de reais" (milhão redondo leva "de").
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? " de" : "";
    partes.push(`${inteiroPorExtenso(reais)}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (!partes.length) return "zero real";
  return partes.join(" e ");
}

// "R$ 1.500,00 (mil e quinhentos reais)"
export function valorComExtenso(valor: number): string {
  const numero = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ");
  return `${numero} (${valorPorExtenso(valor)})`;
}
