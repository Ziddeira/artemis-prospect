import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Avatar, Tracinhos } from "../componentes/Conversa";
import { progresso } from "../componentes/util";
import { COR, FONTE_TEXTO, FONTE_TITULO } from "../marca";

// Cena 2, segunda parte: a lista de contatos que nunca responderam,
// sendo riscada um por um, bem rápido.
const CONTATOS = [
  { nome: "Barbearia do Zé", iniciais: "BZ", hora: "seg" },
  { nome: "Studio Bella Unhas", iniciais: "SB", hora: "seg" },
  { nome: "Pousada Mar Azul", iniciais: "PM", hora: "ter" },
  { nome: "Oficina do Beto", iniciais: "OB", hora: "ter" },
  { nome: "Doceria da Ana", iniciais: "DA", hora: "qua" },
  { nome: "Pet Shop Amigo", iniciais: "PA", hora: "qua" },
  { nome: "Clínica Sorriso", iniciais: "CS", hora: "qui" },
];

// Quadro (desde o começo da lista) em que cada risco começa.
export const MOMENTOS_RISCOS = CONTATOS.map((_, i) => 4 + i * 5);

export const TelaListaRiscada: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: COR.fundo, fontFamily: FONTE_TEXTO }}>
      <div style={{ position: "absolute", top: 86, left: 30, right: 30 }}>
        <div style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 46, color: COR.branco }}>Conversas</div>
        <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600, color: COR.risco }}>
          {CONTATOS.length} sem resposta
        </div>
      </div>
      <div style={{ position: "absolute", top: 200, left: 0, right: 0 }}>
        {CONTATOS.map((c, i) => {
          const risco = progresso(frame, MOMENTOS_RISCOS[i], MOMENTOS_RISCOS[i] + 5);
          return (
            <div
              key={c.nome}
              style={{
                position: "relative",
                height: 122,
                padding: "0 28px",
                display: "flex",
                alignItems: "center",
                gap: 20,
                borderBottom: `1px solid ${COR.divisoria}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  flex: 1,
                  minWidth: 0,
                  opacity: 1 - risco * 0.6,
                }}
              >
                <Avatar iniciais={c.iniciais} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 27, color: COR.branco }}>{c.nome}</span>
                    <span style={{ fontSize: 19, color: COR.texto3 }}>{c.hora}</span>
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 22,
                      color: COR.texto2,
                    }}
                  >
                    <Tracinhos estado="enviada" />
                    Você: oi, tudo bem?
                  </div>
                </div>
              </div>
              {/* O risco, que cresce da esquerda para a direita */}
              <div
                style={{
                  position: "absolute",
                  left: 22,
                  top: "50%",
                  height: 5,
                  marginTop: -2,
                  width: `calc((100% - 44px) * ${risco})`,
                  background: COR.risco,
                  transform: "rotate(-1.2deg)",
                  transformOrigin: "0 50%",
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
