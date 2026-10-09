# Vídeo de divulgação do Ártemis Prospect

Projeto separado do site, feito com [Remotion](https://www.remotion.dev)
(React + TypeScript). Ele não é publicado na Vercel e não mexe em nada do SaaS.

- Formato: 1080 x 1920 (vertical, para Reels, TikTok e Stories)
- Duração: 30 segundos (soma das cenas, ajustável), 30 quadros por segundo
- Saída: `out/artemis-prospect.mp4`

## Os comandos

Precisa do Node.js 18 ou mais novo. Na primeira vez, entre na pasta e instale:

```bash
cd video-divulgacao
npm install
```

Depois é só:

```bash
npm run previa      # abre o editor no navegador para assistir (com som)
npm run exportar    # gera o MP4 em out/artemis-prospect.mp4
npm run gerar-sons  # recria a música e os efeitos (só se mudar as durações)
```

Na primeira exportação, o Remotion baixa sozinho um Chrome próprio
(uns 100 MB). As fontes do site já estão dentro do projeto (`public/fontes`).

## Som

O vídeo já sai com som, mesmo sem nenhum arquivo seu:

- **Trilha original** (`public/audio/gerado/musica.mp3`), criada pelo próprio
  projeto só com matemática (osciladores, ruído e filtros), sem baixar nada.
  Por isso não tem problema de direitos. Ela segue as cenas: tensa e com
  "relógio" nas cenas 1 e 2, sobe até a virada, entra a batida na cena 3,
  ganha um arpejo na 4, fica mais brilhante na 5 e fecha com uma pancada e
  um acorde que se apaga na 6.
- **Efeitos sonoros** (`public/audio/gerado/*.wav`), cada um no quadro exato
  da animação:

| Momento | Efeito |
|---|---|
| Pino amarelo caindo e batendo no chão | `queda` + `impacto` |
| Ondas do pino pulsando | `sonar` |
| Pinos cinzas surgindo | `chuva` (dezenas de estalinhos) |
| Cortes secos (cenas 1, 2 e 6) | `corte` |
| Mensagens "oi, tudo bem?" e "conseguiu ver?" | `enviar` |
| Cada contato riscado | `risco` |
| Pino caindo no celular e a tela acendendo | `queda` + `impacto` + `brilho` |
| Cartões de lead entrando | `deslizar` |
| Etiquetas dos cartões | `pop` (o seu, ou o gerado) |
| Telefone desbloqueado | `desbloquear` |
| Botão verde de WhatsApp | `ding` |
| Cabeça da Ártemis entrando | `deslizar` |
| Cantoneiras travando na logo | `trava` + `brilho` |
| "Comenta ÁRTEMIS" e o balão | `impacto` + `bolha` |

**O seu arquivo sempre tem prioridade:** se você colocar
`public/audio/musica.mp3` ou `public/audio/pop.mp3`, eles tocam no lugar dos
gerados. A narração é sempre a sua (o projeto não cria voz).

Ajustes em `src/config.ts`:

- `VOLUMES.efeitos`: volume de todos os efeitos juntos.
- `VOLUMES.musicaSemNarracao`: volume da música quando não há narração.
- `EFEITOS_LIGADOS = false`: desliga todos os efeitos.

Se você mudar as durações das cenas, os efeitos acompanham sozinhos. A
música gerada não: rode `npm run gerar-sons` para ela ser refeita no novo
tempo. Se esquecer, o editor avisa na faixa vermelha.

## Onde colocar cada arquivo seu

Os arquivos abaixo já existem **vazios** (0 bytes), só para marcar o lugar.
É só substituir pelo seu, **com o mesmo nome**. Enquanto um deles estiver
vazio ou faltando, o vídeo funciona do mesmo jeito: toca o som gerado (música
e pop), fica sem narração, ou mostra uma tela de exemplo no lugar da gravação.

| Arquivo | O que é | Dicas |
|---|---|---|
| `public/audio/narracao.mp3` | Sua narração | Comece a falar já no segundo 0 do arquivo; ela toca desde o início do vídeo. |
| `public/audio/musica.mp3` | Música livre de direitos (opcional) | Substitui a trilha gerada. Pode ser mais curta que o vídeo: ela repete sozinha. Some suavemente no fim. |
| `public/audio/pop.mp3` | Efeito curto (opcional) | Substitui o pop gerado. Toca quando cada etiqueta de lead aparece (3 vezes na cena 4). Ideal: menos de 1 segundo. |
| `public/video/tela-busca.mp4` | Gravação de tela da busca | Grave o celular em pé. O vídeo preenche a tela do celular e corta as sobras se a proporção for diferente. Fica sem som (quem fala é a narração). |
| `public/artemis/artemis-foto.png` | Cabeça da Ártemis | **Já vem** (cópia da imagem do site). Troque se quiser outra expressão. |
| `public/artemis/logo.svg` | Logo da cena 5 | **Já vem** (o símbolo oficial da marca). O nome "ÁRTEMIS PROSPECT" é escrito pelo código logo abaixo. |

No editor (`npm run previa`), uma faixa vermelha no topo lista os arquivos
que ainda faltam. Essa faixa **nunca** aparece no MP4 exportado.

Formatos: use MP3 para os áudios e MP4 (H.264) para a gravação. Se algum
arquivo estiver corrompido, o vídeo segue sem ele e o terminal avisa.

## Ajustar o tempo das cenas

Tudo fica em **`src/config.ts`**, que tem comentários explicando cada item:

```ts
export const DURACAO_DAS_CENAS = {
  pinos: 3,    // 1. pino amarelo e pinos cinzas
  dificil: 5,  // 2. conversa parada e lista riscada
  busca: 6,    // 3. sua gravação de tela no celular
  leads: 8,    // 4. os três cartões de lead
  artemis: 5,  // 5. cabeça da Ártemis e logo
  comenta: 3,  // 6. "Comenta ÁRTEMIS"
};
```

A duração total é a soma das seis. Se a narração ficar mais longa ou mais
curta, mude os números (pode usar meio segundo, como `5.5`). As animações de
dentro de cada cena se espalham sozinhas pelo novo tempo, e as legendas, os
"pops" e o ducking acompanham. Se a narração for maior que o vídeo, o editor
avisa na faixa vermelha.

No mesmo arquivo você também muda:

- **Legendas** (`LEGENDAS`): texto e o pedaço em amarelo. `null` tira a legenda.
- **Texto final** (`CHAMADA_FINAL`): troque "ÁRTEMIS" por outra palavra-chave.
- **Gravação** (`GRAVACAO`): pular os primeiros segundos ou acelerar, se ela
  for mais longa que a cena. Se for mais curta, o último quadro fica parado.
- **Volumes** (`VOLUMES`): narração, música, música sob a narração e pop.
- **Área segura** (`AREA_SEGURA`): as margens que o Instagram e o TikTok
  cobrem. As legendas ficam sempre dentro dela, centralizadas.

## Como funciona o ducking

Antes de começar, o projeto "escuta" a narração quadro a quadro. Onde tem
voz, a música desce para `musicaSobNarracao` (padrão 0,07); nos silêncios,
volta para `musica` (padrão 0,25). Ela desce rápido e sobe devagar, e segura
um pouquinho entre as palavras para não ficar sobe-e-desce.

- A música não abaixa? Diminua `limiarDeVoz` (ex.: `0.01`).
- Abaixa até nos silêncios (ruído de fundo na gravação)? Aumente (ex.: `0.04`).

Sem narração, a música fica no volume normal o vídeo todo.

## Roteiro

| Cena | Tempo padrão | O que acontece | Legenda |
|---|---|---|---|
| 1 | 0s–3s | O pino amarelo cai no centro e pulsa; dezenas de pinos cinzas cobrem a tela. Dois cortes secos de "câmera" dão ritmo. | Sua cidade tem centenas de empresas **sem site**. |
| 2 | 3s–8s | Os pinos somem num piscar; o celular estala na tela com a conversa parada em "oi, tudo bem?", corte seco aproximando, corte para a lista sendo riscada rápido. | Achar cliente é **a parte difícil**. |
| 3 | 8s–14s | O pino amarelo cai no celular e abre a sua gravação de tela, com calma. | Nicho + região. **O resto ele faz.** |
| 4 | 14s–22s | Três cartões entram um por vez: "Sem site", "Só Instagram" e "Depende do Airbnb", com nota e avaliações (pop em cada etiqueta). No último, o telefone é desbloqueado e entra o botão verde de WhatsApp. | — |
| 5 | 22s–27s | A cabeça da Ártemis entra pela lateral; a logo se forma no centro (as cantoneiras amarelas travam no símbolo) e o nome aparece. | — |
| 6 | 27s–30s | "COMENTA ÁRTEMIS" grande em amarelo, com um balão de comentário pulsando. | — |

Os nomes das empresas e o telefone dos cartões são inventados, só para ilustrar.

## Onde está cada coisa

- `src/config.ts`: **tudo o que você ajusta** (tempos, legendas, arquivos, volumes).
- `src/Video.tsx`: a linha do tempo que junta as cenas.
- `src/cenas/`: uma peça por cena (`Pinos`, `TelaConversaParada`,
  `TelaListaRiscada`, `TelaGravacao`, `CenaLeads`, `CenaArtemis`, `CenaComenta`).
  `TelaApp` é a tela de exemplo que aparece enquanto a gravação não chega.
- `src/arquivos.ts`: confere seus arquivos e calcula o ducking.
- `src/componentes/Efeitos.tsx`: em que momento toca cada efeito sonoro.
- `scripts/gerar-sons.mjs`: a "receita" da música e dos efeitos.
- `src/marca.ts`: cores e fontes do manual da marca.

## Escolhas que fogem do manual da marca (pedidas no roteiro)

- Fundo `#0D0D0D` no lugar do preto `#0A0A0A` (quase igual).
- Botão de WhatsApp verde (no site ele é amarelo). O texto em cima é preto,
  para dar contraste.
- Na cena 5, a mascote aparece junto com o símbolo grande; o manual pede para
  não juntar os dois. A cabeça fica num círculo branco, como o manual manda
  para fundo escuro.

## Licença do Remotion

O Remotion é gratuito para pessoas físicas e empresas com até 3 pessoas.
Empresas maiores precisam de licença paga. Confira em remotion.dev/license.
