import { exigirAdminPagina } from "@/lib/admin/acesso";
import { PACOTE_SITES, PLANOS } from "@/lib/planos";
import { formatarUsd, PRECOS_USD_POR_MILHAO } from "@/lib/sites/custos";
import { MSG_FALTA_ETAPA23, MSG_FALTA_ETAPA24, faltaEtapa23 } from "@/lib/sites/dados";
import { MODELO_PADRAO, iaConfigurada } from "@/lib/sites/ia";
import Interruptor from "./Interruptor";
import { FalhaCarregar, Numero, Secao, Tabela, dataDoDia, dataHora, inteiro } from "../comum";

export const dynamic = "force-dynamic";

interface Aguardando {
  ativa: boolean;
  atualizado_em: string | null;
  assinantes: { user_id: string; email: string | null; apelido: string | null; desde: string | null }[];
}

interface SitesIA {
  mes: string;
  geracoes: number;
  ajustes_gratis: number;
  ajustes_cobrados: number;
  falhas: number;
  custo_usd: number;
  custo_medio_geracao_usd: number;
  custo_medio_ajuste_usd: number;
  duracao_media_ms: number;
  usuarios: number;
  assinantes_platina: number;
  pacotes_vendidos: number;
  por_modelo: { modelo: string; chamadas: number; custo_usd: number }[];
  por_dia: { dia: string; chamadas: number; custo_usd: number }[];
  top_usuarios: { user_id: string; email: string | null; apelido: string | null; chamadas: number; geracoes: number; custo_usd: number }[];
  ultimas: {
    id: number;
    criado_em: string;
    email: string | null;
    site: string | null;
    tipo: string;
    status: string;
    modelo: string | null;
    tokens_entrada: number | null;
    tokens_saida: number | null;
    custo_usd: number | null;
    duracao_ms: number | null;
    erro: string | null;
  }[];
}

const NOME_TIPO: Record<string, string> = { geracao: "Geração", ajuste: "Ajuste grátis", ajuste_cobrado: "Ajuste cobrado" };
const NOME_STATUS: Record<string, string> = { reservada: "Gerando", concluida: "Concluída", falhou: "Falhou" };

// Câmbio só para dar uma ideia em reais. Ajuste se o dólar mudar muito.
const DOLAR_EM_REAIS = 5.5;

