import { getImageProps } from "next/image";
import topoComputador from "@/public/vendas/topo-computador.png";
import topoCelular from "@/public/vendas/topo-celular.png";

// Print real da tela Buscar no topo da página de vendas, em alta
// resolução (o do computador tem 3840 px de largura; o do celular, 4x a
// densidade normal). O next/image entrega a cada aparelho só o tamanho
// de que ele precisa. No celular vão só dois cartões de lead (o print do
// computador ficaria com letra miúda); do tablet para cima, a lista com
// os três leads. O <picture> baixa só uma das duas, e as duas proporções
// ficam reservadas no CSS para a página não "pular" quando a imagem chega.
export default function ImagemTopo({ alt }: { alt: string }) {
  const comum = { alt, loading: "eager", fetchPriority: "high", quality: 90 } as const;
  const {
    props: { srcSet: computador, sizes: tamanhosComputador },
  } = getImageProps({ ...comum, src: topoComputador, sizes: "(min-width: 1024px) 560px, 92vw" });
  const { props: celular } = getImageProps({ ...comum, src: topoCelular, sizes: "92vw" });

  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={computador} sizes={tamanhosComputador} />
      {/* <img> comum de propósito: as props (srcSet otimizado) vêm do getImageProps do next/image. */}
      <img {...celular} alt={alt} className="block aspect-[382/594] h-auto w-full sm:aspect-[896/712]" />
    </picture>
  );
}
