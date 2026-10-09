// Cores, fontes e tempos do vídeo. Os valores de cor e fonte vêm do manual
// da marca (brand/MANUAL.md), para o vídeo bater com o site.
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// As fontes ficam dentro do projeto (public/fontes), então o vídeo
// renderiza igual mesmo sem internet. Licença livre (SIL OFL), ao lado.
export const FONTE_TITULO = "Chakra Petch";
export const FONTE_TEXTO = "Manrope";

const FONTES = [
  { family: FONTE_TITULO, arquivo: "chakra-petch-latin-600-normal", weight: "600", style: "normal" },
  { family: FONTE_TITULO, arquivo: "chakra-petch-latin-700-normal", weight: "700", style: "normal" },
  { family: FONTE_TITULO, arquivo: "chakra-petch-latin-700-italic", weight: "700", style: "italic" },
  { family: FONTE_TEXTO, arquivo: "manrope-latin-500-normal", weight: "500", style: "normal" },
  { family: FONTE_TEXTO, arquivo: "manrope-latin-600-normal", weight: "600", style: "normal" },
  { family: FONTE_TEXTO, arquivo: "manrope-latin-700-normal", weight: "700", style: "normal" },
  { family: FONTE_TEXTO, arquivo: "manrope-latin-800-normal", weight: "800", style: "normal" },
];

for (const f of FONTES) {
  loadFont({ family: f.family, url: staticFile(`fontes/${f.arquivo}.woff2`), weight: f.weight, style: f.style });
}

export const COR = {
  amarelo: "#FFD60A",
  // Fundo do vídeo (pedido do roteiro) e preto das peças da marca.
  fundo: "#0D0D0D",
  preto: "#0A0A0A",
  branco: "#FFFFFF",
  superficie: "#121212",
  sidebar: "#0F0F0F",
  divisoria: "#1F1F1F",
  borda: "#262626",
  bordaInput: "#2E2E2E",
  bordaForte: "#3D3D3D",
  cinza: "#525252",
  texto3: "#737373",
  texto2: "#A3A3A3",
  textoCampo: "#D4D4D4",
  // Verde do botão de WhatsApp (cena 4).
  whatsapp: "#25D366",
  // Traço que risca os contatos que não responderam (o "vermelho" do site).
  risco: "#FF8A80",
} as const;

// Canto cortado das peças da marca (manual, seção 6.1).
export const corte = (px: number) =>
  `polygon(0 0, calc(100% - ${px}px) 0, 100% ${px}px, 100% 100%, ${px}px 100%, 0 calc(100% - ${px}px))`;
