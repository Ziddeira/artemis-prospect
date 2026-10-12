import type { NextConfig } from "next";

// Endereço antigo da Vercel. Quem chega por ele vai para o domínio
// oficial, no mesmo caminho, para o Google não ver dois sites iguais.
// As rotas /api/ ficam de fora: webhooks (Asaas) e crons que ainda
// chamem o endereço antigo continuam funcionando, sem redirecionamento.
const HOST_ANTIGO = "caca-leads.vercel.app";
const DOMINIO = "https://artemisprospect.com.br";

const emProducao = process.env.NODE_ENV === "production";

// Endereço do Supabase, caso use domínio próprio (os *.supabase.co já
// estão liberados abaixo).
function origemSupabase() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return { https: url.origin, wss: `wss://${url.host}` };
  } catch {
    return null;
  }
}
const supabase = origemSupabase();

// Política de conteúdo (CSP): de onde a página pode carregar scripts,
// estilos, imagens e conexões. O que não está aqui é bloqueado.
//   * scripts: os do próprio site, o captcha da Cloudflare (Turnstile)
//     e a barra de comentários da Vercel nas pré-visualizações. Os
//     scripts em linha continuam liberados ('unsafe-inline') porque o
//     Next.js e o script do tema dependem deles; trocar por "nonce"
//     deixaria todas as páginas dinâmicas;
//   * a prévia dos sites gerados com IA roda num iframe "srcdoc", que
//     herda esta política: por isso o HTML gerado não pode usar nada
//     de fora (lib/sites/ia.ts já pede isso);
//   * frame-ancestors 'none': ninguém coloca o site dentro de um iframe.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${emProducao ? "" : " 'unsafe-eval'"} https://challenges.cloudflare.com https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  // Fotos de perfil (Supabase Storage, Google) e prévias de upload (blob:).
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  [
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    supabase ? `${supabase.https} ${supabase.wss}` : "",
    "https://challenges.cloudflare.com https://vercel.live wss://ws-us3.pusher.com",
  ]
    .filter(Boolean)
    .join(" "),
  "frame-src 'self' https://challenges.cloudflare.com https://vercel.live",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(emProducao ? ["upgrade-insecure-requests"] : []),
].join("; ");

const CABECALHOS_SEGURANCA = [
  // Só HTTPS por 2 anos (o navegador nem tenta HTTP). Sem
  // "includeSubDomains" para não afetar subdomínios que não sejam deste site.
  ...(emProducao ? [{ key: "Strict-Transport-Security", value: "max-age=63072000" }] : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Outros sites só ficam sabendo o domínio de onde a pessoa veio, nunca
  // o caminho (que pode ter códigos, como o link do contrato).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:caminho*", headers: CABECALHOS_SEGURANCA },
      // A CSP vale para as páginas. As rotas /api/ devolvem JSON, PDF e
      // arquivos para baixar; os PDFs abertos no navegador ficam de fora
      // para não atrapalhar o leitor de PDF.
      { source: "/", headers: [{ key: "Content-Security-Policy", value: CSP }] },
      { source: "/:caminho((?!api/).*)", headers: [{ key: "Content-Security-Policy", value: CSP }] },
    ];
  },
  async redirects() {
    const noHostAntigo = [{ type: "host" as const, value: HOST_ANTIGO }];
    return [
      { source: "/", has: noHostAntigo, destination: `${DOMINIO}/`, permanent: true },
      {
        source: "/:caminho((?!api/).*)",
        has: noHostAntigo,
        destination: `${DOMINIO}/:caminho`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
