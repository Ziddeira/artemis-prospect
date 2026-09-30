import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarTexto, ErroGooglePlaces } from "@/lib/leads/google";
import { registrarErro } from "@/lib/erros/registrar";
import { semContato } from "@/lib/leads/ultimaBusca";
import { avaliacaoMaisRecente, calcularConfianca, fechadoDefinitivo } from "@/lib/leads/confianca";
import { dominiosDoPais } from "@/lib/leads/dominios";
import { codigoEstado, codigoPaisDoEndereco, escolherFuso } from "@/lib/leads/fuso";
import { PAISES, PAIS_PADRAO, ehPaisInternacional, type ConfigPais } from "@/lib/leads/paises";
import {
  classificar,
  ehModo,
  extrairBairro,
  nomePlataforma,
  pontuarLead,
  telefoneDoLugar,
  whatsappDoLugar,
  type LeadResultado,
  type Modo,
  type PlaceBruto,
} from "@/lib/leads/classificacao";

// A busca chama o Google várias vezes (até 3 páginas por termo × região)
// e espera entre páginas para o nextPageToken ficar válido — pode
// passar bem do limite padrão de execução.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMITE_PAGINAS = 3;
const ESPERA_PROXIMA_PAGINA_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function dividirLista(valor: unknown): string[] {
  if (typeof valor !== "string") return [];
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const parte of valor.split(",")) {
    const item = parte.trim();
    const chave = item.toLowerCase();
    if (item && !vistos.has(chave)) {
      vistos.add(chave);
      resultado.push(item);
    }
  }
  return resultado;
}

function limparMensagemPostgres(msg: string): string {
  return msg.replace(/^ERROR:\s*/i, "");
}

// "barber shop in Austin TX, United States". O nome do país no fim evita
// que o Google traga uma cidade de mesmo nome em outro país.
function montarConsulta(termo: string, area: string, pais: ConfigPais): string {
  const consulta = `${termo} ${pais.conectorBusca} ${area}`;
  if (!pais.nomeNaBusca || area.toLowerCase().includes(pais.nomeNaBusca.toLowerCase())) return consulta;
  return `${consulta}, ${pais.nomeNaBusca}`;
}

