// Assinatura no navegador, ANTES de enviar: recorta o desenho (ou a
// imagem enviada) no tamanho da assinatura, deixa o fundo transparente e
// gera um PNG pequeno. O servidor confere o arquivo de novo.

export class ErroAssinatura extends Error {}

const TIPOS = ["image/png", "image/jpeg", "image/webp"];
const MAX_ARQUIVO = 5 * 1024 * 1024;
const MAX_LARGURA = 900;
const MAX_ALTURA = 300;

// Recorta a área desenhada (pixels não transparentes), com uma folga, e
// reduz para no máximo 900×300. null = nada desenhado.
export function recortarAssinatura(origem: HTMLCanvasElement): string | null {
  const ctx = origem.getContext("2d");
  if (!ctx) return null;
  const { width, height } = origem;
  const { data } = ctx.getImageData(0, 0, width, height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  // Rabisco muito pequeno (um ponto, um toque sem querer) não conta.
  if (x1 < 0 || x1 - x0 < 12 || (x1 - x0) * (y1 - y0) < 300) return null;

  const folga = 8;
  x0 = Math.max(0, x0 - folga);
  y0 = Math.max(0, y0 - folga);
  x1 = Math.min(width - 1, x1 + folga);
  y1 = Math.min(height - 1, y1 + folga);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const escala = Math.min(1, MAX_LARGURA / w, MAX_ALTURA / h);

  const saida = document.createElement("canvas");
  saida.width = Math.max(10, Math.round(w * escala));
  saida.height = Math.max(10, Math.round(h * escala));
  const s = saida.getContext("2d");
  if (!s) return null;
  s.imageSmoothingQuality = "high";
  s.drawImage(origem, x0, y0, w, h, 0, 0, saida.width, saida.height);
  return saida.toDataURL("image/png");
}

// Foto ou imagem da assinatura no papel: o fundo claro vira transparente
// e o traço fica escuro, para ficar bem em cima da linha do contrato.
export async function imagemParaAssinatura(arquivo: File): Promise<string> {
  if (!TIPOS.includes(arquivo.type)) throw new ErroAssinatura("Envie uma imagem JPG, PNG ou WEBP.");
  if (arquivo.size > MAX_ARQUIVO) throw new ErroAssinatura("A imagem passa de 5 MB. Escolha uma menor.");

  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new ErroAssinatura("Não conseguimos abrir essa imagem. Tente outra."));
      i.src = url;
    });
    const escala = Math.min(1, 1600 / img.naturalWidth, 1600 / img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new ErroAssinatura("Seu navegador não conseguiu processar a imagem.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const p = dados.data;
    for (let i = 0; i < p.length; i += 4) {
      const luz = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      // Claro (papel) some; escuro (tinta) fica, com borda suave.
      const opacidade = luz >= 200 ? 0 : luz <= 120 ? 255 : Math.round(((200 - luz) / 80) * 255);
      p[i + 3] = Math.min(p[i + 3], opacidade);
    }
    ctx.putImageData(dados, 0, 0);

    const recorte = recortarAssinatura(canvas);
    if (!recorte) throw new ErroAssinatura("Não encontramos a assinatura na imagem. Use fundo claro e traço escuro.");
    return recorte;
  } finally {
    URL.revokeObjectURL(url);
  }
}
