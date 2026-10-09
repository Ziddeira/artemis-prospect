// CPF e CNPJ: conferência dos dígitos verificadores e formatação.
// Desde julho de 2026 a Receita emite CNPJ com letras (12 caracteres de
// letras ou números + 2 dígitos verificadores). O cálculo é o mesmo do
// CNPJ antigo, usando o código de cada caractere menos 48 ("0" = 0,
// "A" = 17...). Assim os dois formatos são aceitos.

export function soDigitos(texto: string) {
  return texto.replace(/\D/g, "");
}

// CNPJ sem pontuação, em maiúsculas (pode ter letras nas 12 primeiras posições).
export function limparCnpj(texto: string) {
  return texto.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function cpfValido(texto: string) {
  const d = soDigitos(texto);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(d[tamanho])) return false;
  }
  return true;
}

export function cnpjValido(texto: string) {
  const c = limparCnpj(texto);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c) || /^0{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const valor = (ch: string) => ch.charCodeAt(0) - 48;
  for (const tamanho of [12, 13]) {
    const pesos = tamanho === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += valor(c[i]) * pesos[i];
    const resto = soma % 11;
    const digito = resto < 2 ? 0 : 11 - resto;
    if (digito !== Number(c[tamanho])) return false;
  }
  return true;
}

export function formatarCpf(texto: string) {
  const d = soDigitos(texto);
  if (d.length !== 11) return texto.trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarCnpj(texto: string) {
  const c = limparCnpj(texto);
  if (c.length !== 14) return texto.trim().toUpperCase();
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}
