// Descrição curta do aparelho a partir do "user agent" do navegador,
// ex.: "Chrome no Windows", "Safari no iPhone". É só para a pessoa
// reconhecer o acesso no Perfil e no aviso de aparelho novo.

function navegador(ua: string): string | null {
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/FxiOS\/|Firefox\//.test(ua)) return "Firefox";
  if (/CriOS\/|Chrome\//.test(ua)) return "Chrome";
  if (/Version\/.*Safari\//.test(ua)) return "Safari";
  return null;
}

function sistema(ua: string): string | null {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "Chromebook";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

export function descreverAparelho(ua: string | null | undefined): string {
  const texto = ua ?? "";
  const n = navegador(texto);
  const s = sistema(texto);
  if (n && s) return `${n} no ${s}`;
  return n ?? s ?? "Aparelho desconhecido";
}
