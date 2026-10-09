"use client";

import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import { ErroAssinatura, imagemParaAssinatura, recortarAssinatura } from "@/lib/contratos/imagemAssinatura";
import { ABA_ATIVA, ABA_INATIVA, ALERTA_ERRO, BOTAO_NEUTRO } from "@/components/ui";
import { IconeImagem, IconeLixeira } from "@/components/Icones";

// Quadro de assinatura: desenhar com o dedo ou o mouse, ou enviar uma
// imagem (foto da assinatura no papel). Devolve um PNG com fundo
// transparente (data URL), ou null quando está vazio.
export default function PadAssinatura({
  onChange,
  id = "assinatura",
}: {
  onChange: (png: string | null) => void;
  id?: string;
}) {
  const [modo, setModo] = useState<"desenhar" | "imagem">("desenhar");
  const [vazio, setVazio] = useState(true);
  const [imagem, setImagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);

  // Ajusta a resolução do quadro à tela (nítido em celular).
  useEffect(() => {
    if (modo !== "desenhar") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ajustar = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 2.6 * dpr;
      }
      setVazio(true);
      onChange(null);
    };
    ajustar();
    const obs = new ResizeObserver(ajustar);
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [modo, onChange]);

  function ponto(e: EventoPonteiro<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
  }

  function comecar(e: EventoPonteiro<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    ultimo.current = ponto(e);
    const ctx = e.currentTarget.getContext("2d");
    if (ctx && ultimo.current) {
      ctx.beginPath();
      ctx.arc(ultimo.current.x, ultimo.current.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#111827";
      ctx.fill();
    }
  }

  function mover(e: EventoPonteiro<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext("2d");
    const p = ponto(e);
    if (ctx && ultimo.current) {
      ctx.beginPath();
      ctx.moveTo(ultimo.current.x, ultimo.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ultimo.current = p;
  }

  function terminar(e: EventoPonteiro<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    desenhando.current = false;
    ultimo.current = null;
    const png = recortarAssinatura(e.currentTarget);
    setVazio(!png);
    onChange(png);
  }

  function limpar() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setVazio(true);
    onChange(null);
  }

  async function escolherArquivo(arquivo: File | undefined) {
    setErro(null);
    if (!arquivo) return;
    try {
      const png = await imagemParaAssinatura(arquivo);
      setImagem(png);
      onChange(png);
    } catch (err) {
      setImagem(null);
      onChange(null);
      setErro(err instanceof ErroAssinatura ? err.message : "Não conseguimos usar essa imagem. Tente outra.");
    }
  }

  function trocarModo(novo: "desenhar" | "imagem") {
    if (novo === modo) return;
    setModo(novo);
    setErro(null);
    setImagem(null);
    setVazio(true);
    onChange(null);
  }

  return (
    <div>
      <div role="tablist" aria-label="Como assinar" className="mb-2 flex border-b border-line">
        {(["desenhar", "imagem"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => trocarModo(m)}
            className={`min-h-11 px-4 text-sm font-semibold transition ${modo === m ? ABA_ATIVA : ABA_INATIVA}`}
          >
            {m === "desenhar" ? "Desenhar" : "Enviar imagem"}
          </button>
        ))}
      </div>

      {modo === "desenhar" ? (
        <div>
          <div className="relative border border-line-strong bg-white">
            <canvas
              ref={canvasRef}
              id={id}
              aria-label="Quadro para assinar com o dedo ou o mouse"
              className="block h-44 w-full cursor-crosshair touch-none sm:h-48"
              onPointerDown={comecar}
              onPointerMove={mover}
              onPointerUp={terminar}
              onPointerCancel={terminar}
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-neutral-400" />
            {vazio && (
              <p aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-neutral-500">
                Assine aqui com o dedo ou o mouse
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">Se não ficar bom, limpe e assine de novo.</p>
            <button type="button" onClick={limpar} className={BOTAO_NEUTRO}>
              <IconeLixeira width={16} height={16} />
              Limpar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className={`${BOTAO_NEUTRO} cursor-pointer`}>
            <IconeImagem width={16} height={16} />
            Escolher imagem
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => escolherArquivo(e.target.files?.[0])}
            />
          </label>
          <p className="mt-2 text-xs text-muted">
            Foto da sua assinatura num papel branco, com caneta escura. O fundo é removido sozinho. JPG, PNG ou WEBP até 5 MB.
          </p>
          {imagem && (
            <div className="mt-3 flex h-36 items-center justify-center border border-line-strong bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagem} alt="Prévia da assinatura" className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </div>
      )}

      {erro && (
        <p role="alert" className={`mt-2 ${ALERTA_ERRO}`}>
          {erro}
        </p>
      )}
    </div>
  );
}
