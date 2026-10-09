import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nomeArquivo } from "@/lib/sites/dados";
import { leiaMe, montarZip } from "@/lib/sites/zip";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Download do site: ?formato=html (só o index.html) ou ?formato=zip
// (index.html + LEIA-ME.txt + pasta fotos/). O Ártemis não hospeda nada:
// a pessoa baixa e publica onde quiser. Baixar não gasta saldo.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ erro: "Site não encontrado." }, { status: 404 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ erro: "Supabase não configurado neste ambiente." }, { status: 500 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "É preciso estar logado." }, { status: 401 });

  const { data: site } = await supabase
    .from("sites_gerados")
    .select("nome, html, html_expira_em")
    .eq("id", id)
    .maybeSingle<{ nome: string; html: string | null; html_expira_em: string | null }>();
  if (!site) return NextResponse.json({ erro: "Site não encontrado." }, { status: 404 });
  if (!site.html || (site.html_expira_em && new Date(site.html_expira_em) <= new Date())) {
    return NextResponse.json({ erro: "Este site não está mais guardado (passou de 30 dias)." }, { status: 410 });
  }

  const base = nomeArquivo(site.nome);
  const formato = new URL(request.url).searchParams.get("formato");

  if (formato === "zip") {
    const zip = montarZip([
      { caminho: `${base}/index.html`, conteudo: site.html },
      { caminho: `${base}/LEIA-ME.txt`, conteudo: leiaMe(site.nome) },
      { caminho: `${base}/fotos/` },
    ]);
    return new NextResponse(new Blob([zip as BlobPart], { type: "application/zip" }), {
      headers: {
        "Content-Disposition": `attachment; filename="${base}.zip"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new NextResponse(site.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.html"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
