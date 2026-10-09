// ============================================================
//  CONFIGURAÇÃO DO VÍDEO — é aqui que você ajusta tudo
// ============================================================
// Depois de mudar algo, salve: o editor (npm run previa) atualiza sozinho.

// ------------------------------------------------------------
// 1. Duração de cada cena, em segundos
// ------------------------------------------------------------
// A duração total do vídeo é a soma destas seis. Se a sua narração
// ficar mais curta ou mais longa, aumente ou diminua aqui. As animações
// de dentro de cada cena se espalham sozinhas pelo tempo que ela tiver.
// Dica: pode usar meio segundo (ex.: 5.5).
export const DURACAO_DAS_CENAS = {
  pinos: 3, //        1. pino amarelo e pinos cinzas
  dificil: 5, //      2. conversa parada e lista riscada
  busca: 6, //        3. sua gravação de tela no celular
  leads: 8, //        4. os três cartões de lead
  artemis: 5, //      5. cabeça da Ártemis e logo
  comenta: 3, //      6. "Comenta ÁRTEMIS"
};

// ------------------------------------------------------------
// 2. Legendas
// ------------------------------------------------------------
// "destaque" é o pedaço que sai em amarelo (precisa ser escrito igual
// ao texto). Para tirar a legenda de uma cena, use null.
export const LEGENDAS = {
  pinos: { texto: "Sua cidade tem centenas de empresas sem site.", destaque: "sem site" },
  dificil: { texto: "Achar cliente é a parte difícil.", destaque: "a parte difícil" },
  busca: { texto: "Nicho + região. O resto ele faz.", destaque: "O resto ele faz." },
  leads: null,
  artemis: null,
  comenta: null,
} as const;

// Texto grande da última cena (duas linhas).
export const CHAMADA_FINAL = { linha1: "Comenta", linha2: "ÁRTEMIS" };

// ------------------------------------------------------------
// 3. Seus arquivos (dentro da pasta public/)
// ------------------------------------------------------------
// Se algum arquivo faltar ou estiver vazio (0 bytes), o vídeo funciona
// do mesmo jeito: sem aquele som, ou com a tela de exemplo no lugar da
// gravação. Para a música e o pop, se o seu arquivo estiver vazio, entra
// o som gerado pelo projeto (pasta public/audio/gerado).
export const ARQUIVOS = {
  narracao: "audio/narracao.mp3",
  musica: "audio/musica.mp3",
  pop: "audio/pop.mp3",
  gravacaoDeTela: "video/tela-busca.mp4",
  cabecaArtemis: "artemis/artemis-foto.png",
  logo: "artemis/logo.svg",
  // Sons criados pelo "npm run gerar-sons" (usados quando os seus faltam).
  musicaGerada: "audio/gerado/musica.mp3",
  popGerado: "audio/gerado/pop.wav",
  pastaDosEfeitos: "audio/gerado",
};

// ------------------------------------------------------------
// 3b. Efeitos sonoros
// ------------------------------------------------------------
// Sons curtos nos momentos de ação (pino caindo, cortes, riscos, cartões,
// mira travando...). Para desligar todos, troque para false.
export const EFEITOS_LIGADOS = true;

// ------------------------------------------------------------
// 4. Gravação de tela (cena 3)
// ------------------------------------------------------------
export const GRAVACAO = {
  // Pular os primeiros segundos da gravação (ex.: 2 = começa no segundo 2).
  comecarEm: 0,
  // Velocidade: 1 = normal, 1.5 = uma vez e meia mais rápido.
  // Útil se a gravação for mais longa que a cena.
  velocidade: 1,
};

// ------------------------------------------------------------
// 5. Volumes (0 = mudo, 1 = volume original do arquivo)
// ------------------------------------------------------------
export const VOLUMES = {
  narracao: 1,
  // Música quando ninguém está falando (com narração).
  musica: 0.25,
  // Música quando o vídeo não tem narração nenhuma.
  musicaSemNarracao: 0.5,
  // Música enquanto a narração fala (o "ducking").
  musicaSobNarracao: 0.07,
  pop: 0.6,
  // Todos os efeitos sonoros juntos.
  efeitos: 0.55,
  // Sensibilidade para perceber que a narração está falando. Se a música
  // não abaixar, diminua (ex.: 0.01). Se abaixar até nos silêncios,
  // aumente (ex.: 0.04).
  limiarDeVoz: 0.02,
};

// ------------------------------------------------------------
// 6. Área segura das legendas
// ------------------------------------------------------------
// Margens (em pixels, num vídeo de 1080 x 1920) que o Instagram e o
// TikTok cobrem com botões, nome do perfil e descrição. As legendas
// ficam sempre dentro do que sobra, centralizadas.
export const AREA_SEGURA = { topo: 250, base: 470, lados: 110 };