const MSG_FALTA_ETAPA21 =
  "A aba Internacional ainda não foi ativada no banco. Rode os scripts supabase/etapa21-1 e etapa21-2 no Supabase.";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { erro: "Supabase não configurado neste ambiente." },
      { status: 500 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "É preciso estar logado." }, { status: 401 });
  }

  let corpo: { nicho?: string; areas?: string; modo?: string; pais?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const termos = dividirLista(corpo.nicho);
  const areas = dividirLista(corpo.areas);
  const modo: Modo = ehModo(corpo.modo) ? corpo.modo : "negocios";
  const internacional = modo === "internacional";
  if (internacional && !ehPaisInternacional(corpo.pais)) {
    return NextResponse.json({ erro: "Escolha o país da busca." }, { status: 400 });
  }
  const pais = PAISES[internacional && ehPaisInternacional(corpo.pais) ? corpo.pais : PAIS_PADRAO];

  if (!termos.length) {
    return NextResponse.json({ erro: "Digite ao menos um nicho." }, { status: 400 });
  }
  if (!areas.length) {
    return NextResponse.json({ erro: "Digite ao menos uma região." }, { status: 400 });
  }
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { erro: "GOOGLE_PLACES_API_KEY não configurada no servidor." },
      { status: 500 },
    );
  }

  // Confere saldo, plano e o limite de 10 buscas/minuto, e já desconta
  // tudo de uma vez (função SQL "security definer" — tudo ou nada). A
  // regra de cobrança é a mesma em todos os modos: 1 busca por termo ×
  // região. O país só vai quando a busca é internacional, para Negócios e
  // Hospedagem continuarem funcionando mesmo antes do SQL da etapa 21.
  const { data: saldoBruto, error: erroSaldo } = await supabase.rpc("iniciar_busca", {
    p_termos: termos,
    p_areas: areas,
    p_modo: modo,
    ...(internacional ? { p_pais: pais.codigo } : {}),
  });

  if (erroSaldo) {
    // Função sem o parâmetro p_pais (PGRST202) ou modo recusado = etapa
    // 21 não rodada.
    const faltaEtapa21 =
      internacional && (erroSaldo.code === "PGRST202" || /Modo de busca inválido/.test(erroSaldo.message));
    return NextResponse.json(
      { erro: faltaEtapa21 ? MSG_FALTA_ETAPA21 : limparMensagemPostgres(erroSaldo.message) },
      { status: faltaEtapa21 ? 503 : 400 },
    );
  }

  // Sites de terceiros comuns no país (Gestão > Sites de terceiros).
  const dominios = await dominiosDoPais(supabase, pais.codigo);

  const buscasRestantes = typeof saldoBruto === "number" ? saldoBruto : Number(saldoBruto);

  const porId = new Map<string, LeadResultado>();
  const brutoPorId = new Map<string, PlaceBruto>();
  // Empresas que o Google marca como fechadas definitivamente: não
  // entram no resultado (nem na busca salva). Só a quantidade é contada.
  const fechadosIds = new Set<string>();
  // Empresas de outro país (ex.: "London" do Reino Unido numa busca no
  // Canadá): ficam de fora, o usuário escolheu o país.
  const deOutroPaisIds = new Set<string>();
  let chamadasGoogle = 0;
  const registrosChamada: PromiseLike<unknown>[] = [];
  let aviso: string | null = null;

  try {
    for (const area of areas) {
      for (const termo of termos) {
        const consulta = montarConsulta(termo, area, pais);
        let token: string | undefined;
        let pagina = 0;
        do {
          if (token) await sleep(ESPERA_PROXIMA_PAGINA_MS);
          const dados = await buscarTexto(consulta, pais, token);
          chamadasGoogle++;
          registrosChamada.push(
            supabase
              .from("chamadas_google")
              .insert({ user_id: user.id, tipo: "places_text_search" }),
          );
          for (const lugar of dados.places || []) {
            if (!lugar.id || porId.has(lugar.id)) continue;
            if (fechadoDefinitivo(lugar.businessStatus)) {
              fechadosIds.add(lugar.id);
              continue;
            }
            const paisDoLugar = codigoPaisDoEndereco(lugar.addressComponents);
            if (internacional && paisDoLugar && paisDoLugar !== pais.codigo) {
              deOutroPaisIds.add(lugar.id);
              continue;
            }
            porId.set(lugar.id, montarLead(lugar, area, modo, pais, dominios));
            brutoPorId.set(lugar.id, lugar);
          }
          token = dados.nextPageToken;
          pagina++;
        } while (token && pagina < LIMITE_PAGINAS);
      }
    }
  } catch (e) {
    aviso =
      e instanceof ErroGooglePlaces
        ? `A busca parou antes do fim: ${e.message}`
        : "A busca parou antes do fim por um erro inesperado.";
    if (!(e instanceof ErroGooglePlaces)) console.error("[leads/buscar]", e);
    await registrarErro(
      "busca",
      `A busca parou antes do fim: ${e instanceof Error ? e.message : String(e)}`,
      { termos, areas, modo, pais: pais.codigo, chamadas_google: chamadasGoogle, leads_ate_parar: porId.size },
      user.id,
    );
  }

  // Para quem já tinha desbloqueado algum desses leads antes, mostra o
  // contato direto (já foi pago) sem precisar clicar em Desbloquear de
  // novo e sem chamar o Place Details — os dados já vieram nesta mesma
  // resposta de busca de texto.
  if (porId.size) {
    const ids = [...porId.keys()];
    const { data: jaDesbloqueados } = await supabase
      .from("leads_desbloqueados")
      .select("place_id")
      .eq("user_id", user.id)
      .in("place_id", ids);
    for (const linha of jaDesbloqueados || []) {
      const lead = porId.get(linha.place_id);
      const bruto = brutoPorId.get(linha.place_id);
      if (lead && bruto) {
        lead.contato = {
          telefone: telefoneDoLugar(pais, bruto),
          whatsapp: whatsappDoLugar(pais, bruto),
          site: bruto.websiteUri || null,
          maps: bruto.googleMapsUri || null,
        };
      }
    }
  }

  await Promise.allSettled(registrosChamada);

  const leads = [...porId.values()].sort((a, b) => b.pontuacao - a.pontuacao);

  // Guarda esta busca (já cobrada) como a última do usuário, no lugar da
  // anterior, para a página Buscar recarregar o resultado sem gastar
  // busca nem chamar o Google. Vai sem os contatos. Se falhar (ex.: SQL da
  // etapa 15 não rodado), o resultado aparece normalmente, só não fica
  // salvo.
  const { data: salvoBruto, error: erroSalvar } = await supabase.rpc("salvar_ultima_busca", {
    p_termos: termos,
    p_areas: areas,
    p_modo: modo,
    p_leads: semContato(leads),
    p_aviso: aviso,
    ...(internacional ? { p_pais: pais.codigo } : {}),
  });
  if (erroSalvar) console.error("[leads/buscar] salvar_ultima_busca", erroSalvar.message);
  const salvo = (Array.isArray(salvoBruto) ? salvoBruto[0] : salvoBruto) as
    | { feita_em: string; expira_em: string }
    | null;

  return NextResponse.json({
    leads,
    buscasRestantes,
    chamadasGoogle,
    aviso,
    fechadosOcultos: fechadosIds.size,
    deOutroPais: deOutroPaisIds.size,
    termos,
    areas,
    modo,
    pais: internacional ? pais.codigo : null,
    feitaEm: salvo?.feita_em ?? new Date().toISOString(),
    expiraEm: salvo?.expira_em ?? null,
  });
}

