import { exigirAdminPagina } from "@/lib/admin/acesso";
import {
  LIMITE_DEVOLUCOES_MES,
  MSG_FALTA_ETAPA20,
  ROTULO_MOTIVO,
  ROTULO_SEM_DEVOLUCAO,
  type MotivoInvalido,
  type SemDevolucao,
} from "@/lib/leads/invalido";
import { FalhaCarregar, NOME_PLANO, Numero, Secao, Tabela, dataHora, inteiro } from "../comum";

export const dynamic = "force-dynamic";

interface Painel {
  mes: string;
  marcados_mes: number;
  devolvidos_mes: number;
  sem_devolucao_mes: Partial<Record<SemDevolucao, number>>;
  por_motivo_mes: Partial<Record<MotivoInvalido, number>>;
  usuarios_mes: number;
  desbloqueios_mes: number;
  marcados_total: number;
  devolvidos_total: number;
  quem_mais_marca: {
    user_id: string;
    email: string | null;
    apelido: string | null;
    plano: string | null;
    marcados: number;
    devolvidos: number;
  }[];
  recentes: {
    id: number;
    criado_em: string;
    place_id: string;
    motivo: MotivoInvalido;
    credito_devolvido: boolean;
    sem_devolucao: SemDevolucao | null;
    desbloqueado_em: string | null;
    email: string | null;
    apelido: string | null;
  }[];
}

function porcento(parte: number, total: number) {
  if (!total) return "—";
  return (parte / total).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 });
}

// Link do Maps a partir do place_id (o nome do lead não fica guardado,
// pela política de cache do Google).
function linkMaps(placeId: string) {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

function quem(u: { apelido: string | null; email: string | null }) {
  return u.apelido ? `@${u.apelido}` : (u.email ?? "—");
}

// Gestão > Leads inválidos: marcações "empresa não existe mais" e
// "telefone não atende" feitas em Meus leads, e os créditos devolvidos
// (função admin_leads_invalidos, etapa 20).
export default async function LeadsInvalidosPage() {
  const supabase = await exigirAdminPagina();
  const { data, error } = await supabase.rpc("admin_leads_invalidos", { p_limite: 100 });
  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code ?? "")) {
      return <p className="text-ink-2">{MSG_FALTA_ETAPA20}</p>;
    }
    return <FalhaCarregar error={error} />;
  }
  const p = data as Painel;
  const semLimite = p.sem_devolucao_mes.limite_mes ?? 0;
  const semPrazo = p.sem_devolucao_mes.fora_do_prazo ?? 0;

  return (
    <div>
      <Secao titulo="Neste mês">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero
            rotulo="Leads marcados como inválidos"
            valor={inteiro(p.marcados_mes)}
            dica={`${porcento(p.marcados_mes, p.desbloqueios_mes)} dos ${inteiro(p.desbloqueios_mes)} desbloqueios do mês`}
          />
          <Numero
            rotulo="Créditos devolvidos"
            valor={inteiro(p.devolvidos_mes)}
            dica={`Limite de ${LIMITE_DEVOLUCOES_MES} por usuário por mês`}
          />
          <Numero
            rotulo="Marcados sem devolução"
            valor={inteiro(semLimite + semPrazo)}
            dica={`${inteiro(semLimite)} por limite do mês · ${inteiro(semPrazo)} fora do prazo`}
          />
          <Numero rotulo="Usuários que marcaram" valor={inteiro(p.usuarios_mes)} />
        </div>
        <p className="mt-3 text-sm text-ink-2">
          Por motivo: {ROTULO_MOTIVO.nao_existe.toLowerCase()} {inteiro(p.por_motivo_mes.nao_existe ?? 0)} ·{" "}
          {ROTULO_MOTIVO.nao_atende.toLowerCase()} {inteiro(p.por_motivo_mes.nao_atende ?? 0)}. Desde o início:{" "}
          {inteiro(p.marcados_total)} marcados e {inteiro(p.devolvidos_total)} créditos devolvidos.
        </p>
      </Secao>

      <Secao titulo="Quem mais marca" descricao="Os 10 usuários com mais marcações neste mês. Muita marcação pode ser abuso ou um nicho ruim.">
        {p.quem_mais_marca.length === 0 ? (
          <p className="text-sm text-ink-2">Ninguém marcou lead inválido neste mês ainda.</p>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Plano</th>
                <th className="text-right">Marcados</th>
                <th className="text-right">Devolvidos</th>
              </tr>
            </thead>
            <tbody>
              {p.quem_mais_marca.map((u) => (
                <tr key={u.user_id}>
                  <td className="break-all">{quem(u)}</td>
                  <td>{NOME_PLANO[u.plano ?? ""] ?? u.plano ?? "—"}</td>
                  <td className="text-right tabular-nums">{inteiro(u.marcados)}</td>
                  <td className="text-right tabular-nums">{inteiro(u.devolvidos)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Secao>

      <Secao titulo="Últimas marcações" descricao="As 100 mais recentes. O link abre o lead no Google Maps.">
        {p.recentes.length === 0 ? (
          <p className="text-sm text-ink-2">Nenhuma marcação ainda.</p>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Usuário</th>
                <th>Motivo</th>
                <th>Crédito</th>
                <th>Lead</th>
              </tr>
            </thead>
            <tbody>
              {p.recentes.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{dataHora(r.criado_em)}</td>
                  <td className="break-all">{quem(r)}</td>
                  <td>{ROTULO_MOTIVO[r.motivo] ?? r.motivo}</td>
                  <td>
                    {r.credito_devolvido
                      ? "Devolvido"
                      : `Não devolvido${r.sem_devolucao ? ` (${ROTULO_SEM_DEVOLUCAO[r.sem_devolucao]})` : ""}`}
                  </td>
                  <td>
                    <a
                      href={linkMaps(r.place_id)}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex min-h-11 items-center font-semibold text-destaque underline-offset-2 hover:underline"
                    >
                      Ver no Maps
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Secao>
    </div>
  );
}
