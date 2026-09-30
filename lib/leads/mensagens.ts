// Mensagens padrão de WhatsApp, portadas de caca-leads-sem-site.html.
// Use {nome} para o nome do lead e {plataforma} para onde ele aparece
// hoje (Airbnb/Booking, Instagram, "redes sociais" etc.).

export const MSG_PADRAO_NEGOCIOS =
  "Oi, tudo bem? Vi a {nome} no Google Maps e notei que vocês ainda não têm um site próprio. Trabalho com isso aqui na região. Posso te mostrar uma ideia rápida de como ficaria?";

export const MSG_PADRAO_HOSPEDAGEM =
  "Oi, tudo bem? Vi a {nome} no Google Maps e percebi que as reservas hoje passam pelo {plataforma}. Trabalho com anfitriões aqui criando um canal de reserva direta: uma página própria com calendário e reserva pelo WhatsApp, sem comissão por reserva. Ela também serve para quem já se hospedou com vocês voltar direto, sem passar pela plataforma de novo. Posso te mostrar como ficaria?";

export function montarMensagem(
  modelo: string,
  nome: string,
  plataforma: string,
): string {
  return modelo.replaceAll("{nome}", nome).replaceAll("{plataforma}", plataforma);
}

export function linkWhatsapp(celular: string, texto: string): string {
  return `https://wa.me/${celular}?text=${encodeURIComponent(texto)}`;
}

// Modelos para leads de fora do Brasil (aba Internacional), no idioma do
// país (lib/leads/paises.ts, idiomaMensagem). Cada usuário pode editar os
// seus no Perfil; ficam em profiles.modelos_mensagem (etapa 21), um
// grupo por idioma. Sem edição, valem os padrões abaixo.
// {nome} vira o nome da empresa.

export type IdiomaModelo = "en";

export const NOME_IDIOMA: Record<"pt" | IdiomaModelo, string> = { pt: "português", en: "inglês" };
export const IDIOMAS_MODELO: IdiomaModelo[] = ["en"];

export interface ModelosMensagem {
  // E-mail: assunto e texto.
  emailAssunto: string;
  emailCorpo: string;
  // Curta: formulário de contato do site, Instagram, Facebook, Yelp...
  curta: string;
}

export const LIMITES_MODELO = { emailAssunto: 200, emailCorpo: 3000, curta: 1000 } as const;

export const MODELOS_PADRAO: Record<IdiomaModelo, ModelosMensagem> = {
  en: {
    emailAssunto: "A website idea for {nome}",
    emailCorpo:
      "Hi {nome} team,\n\nI found {nome} on Google Maps and noticed you don't have a website of your own yet. I'm a web designer and I build fast, mobile-friendly websites for local businesses, so new customers can find you on Google, see your services and get in touch directly.\n\nWould you like to see a free mockup of what your website could look like? No commitment.\n\nBest regards,",
    curta:
      "Hi! I found {nome} on Google Maps and noticed you don't have a website of your own yet. I'm a web designer who builds simple, mobile-friendly websites for local businesses. Would you like to see a free mockup of yours? No commitment.",
  },
};

export function ehIdiomaModelo(valor: unknown): valor is IdiomaModelo {
  return typeof valor === "string" && (IDIOMAS_MODELO as string[]).includes(valor);
}

// Junta o que o usuário salvou com os padrões (campo vazio = padrão).
export function modelosDoIdioma(salvos: unknown, idioma: IdiomaModelo): ModelosMensagem {
  const padrao = MODELOS_PADRAO[idioma];
  const grupo =
    salvos && typeof salvos === "object" ? (salvos as Record<string, unknown>)[idioma] : null;
  if (!grupo || typeof grupo !== "object") return padrao;
  const g = grupo as Record<string, unknown>;
  const texto = (chave: keyof ModelosMensagem) =>
    typeof g[chave] === "string" && (g[chave] as string).trim() ? (g[chave] as string) : padrao[chave];
  return { emailAssunto: texto("emailAssunto"), emailCorpo: texto("emailCorpo"), curta: texto("curta") };
}

export function preencherModelo(modelo: string, nome: string): string {
  return modelo.replaceAll("{nome}", nome);
}
