import Link from "next/link";
import Logo from "@/components/marca/Logo";
import { EMAIL_CONTATO } from "@/lib/site";

// Rodapé das páginas públicas (início, Termos de uso e Política de
// privacidade): marca, links dos documentos e e-mail de contato.
export default function Rodape() {
  return (
    <footer className="px-seguro pb-seguro border-t border-line-2 bg-canvas sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6 text-sm text-muted">
        <span className="flex items-center gap-3">
          <Logo variante="simbolo" tamanho={28} />
          <span>© {new Date().getFullYear()} Ártemis Prospect</span>
        </span>
        <nav aria-label="Documentos e contato" className="flex flex-wrap items-center gap-x-5">
          <Link href="/termos" className={LINK_RODAPE}>
            Termos de uso
          </Link>
          <Link href="/privacidade" className={LINK_RODAPE}>
            Política de privacidade
          </Link>
          <a href={`mailto:${EMAIL_CONTATO}`} className={LINK_RODAPE}>
            {EMAIL_CONTATO}
          </a>
        </nav>
      </div>
    </footer>
  );
}

const LINK_RODAPE = "inline-flex min-h-11 items-center underline-offset-4 transition hover:text-ink hover:underline";