// Gestão > Sites IA: quanto a geração de sites com IA custa (etapa 23).
// Cada chamada à IA fica em sites_geracoes com usuário, data, modelo,
// tokens e custo estimado pelo servidor.
export default async function SitesIAPage() {
  const supabase = await exigirAdminPagina();
  const [ia, espera] = await Promise.all([supabase.rpc("admin_sites_ia"), supabase.rpc("admin_platina_aguardando")]);

  // Interruptor e quem espera a liberação (etapa 24).
  const blocoInterruptor = espera.error ? (
    <p className="text-ink-2">{faltaEtapa23(espera.error.code) ? MSG_FALTA_ETAPA24 : "Não foi possível ler o interruptor agora."}</p>
  ) : (
    <BlocoInterruptor dados={espera.data as Aguardando} />
  );

  if (ia.error) {
    return (
      <div>
        {blocoInterruptor}
        <div className="mt-6">
          {faltaEtapa23(ia.error.code) ? <p className="text-ink-2">{MSG_FALTA_ETAPA23}</p> : <FalhaCarregar error={ia.error} />}
        </div>
      </div>
    );
  }
  const s = ia.data as SitesIA;
  const custo = Number(s.custo_usd);
  const receitaPlatina = s.assinantes_platina * PLANOS.platina.preco + s.pacotes_vendidos * PACOTE_SITES.preco;
  const custoReais = custo * DOLAR_EM_REAIS;
  const maior = Math.max(1, ...s.por_dia.map((d) => Number(d.custo_usd)));
  const modeloAtual = process.env.SITES_IA_MODELO?.trim() || MODELO_PADRAO;

  return (
    <div>
      <Secao titulo="Interruptor">{blocoInterruptor}</Secao>

      <Secao titulo="Neste mês" descricao="Mês corrente, horário de Brasília. Custo estimado pelos tokens que a IA informou.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero rotulo="Sites gerados" valor={inteiro(Number(s.geracoes))} dica={`${inteiro(Number(s.usuarios))} usuário(s)`} />
          <Numero
            rotulo="Ajustes"
            valor={inteiro(Number(s.ajustes_gratis) + Number(s.ajustes_cobrados))}
            dica={`${inteiro(Number(s.ajustes_gratis))} grátis · ${inteiro(Number(s.ajustes_cobrados))} cobrados`}
          />
          <Numero
            rotulo="Custo da IA"
            valor={formatarUsd(custo)}
            dica={`≈ ${custoReais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (US$ 1 = R$ ${DOLAR_EM_REAIS.toLocaleString("pt-BR")})`}
          />
          <Numero rotulo="Falhas" valor={inteiro(Number(s.falhas))} dica="O saldo do usuário voltou" />
          <Numero rotulo="Custo médio por geração" valor={formatarUsd(Number(s.custo_medio_geracao_usd), 3)} />
          <Numero rotulo="Custo médio por ajuste" valor={formatarUsd(Number(s.custo_medio_ajuste_usd), 3)} />
          <Numero
            rotulo="Tempo médio"
            valor={`${(Number(s.duracao_media_ms) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} s`}
            dica="Da chamada à IA até o site pronto"
          />
          <Numero
            rotulo="Platina"
            valor={inteiro(Number(s.assinantes_platina))}
            dica={`assinantes ativos · ${inteiro(Number(s.pacotes_vendidos))} pacote(s) de sites no mês`}
          />
        </div>
        {receitaPlatina > 0 && (
          <p className="mt-3 text-sm text-ink-2">
            O custo da IA no mês equivale a{" "}
            <strong className="text-ink">
              {((custoReais / receitaPlatina) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </strong>{" "}
            da receita do Platina (mensalidades ativas + pacotes de sites do mês).
          </p>
        )}
      </Secao>

      <Secao titulo="Custo por dia">
        {s.por_dia.length === 0 ? (
          <p className="text-sm text-ink-2">Nenhuma chamada à IA neste mês ainda.</p>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Dia</th>
                <th className="text-right">Chamadas</th>
                <th className="text-right">Custo</th>
                <th className="w-1/3" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {[...s.por_dia].reverse().map((d) => (
                <tr key={d.dia}>
                  <td>{dataDoDia(d.dia)}</td>
                  <td className="text-right tabular-nums">{inteiro(Number(d.chamadas))}</td>
                  <td className="text-right tabular-nums">{formatarUsd(Number(d.custo_usd))}</td>
                  <td aria-hidden="true">
                    <div className="h-2 bg-destaque" style={{ width: `${Math.max(2, (Number(d.custo_usd) / maior) * 100)}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Secao>

      <Secao
        titulo="Por modelo"
        descricao={`Modelo em uso: ${modeloAtual} (variável SITES_IA_MODELO). Pedidos que a IA recusa podem ser refeitos pela Anthropic num modelo alternativo; eles aparecem aqui com o nome desse modelo.`}
      >
        {s.por_modelo.length === 0 ? (
          <p className="text-sm text-ink-2">Nenhuma chamada neste mês.</p>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Modelo</th>
                <th className="text-right">Chamadas</th>
                <th className="text-right">Custo</th>
              </tr>
            </thead>
            <tbody>
              {s.por_modelo.map((m) => (
                <tr key={m.modelo}>
                  <td>{m.modelo}</td>
                  <td className="text-right tabular-nums">{inteiro(Number(m.chamadas))}</td>
                  <td className="text-right tabular-nums">{formatarUsd(Number(m.custo_usd))}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
        <p className="mt-2 text-xs text-muted">
          Preços usados (US$ por milhão de tokens, entrada/saída):{" "}
          {Object.entries(PRECOS_USD_POR_MILHAO)
            .map(([m, p]) => `${m} ${p.entrada}/${p.saida}`)
            .join(" · ")}
          . Ajuste em lib/sites/custos.ts se a Anthropic mudar a tabela.
        </p>
      </Secao>

      <Secao titulo="Quem mais gasta" descricao="Os 10 usuários com maior custo de IA neste mês.">
        {s.top_usuarios.length === 0 ? (
          <p className="text-sm text-ink-2">Ninguém usou a geração de sites neste mês.</p>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Usuário</th>
                <th className="text-right">Chamadas</th>
                <th className="text-right">Gerações</th>
                <th className="text-right">Custo</th>
              </tr>
            </thead>
            <tbody>
              {s.top_usuarios.map((u) => (
                <tr key={u.user_id ?? "sem-usuario"}>
                  <td>
                    <span className="block font-semibold text-ink">{u.apelido ?? "—"}</span>
                    <span className="block text-xs text-muted">{u.email ?? "conta apagada"}</span>
                  </td>
                  <td className="text-right tabular-nums">{inteiro(Number(u.chamadas))}</td>
                  <td className="text-right tabular-nums">{inteiro(Number(u.geracoes))}</td>
                  <td className="text-right tabular-nums">{formatarUsd(Number(u.custo_usd))}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Secao>

      <Secao titulo="Últimas chamadas" descricao="As 30 mais recentes, de qualquer mês.">
        {s.ultimas.length === 0 ? (
          <p className="text-sm text-ink-2">Nenhuma chamada ainda.</p>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Usuário</th>
                <th>Site</th>
                <th>Tipo</th>
                <th>Situação</th>
                <th>Modelo</th>
                <th className="text-right">Tokens (entrada/saída)</th>
                <th className="text-right">Custo</th>
              </tr>
            </thead>
            <tbody>
              {s.ultimas.map((g) => (
                <tr key={g.id}>
                  <td className="whitespace-nowrap">{dataHora(g.criado_em)}</td>
                  <td className="text-xs">{g.email ?? "—"}</td>
                  <td>{g.site ?? "—"}</td>
                  <td>{NOME_TIPO[g.tipo] ?? g.tipo}</td>
                  <td title={g.erro ?? undefined}>
                    {NOME_STATUS[g.status] ?? g.status}
                    {g.erro && <span className="block max-w-56 truncate text-xs text-danger">{g.erro}</span>}
                  </td>
                  <td className="text-xs">{g.modelo ?? "—"}</td>
                  <td className="text-right tabular-nums">
                    {g.tokens_entrada != null ? `${inteiro(g.tokens_entrada)} / ${inteiro(g.tokens_saida ?? 0)}` : "—"}
                  </td>
                  <td className="text-right tabular-nums">{g.custo_usd != null ? formatarUsd(Number(g.custo_usd), 3) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Secao>
    </div>
  );
}

function BlocoInterruptor({ dados }: { dados: Aguardando }) {
  const assinantes = dados.assinantes ?? [];
  return (
    <div className="flex flex-col gap-3">
      <Interruptor ativa={dados.ativa} aguardando={assinantes.length} chaveConfigurada={iaConfigurada()} />
      {!dados.ativa && assinantes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-destaque">
            {assinantes.length === 1
              ? "1 assinante Platina está esperando a liberação"
              : `${inteiro(assinantes.length)} assinantes Platina estão esperando a liberação`}{" "}
            (prometido: em até 24 horas após a assinatura).
          </p>
          <Tabela>
            <thead>
              <tr>
                <th>Assinante</th>
                <th>No Platina desde</th>
              </tr>
            </thead>
            <tbody>
              {assinantes.map((a) => (
                <tr key={a.user_id}>
                  <td>
                    <span className="block font-semibold text-ink">{a.apelido ?? "—"}</span>
                    <span className="block text-xs text-muted">{a.email ?? "sem e-mail"}</span>
                  </td>
                  <td>{a.desde ? dataHora(a.desde) : "colocado pela Gestão"}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </div>
      )}
      {dados.atualizado_em && (
        <p className="text-xs text-muted">Última mudança: {dataHora(dados.atualizado_em)} (fica na auditoria).</p>
      )}
    </div>
  );
}