function montarLead(
  p: PlaceBruto,
  area: string,
  modo: Modo,
  pais: ConfigPais,
  dominios: string[],
): LeadResultado {
  const situacao = classificar(p.websiteUri, dominios);
  const celular = whatsappDoLugar(pais, p);
  const temTelefone = !!(p.nationalPhoneNumber || p.internationalPhoneNumber);
  const ehPlataforma = situacao === "booking" || situacao === "rede_social";
  return {
    id: p.id,
    nome: p.displayName?.text || "Sem nome",
    bairro: extrairBairro(p.addressComponents, p.formattedAddress),
    nota: p.rating || 0,
    avaliacoes: p.userRatingCount || 0,
    situacao,
    plataforma: ehPlataforma && p.websiteUri ? nomePlataforma(p.websiteUri) : null,
    tipo: p.primaryTypeDisplayName?.text || "",
    aberto: !p.businessStatus || p.businessStatus === "OPERATIONAL",
    temCelular: !!celular,
    temTelefone,
    pontuacao: pontuarLead({
      avaliacoes: p.userRatingCount || 0,
      nota: p.rating || 0,
      situacao,
      // Onde WhatsApp não é o costume, o canal que conta é o telefone.
      celular: pais.whatsapp ? !!celular : temTelefone,
      temHorario: !!p.regularOpeningHours,
    }),
    confianca: calcularConfianca({
      status: p.businessStatus,
      ultimaAvaliacao: avaliacaoMaisRecente(p.reviews),
      avaliacoes: p.userRatingCount || 0,
      temHorario: !!p.regularOpeningHours,
      temTelefone,
    }),
    area,
    modo,
    ...(modo === "internacional"
      ? { pais: pais.codigo, fuso: escolherFuso(pais, codigoEstado(p.addressComponents), p.utcOffsetMinutes) }
      : {}),
    // Os dados de contato em si (telefone, whatsapp, site, maps) nunca
    // são preenchidos aqui: só depois do usuário desbloquear o lead.
    contato: null,
  };
}
