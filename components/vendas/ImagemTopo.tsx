import { getImageProps } from "next/image";
import topoComputador from "@/public/vendas/topo-computador.png";
import topoCelular from "@/public/vendas/topo-celular.png";

// Print real da tela Buscar no topo da página de vendas. No celular vai
// só a lista de leads (o print do computador ficaria com letra miúda);
// do tablet para cima, a tela inteira. O <picture> baixa só uma das
// duas, e as duas proporções ficam reservadas no CSS para a página não
// "pular" quando a imagem chega.
export default function ImagemTopo({ alt }: { alt: string }) {
  const comum = { alt, loading: "eager", fetchPriority: "high" } as const;
  const {
    props: { srcSet: computador, sizes: tamanhosComputador },
  } = getImageProps({ ...comum, src: topoComputador, sizes: "(min-width: 1024px) 560px, 92vw" });
  const { props: celular } = getImageProps({ ...comum, src: topoCelular, sizes: "92vw" });

  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={computador} sizes={tamanhosComputador} />
      {/* <img> comum de propósito: as props (srcSet otimizado) vêm do getImageProps do next/image. */}
      <img {...celular} alt={alt} className="block aspect-[358/530] h-auto w-full sm:aspect-[1104/782]" />
    </picture>
  );
}
