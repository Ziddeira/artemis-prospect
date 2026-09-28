# Vídeo de apresentação — Reels e TikTok

Vídeo vertical (9:16, 1080 × 1920, 30 quadros por segundo, 40 segundos)
apresentando o Ártemis Prospect. Ele é todo feito em JavaScript: a imagem
é desenhada num `<canvas>` e o som (música e efeitos) é criado com a Web
Audio API. Não usa nenhum arquivo de áudio nem banco de imagens de
terceiros, então não tem problema de direitos autorais.

As imagens usadas são as da própria marca: a mascote
(`public/brand/artemis-mascote.png` e `public/artemis/artemis-pensando.jpeg`),
o símbolo e as fontes Chakra Petch e Manrope (licença livre OFL, em
`video/fonts/`).

## Roteiro

| Tempo | Cena | O que aparece |
|---|---|---|
| 0–4 s | Gancho | "Você faz sites?" → "Mas cadê os clientes?", com a Ártemis pensando |
| 4–8 s | Oportunidade | Mapa com pinos; a varredura acende quem está **sem site** |
| 8–12 s | Marca | Logo montando + "Ache clientes que ainda não têm site." |
| 12–18 s | Passo 1 | Celular: digita nicho e região, toca em **Buscar leads**, radar |
| 18–24 s | Passo 2 | Lista de leads com score e etiquetas; a mira trava no melhor |
| 24–30 s | Passo 3 | Desbloqueia o contato, chama no WhatsApp, "VENDA FECHADA" |
| 30–34 s | E tem mais | Funil, lembrete de retorno, rank do mês e comunidade |
| 34–40 s | Chamada | "Comece grátis", botão e artemisprospect.com.br |

Os textos e as cenas ficam em `cenas.js`. Os tempos de cada momento ficam
em `roteiro.js` (a imagem e o som leem os mesmos números, então mudar um
tempo ali muda os dois juntos). A música e os efeitos ficam em `som.js`.

## Assistir e gravar pelo navegador

O vídeo precisa ser aberto por um endereço `http://` (as fontes não
carregam abrindo o arquivo direto). Na raiz do projeto:

```bash
node video/render.mjs --servir
```

e abra **http://127.0.0.1:8787/video/** no Chrome. Nos primeiros segundos
a capa mostra "Preparando o som…". Depois:

- **Assistir com som**: toca o vídeo.
- **Gravar vídeo**: grava em tempo real (40 s) e baixa o arquivo (MP4 no
  Chrome e no Safari recentes, WebM nos outros). Deixe a aba aberta e
  visível durante a gravação.
- **Baixar som (.wav)**: só a trilha.

## Exportar o MP4 em qualidade máxima (recomendado para postar)

Na raiz do projeto, uma vez só:

```bash
npm i --no-save playwright-core ffmpeg-static
```

(o `--no-save` não mexe no `package.json`). Depois:

```bash
node video/render.mjs
```

Leva alguns minutos. Ele desenha os 1200 quadros um por um num Chrome sem
janela e junta tudo com o som. O resultado fica em `video/saida/`:

- `artemis-prospect-reels.mp4` — o vídeo (H.264 + AAC, cerca de 12 Mbps,
  volume em −14 LUFS, o padrão das redes sociais);
- `capa.jpg` — um quadro com a logo, para usar como capa do post;
- `artemis-prospect-reels.wav` — o som separado.

A pasta `video/saida/` não vai para o Git (é só gerar de novo).

Se ele não achar o Chrome, informe o caminho:

```bash
CHROME_PATH="/caminho/do/chrome" node video/render.mjs
```

Para conferir só alguns quadros (em PNG), sem gerar o vídeo inteiro:

```bash
node video/render.mjs --previa 1,10,28.7
```

## Dicas para postar

- Instagram e TikTok cobrem a parte de cima (perfil) e a de baixo
  (legenda e botões). O vídeo já deixa os textos importantes no meio da
  tela, longe dessas áreas.
- Na hora de postar, escolha a `capa.jpg` (ou o segundo 11) como capa.
- A trilha é original. Se quiser usar uma música em alta da própria rede,
  abaixe o volume do som original no editor do app em vez de tirá-lo, para
  manter os efeitos (cliques, whoosh, caixa registradora).
