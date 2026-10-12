// Regras de senha usadas na tela (indicador de força) e no servidor
// (rotas de cadastro, troca e redefinição de senha). A tela só mostra o
// que falta na hora; quem decide é o servidor, que confere tudo de novo.
//
// Exigência mínima: 8 caracteres, com letras e números, e não ser uma
// senha óbvia (muito comum, sequência, repetição ou parte do e-mail).

export const SENHA_MIN = 8;
// O Supabase guarda a senha com bcrypt, que só aproveita 72 bytes.
export const SENHA_MAX = 72;

export type ForcaSenha = "fraca" | "media" | "forte";

export interface Requisito {
  chave: "tamanho" | "letra" | "numero" | "obvia";
  texto: string;
  ok: boolean;
}

export interface AvaliacaoSenha {
  forca: ForcaSenha;
  // true = atende à exigência mínima e pode ser usada.
  ok: boolean;
  requisitos: Requisito[];
  // O que fazer para chegar em "forte" (só quando já está ok).
  dica: string | null;
}

// Senhas inteiras muito usadas no Brasil e no mundo (comparadas sem
// maiúsculas e sem símbolos).
const COMUNS = new Set([
  "12345678", "123456789", "1234567890", "87654321", "987654321", "11111111", "00000000",
  "12341234", "11223344", "10203040", "102030405060", "13579246", "147258369", "159753",
  "1q2w3e4r", "1q2w3e4r5t", "q1w2e3r4", "qwe123", "qwer1234", "qwerty12", "qwerty123",
  "asdf1234", "zxcv1234", "a1b2c3d4", "abc12345", "abcd1234", "aa123456", "abc123456",
  "password1", "passw0rd", "p4ssw0rd", "senha123", "senha1234", "s3nha123", "mudar123",
  "trocar123", "admin123", "teste123", "usuario123", "iloveyou1", "teamo123", "brasil123",
]);

// Palavras óbvias: a senha não pode ser só uma delas com números antes
// ou depois (ex.: "flamengo2024", "123senha").
const PALAVRAS_OBVIAS = new Set([
  "senha", "minhasenha", "password", "passw", "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl",
  "zxcvbn", "zxcvbnm", "abc", "abcd", "abcde", "abcdef", "admin", "administrador", "teste",
  "test", "mudar", "trocar", "usuario", "user", "login", "entrar", "welcome", "iloveyou",
  "teamo", "amor", "deus", "jesus", "brasil", "futebol", "familia", "flamengo",
  "corinthians", "palmeiras", "saopaulo", "vasco", "gremio", "cruzeiro", "santos",
  "botafogo", "fluminense", "internacional", "atletico", "bahia", "artemis",
  "artemisprospect", "prospect", "cacaleads",
]);

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Desfaz trocas óbvias de letra por número ("s3nh4" → "senha").
const TROCAS: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b" };
function desfazerTrocas(valor: string) {
  return valor.replace(/[0134578]/g, (d) => TROCAS[d]);
}

// Quantos "trechos" a senha tem, sendo cada trecho uma repetição
// (aaaa, 1111) ou uma sequência (abcd, 4321). "abcd1234" tem 2.
function trechosDeSequencia(senha: string) {
  const c = [...senha.toLowerCase()].map((ch) => ch.codePointAt(0) ?? 0);
  if (c.length === 0) return 0;
  let trechos = 1;
  let passo: number | null = null;
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    const cabe = d === 0 || d === 1 || d === -1;
    if (cabe && (passo === null || passo === d)) {
      passo = d;
    } else {
      trechos++;
      passo = null;
    }
  }
  return trechos;
}

// Motivo de a senha ser óbvia, ou null se não for.
function motivoObvia(senha: string, email?: string | null): string | null {
  const n = normalizar(senha);
  if (n.length === 0) return null;
  if (COMUNS.has(n)) return "Essa senha é muito comum. Escolha outra.";

  const semNumerosNasPontas = n.replace(/^\d+/, "").replace(/\d+$/, "");
  if (PALAVRAS_OBVIAS.has(semNumerosNasPontas) || PALAVRAS_OBVIAS.has(desfazerTrocas(semNumerosNasPontas))) {
    return "Evite palavras óbvias como “senha”, nomes de time ou do site, só com números no fim.";
  }

  if (new Set(n).size < 4 || trechosDeSequencia(n) <= 2) {
    return "Evite sequências e repetições como 1234, abcd ou aaaa.";
  }

  const usuario = normalizar((email ?? "").split("@")[0] ?? "");
  if (usuario.length >= 4 && n.includes(usuario)) {
    return "Não use o seu e-mail (ou parte dele) na senha.";
  }
  return null;
}

export function avaliarSenha(senha: string, email?: string | null): AvaliacaoSenha {
  const tamanho = [...senha].length;
  const temLetra = /\p{L}/u.test(senha);
  const temNumero = /\p{Nd}/u.test(senha);
  const obvia = motivoObvia(senha, email);
  const curtaDemais = tamanho < SENHA_MIN;

  const requisitos: Requisito[] = [
    { chave: "tamanho", texto: `Pelo menos ${SENHA_MIN} caracteres`, ok: !curtaDemais },
    { chave: "letra", texto: "Pelo menos uma letra", ok: temLetra },
    { chave: "numero", texto: "Pelo menos um número", ok: temNumero },
    {
      // Só julga "óbvia" depois que há algo para julgar.
      chave: "obvia",
      texto: obvia ?? "Não ser uma senha óbvia",
      ok: tamanho > 0 && !obvia,
    },
  ];

  const ok = requisitos.every((r) => r.ok) && new TextEncoder().encode(senha).length <= SENHA_MAX;
  if (!ok) return { forca: "fraca", ok, requisitos, dica: null };

  const tipos = [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{Nd}]/u].filter((r) => r.test(senha)).length;
  const forte = tamanho >= 12 || (tamanho >= 10 && tipos >= 3);
  return {
    forca: forte ? "forte" : "media",
    ok,
    requisitos,
    dica: forte ? null : "Para ficar forte: use 12 caracteres ou mais, ou misture maiúsculas e símbolos.",
  };
}

// Mensagem de erro para o servidor (ou null se a senha serve). Diz o que
// falta, em vez de só "senha fraca".
export function erroSenha(senha: string, email?: string | null): string | null {
  if (new TextEncoder().encode(senha).length > SENHA_MAX) {
    return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
  }
  const { ok, requisitos } = avaliarSenha(senha, email);
  if (ok) return null;
  const obvia = requisitos.find((r) => r.chave === "obvia" && !r.ok && senha.length > 0);
  const faltam = requisitos
    .filter((r) => !r.ok && r.chave !== "obvia")
    .map((r) => r.texto.charAt(0).toLowerCase() + r.texto.slice(1));
  if (faltam.length > 0) {
    return `A senha precisa ter: ${juntar(faltam)}.`;
  }
  return obvia?.texto ?? "Escolha uma senha mais difícil de adivinhar.";
}

function juntar(itens: string[]) {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}
