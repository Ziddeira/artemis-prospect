# Vídeo de apresentação · Studio Supremo (9:16)

Vídeo vertical (1080 × 1920, 30 fps, cerca de 50 s) que apresenta o site da
Studio Supremo Barbearia. Foi **feito inteiro em JavaScript**:

- **Imagem:** cada quadro é desenhado num `<canvas>` (textos, animações,
  transições, granulação de filme). As fotos e os dois vídeos curtos são os
  mesmos que já estão no site.
- **Música:** a trilha é original e gerada na hora com a Web Audio API
  (osciladores e ruído, sem nenhum arquivo de áudio). Por isso não tem
  problema de direitos autorais para postar.
- **Arquivo final:** um script abre a página num navegador sem janela, pede
  quadro por quadro e junta tudo num MP4 (H.264 + AAC), pronto para Reels,
  TikTok, Shorts e WhatsApp.

## Roteiro (a música é de 100 BPM, 1 compasso = 2,4 s)

| Tempo | Cena |
| --- | --- |
| 0:00 | Abertura: fio de luz, o símbolo sendo traçado e "Studio Supremo" |
| 0:04 | "Transforme seu visual. *Relaxe* em um só lugar." sobre o vídeo do salão |
| 0:09 | A casa: foto do salão e os 4 diferenciais |
| 0:14 | "Transformação real": vídeo de antes e depois acelerado |
| 0:16 | Carrossel com os 3 antes/depois de clientes |
| 0:21 | Serviços (o ritual) e preços de entrada |
| 0:26 | Jornada visagista, com a "leitura" do rosto animada |
| 0:31 | Equipe (Leivys em destaque e os barbeiros) |
| 0:36 | Nota 4,8 no Google e depoimentos |
| 0:40 | Alguns momentos (cortes secos no ritmo da batida) |
| 0:43 | Fachada: "Venha nos visitar" |
| 0:45 | Encerramento: marca, botão "Agendar horário" e contatos |

## Como usar

Precisa do Node.js 20 ou mais novo. Dentro desta pasta:

```bash
npm install          # instala o Playwright (navegador) e o ffmpeg
npm run preview      # abre a prévia em http://localhost:5173
npm run render       # gera out/studio-supremo-9x16.mp4
```

- Na **prévia** dá para reproduzir com som, pausar e arrastar a linha do
  tempo. O botão **"Gravar WebM"** grava o vídeo direto pelo navegador, sem
  precisar do script.
- Para renderizar só um pedaço: `npm run render -- --from 20 --to 26`.
- Para salvar imagens de alguns instantes: `npm run stills`.
- Se o Playwright pedir um navegador, rode `npx playwright install chromium`
  (ou aponte `CHROMIUM_PATH` para um Chrome/Chromium já instalado).

## Onde mexer

| Arquivo | O que tem |
| --- | --- |
| `src/scenes.js` | O roteiro: textos, ordem e duração das cenas, transições |
| `src/audio.js` | A trilha: acordes, bateria, efeitos |
| `src/engine.js` | Cores, fontes, easing, transições e utilitários de desenho |
| `src/logo.js` | O símbolo da marca (copiado do SVG do site) |
| `assets/` | Fotos, vídeos (WebM) e fontes (Fraunces, Work Sans, Italiana) |

Para trocar um texto, procure a frase em `src/scenes.js`. Para mudar a
duração de uma cena, altere o número de compassos na lista do final desse
arquivo (cada compasso tem 2,4 s, assim os cortes continuam no ritmo).

As fontes vêm do Google Fonts (licença SIL Open Font License, ver
`assets/fonts/LICENSE-*.txt`).
