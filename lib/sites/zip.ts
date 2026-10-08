// Monta um arquivo .zip simples (sem compressão, "stored"), sem
// biblioteca. Basta para o pacote do site: index.html, LEIA-ME.txt e a
// pasta fotos/.

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(dados: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dataDos(d: Date) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, dia };
}

export interface ArquivoZip {
  // Termina com "/" para pasta.
  caminho: string;
  conteudo?: string;
}

export function montarZip(arquivos: ArquivoZip[], agora = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const { hora, dia } = dataDos(agora);
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let deslocamento = 0;

  for (const a of arquivos) {
    const nome = enc.encode(a.caminho);
    const dados = enc.encode(a.conteudo ?? "");
    const crc = crc32(dados);

    const local = new Uint8Array(30 + nome.length + dados.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true);
    vl.setUint16(6, 0x0800, true); // nomes em UTF-8
    vl.setUint16(8, 0, true); // sem compressão
    vl.setUint16(10, hora, true);
    vl.setUint16(12, dia, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, dados.length, true);
    vl.setUint32(22, dados.length, true);
    vl.setUint16(26, nome.length, true);
    vl.setUint16(28, 0, true);
    local.set(nome, 30);
    local.set(dados, 30 + nome.length);
    locais.push(local);

    const central = new Uint8Array(46 + nome.length);
    const vc = new DataView(central.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint16(10, 0, true);
    vc.setUint16(12, hora, true);
    vc.setUint16(14, dia, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, dados.length, true);
    vc.setUint32(24, dados.length, true);
    vc.setUint16(28, nome.length, true);
    vc.setUint16(30, 0, true);
    vc.setUint16(32, 0, true);
    vc.setUint16(34, 0, true);
    vc.setUint16(36, 0, true);
    vc.setUint32(38, a.caminho.endsWith("/") ? 0x10 : 0, true);
    vc.setUint32(42, deslocamento, true);
    central.set(nome, 46);
    centrais.push(central);

    deslocamento += local.length;
  }

  const tamanhoCentral = centrais.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  const vf = new DataView(fim.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, arquivos.length, true);
  vf.setUint16(10, arquivos.length, true);
  vf.setUint32(12, tamanhoCentral, true);
  vf.setUint32(16, deslocamento, true);

  const total = new Uint8Array(deslocamento + tamanhoCentral + fim.length);
  let pos = 0;
  for (const parte of [...locais, ...centrais, fim]) {
    total.set(parte, pos);
    pos += parte.length;
  }
  return total;
}

export function leiaMe(nomeEmpresa: string) {
  return `SITE DE ${nomeEmpresa.toUpperCase()}
Gerado com o Ártemis Prospect.

O QUE TEM AQUI
- index.html: o site inteiro (HTML, CSS e JavaScript num arquivo só).
- fotos/: coloque aqui as fotos do cliente.

COMO COLOCAR AS FOTOS
1. Salve as fotos do cliente dentro da pasta "fotos" com estes nomes:
   destaque.jpg, sobre.jpg, galeria-1.jpg, galeria-2.jpg, galeria-3.jpg
2. Abra o index.html num editor de texto e procure por "FOTO:".
3. Em cada lugar, troque o bloco <div class="foto-reservada" ...>...</div>
   pela linha <img ...> que aparece no comentário logo acima dele.
Use fotos do próprio cliente (ou com licença de uso). Não use fotos
copiadas do Google Maps.

DEPOIMENTOS
Os depoimentos do site são EXEMPLOS. Troque pelos depoimentos reais de
clientes (com autorização) ou apague a seção antes de publicar.

TEXTOS ENTRE COLCHETES
Procure por "[" no arquivo e preencha os dados que faltam (horário, por
exemplo).

ONDE HOSPEDAR
O Ártemis Prospect NÃO hospeda o site. Publique onde preferir: Netlify,
Vercel, GitHub Pages, Cloudflare Pages ou a hospedagem do cliente. Na
maioria delas, basta arrastar esta pasta para a página de envio.
`;
}
