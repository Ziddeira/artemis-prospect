# Vídeo de divulgação do Ártemis Prospect

Projeto separado do site, feito com [Remotion](https://www.remotion.dev)
(React + TypeScript). Ele não é publicado na Vercel e não mexe em nada do SaaS.

- Formato: 1080 x 1920 (vertical, para Reels, TikTok e Stories)
- Duração: 30 segundos, 30 quadros por segundo
- Saída: `out/artemis-prospect.mp4`

## Como usar

Precisa do Node.js 18 ou mais novo. Dentro desta pasta:

```bash
cd video-divulgacao
npm install          # só na primeira vez
npm run dev          # abre o editor no navegador para assistir e ajustar
npm run render       # gera o MP4 em out/artemis-prospect.mp4
```

Na primeira vez que renderizar, o Remotion baixa sozinho um Chrome próprio
(uns 100 MB). As fontes já estão dentro do projeto (`public/fontes`), então
não precisa de internet para elas.

## Roteiro

| Tempo | Cena | Legenda |
|---|---|---|
| 0s–3s | O pino amarelo da Ártemis cai no centro e pulsa; dezenas de pinos cinzas surgem e cobrem a tela | Sua cidade tem centenas de empresas **sem site**. |
| 3s–8s | Os pinos somem. Celular com a conversa parada em "oi, tudo bem?" e a lista de contatos sendo riscada | Achar cliente é **a parte difícil**. |
| 8s–14s | O pino cai no celular e abre o Ártemis: busca "barbearia" em Palhoça e aparece a lista de leads | O Ártemis Prospect mostra quem **ainda não tem site**. |
| 14s–20s | A mira trava no primeiro lead, toque no WhatsApp, a mensagem pronta é enviada | Toque e chame no WhatsApp com a **mensagem pronta**. |
| 20s–25s | "digitando…" e o cliente responde | Menos tempo procurando. **Mais tempo vendendo.** |
| 25s–30s | Logo, promessa, botão "Crie sua conta grátis" e o endereço do site | — |

Os nomes das empresas são inventados, só para ilustrar.

## Onde mudar cada coisa

- **Textos das legendas:** `src/Video.tsx`, na lista `LEGENDAS`. O
  `destaque` é o pedaço que sai em amarelo (tem que ser igual ao texto).
- **Tempos das cenas:** `src/marca.ts`, em `CENAS` (em segundos).
- **Cores e fontes:** `src/marca.ts` (os valores vêm do manual da marca).
- **Cada cena:** os arquivos em `src/cenas/`.
- **Leads da busca e mensagem pronta:** `src/cenas/TelaApp.tsx` (`LEADS`) e
  `src/cenas/TelaConversaNova.tsx` (`MENSAGEM`).
- **Números do plano grátis no final:** `src/cenas/CenaFinal.tsx` (hoje 3
  buscas e 5 desbloqueios, como em `lib/planos.ts` do site).

## Música

O vídeo sai sem áudio. Para colocar uma trilha, ponha o arquivo em
`public/` (por exemplo `public/musica.mp3`) e, em `src/Video.tsx`, adicione
dentro do `<AbsoluteFill>`:

```tsx
import { Audio, staticFile } from "remotion";

<Audio src={staticFile("musica.mp3")} volume={0.6} />
```

Use só música que você tem direito de usar (bibliotecas sem royalties ou a
própria biblioteca de áudio do TikTok/Instagram na hora de postar).
