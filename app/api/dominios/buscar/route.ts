import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consultarDominios } from "@/lib/dominios/rdap";
import {
  EXTENSOES,
  EXTENSOES_SUGESTAO,
  montarSugestoes,
  nomeValidoPara,
  normalizarNome,
  type Extensao,
  type ResultadoDominio,
  type RespostaBusca,
} from "@/lib/dominios/regras";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MSG_FALTA_ETAPA26 =
  "A aba Domínios ainda não foi ativada no banco. Rode o script supabase/etapa26-dominios.sql no Supabase.";

// Aba Domínios: confere se o nome está livre nas 6 extensões, por RDAP
// (lib/dominios/rdap.ts). Se o nome exato estiver ocupado no .com.br ou
// no .com, confere também algumas variações (com a cidade, sufixo...).
// Buscar não gasta crédito; o limite é de buscas por minuto (etapa 26).
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado neste ambiente." }, { status: 500 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "É preciso estar logado." }, { status: 401 });
  }

  const corpo = await request.json().catch(() => null);
  const texto = typeof corpo?.nome === "string" ? corpo.nome.slice(0, 200) : "";
  const cidade = typeof corpo?.cidade === "string" ? corpo.cidade.slice(0, 100) : "";
  const nome = normalizarNome(texto);
  if (nome.length < 2) {
    return NextResponse.json(
      { erro: "Digite um nome com pelo menos 2 letras ou números (ex.: padariasaojoao)." },
      { status: 400 },
    );
  }

  const { error: erroLimite } = await supabase.rpc("dominios_contar_busca");
  if (erroLimite) {
    if (erroLimite.code === "AP429") {
      return NextResponse.json({ erro: erroLimite.message }, { status: 429 });
    }
    if (["PGRST202", "42883"].includes(erroLimite.code ?? "")) {
      return NextResponse.json({ erro: MSG_FALTA_ETAPA26 }, { status: 503 });
    }
    console.error("[dominios/buscar] dominios_contar_busca:", erroLimite.code, erroLimite.message);
    return NextResponse.json({ erro: "Não foi possível buscar agora. Tente de novo em instantes." }, { status: 500 });
  }

  const resultados = await consultar(nome, EXTENSOES);

  const ocupadoPrincipal = resultados.some(
    (r) => EXTENSOES_SUGESTAO.includes(r.extensao) && r.situacao === "ocupado",
  );
  const nomesSugeridos = ocupadoPrincipal ? montarSugestoes(texto, nome, cidade) : [];
  const conferidas = nomesSugeridos.length
    ? await consultarDominios(
        nomesSugeridos.flatMap((n) => EXTENSOES_SUGESTAO.map((extensao) => ({ nome: n, extensao }))),
      )
    : [];
  const sugestoes = nomesSugeridos.map((n) => ({
    nome: n,
    resultados: conferidas.filter((r) => r.dominio.slice(0, -(r.extensao.length + 1)) === n),
  }));

  const todas = [...resultados, ...conferidas];
  const resposta: RespostaBusca = {
    nome,
    resultados,
    sugestoes,
    aviso: todas.some((r) => r.situacao === "limite")
      ? "Alguns serviços de consulta pediram uma pausa por excesso de buscas. Espere um minuto e busque de novo para ver as extensões que faltaram."
      : todas.some((r) => r.situacao === "erro")
        ? "Não deu para consultar algumas extensões agora (falha de conexão com o serviço de consulta). Tente de novo em instantes."
        : null,
  };
  return NextResponse.json(resposta);
}

// Nomes que não cabem nas regras de uma extensão nem chegam a ser
// consultados (ex.: mais de 26 caracteres no .com.br).
async function consultar(nome: string, extensoes: readonly Extensao[]): Promise<ResultadoDominio[]> {
  const validas = extensoes.filter((ext) => nomeValidoPara(nome, ext));
  const consultados = await consultarDominios(validas.map((extensao) => ({ nome, extensao })));
  return extensoes.map(
    (extensao) =>
      consultados.find((r) => r.extensao === extensao) ?? {
        extensao,
        dominio: `${nome}.${extensao}`,
        situacao: "invalido",
        expiraEm: null,
      },
  );
}
