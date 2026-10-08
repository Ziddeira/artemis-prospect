// Tratamento do HTML que a IA devolve, antes de guardar e entregar.
//
// Regra do produto: o site gerado NUNCA leva fotos vindas da API do Google
// (nem de lugar nenhum da internet). O pedido à IA já proíbe; aqui o
// servidor confere de novo e troca qualquer imagem externa por um espaço
// reservado, para o cliente colocar as fotos dele.

// Tira o documento HTML da resposta (ignora texto antes ou depois e as
// cercas ```html, se vierem).
export function extrairHtml(resposta: string): string | null {
  const inicio = resposta.search(/<!doctype html/i);
  const fim = resposta.toLowerCase().lastIndexOf("</html>");
  if (inicio < 0 || fim < inicio) return null;
  return resposta.slice(inicio, fim + "</html>".length).trim();
}

const EXTERNO = /^\s*['"]?\s*(https?:|\/\/|data:)/i;

function blocoFoto(descricao: string) {
  const texto = descricao.replace(/[<>"]/g, "").trim().slice(0, 80) || "foto";
  return (
    `<!-- FOTO: troque este bloco por <img src="fotos/sua-foto.jpg" alt="${texto}"> -->` +
    `<div class="foto-reservada" role="img" aria-label="Espaço para foto: ${texto}">Espaço para foto: ${texto}</div>`
  );
}

export function protegerFotos(html: string): string {
  let saida = html;

  // <img> com endereço da internet ou imagem embutida (data:).
  saida = saida.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const valor = src ? (src[2] ?? src[3] ?? src[4] ?? "") : "";
    const srcset = /\bsrcset\s*=/i.test(tag);
    if (!EXTERNO.test(valor) && !srcset) return tag;
    const alt = tag.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
    return blocoFoto(alt ? (alt[2] ?? alt[3] ?? "") : "foto");
  });

  // <source srcset="https://..."> dentro de <picture>.
  saida = saida.replace(/<source\b[^>]*\bsrcset\s*=\s*("[^"]*"|'[^']*')[^>]*>/gi, (tag, valor: string) =>
    EXTERNO.test(valor.slice(1)) ? "" : tag,
  );

  // Fundo com imagem da internet no CSS: url(https://...) → nada.
  saida = saida.replace(/url\(\s*(['"]?)(https?:|\/\/|data:image)[^)]*\)/gi, "none");

  // Mapa embutido, vídeos e páginas de fora: o site usa só o link "Ver no
  // mapa". Scripts de fora (bibliotecas, rastreadores) também saem.
  saida = saida.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  saida = saida.replace(/<iframe\b[^>]*\/?>/gi, "");
  saida = saida.replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi, "");
  saida = saida.replace(/<link\b[^>]*\brel\s*=\s*["']?(preload|prefetch)[^>]*>/gi, "");

  return saida;
}

// Link do WhatsApp com mensagem pronta para o visitante do site.
export function linkWhatsappSite(digitos: string, texto: string): string {
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

// Link "Ver no mapa" (Google Maps URLs: abre a busca, sem chave de API e
// sem incorporar nada do Google no site).
export function linkMapa(nome: string, endereco: string, cidade: string): string {
  const consulta = [nome, endereco, cidade].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
