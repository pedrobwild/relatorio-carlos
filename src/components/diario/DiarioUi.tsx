/**
 * Peças do Diário de obra: botões grandes para tocar em pé, na obra, com a
 * luva ou a mão suja. Alvos de toque de 48 px para cima; estado sempre dito
 * em texto além da cor.
 */
import { useId, useRef, useState, type ReactNode } from "react";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { atalhosDeData, ddmm } from "@/lib/diarioObra/regras";

export type Tom = "padrao" | "ok" | "info" | "alerta";

const LIGADO: Record<Tom, string> = {
  padrao: "border-primary bg-primary text-primary-foreground",
  ok: "border-success bg-success text-success-foreground",
  info: "border-info bg-info text-info-foreground",
  alerta: "border-destructive bg-destructive text-destructive-foreground",
};

const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function Cartao({ children, erro, className }: { children: ReactNode; erro?: boolean; className?: string }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4",
        erro ? "border-destructive" : "border-border",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Rotulo({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  const cls = cn("text-xs font-bold uppercase tracking-wide text-muted-foreground", className);
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {children}
    </label>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export const Nota = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn("text-sm font-medium leading-snug text-muted-foreground", className)}>{children}</p>
);

export const Erro = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="text-sm font-semibold text-destructive">
    {children}
  </p>
);

/** Lista do que falta, no topo da tela, depois de tentar avançar. */
export function FaixaDeErros({ titulo, itens, children }: { titulo: string; itens?: string[]; children?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col gap-1.5 rounded-2xl border border-destructive bg-destructive/10 p-4">
      <p className="text-sm font-semibold text-destructive">{titulo}</p>
      {itens?.map((t) => (
        <p key={t} className="text-sm font-medium text-destructive">
          {t}
        </p>
      ))}
      {children}
    </div>
  );
}

interface OpcaoProps {
  children: ReactNode;
  ativo?: boolean;
  tom?: Tom;
  /** Borda vermelha: falta responder. */
  falta?: boolean;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Botão grande de escolha (56 px). */
export function Opcao({ children, ativo, tom = "padrao", falta, onClick, className, disabled, ariaLabel }: OpcaoProps) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-[56px] items-center justify-center gap-2 rounded-xl border-2 px-4 text-center text-base font-semibold transition-colors",
        FOCO,
        ativo ? LIGADO[tom] : cn("bg-card text-foreground", falta ? "border-destructive" : "border-border"),
        disabled && "opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Escolha menor (48 px), para listas. */
export function Chip({ children, ativo, tom = "padrao", falta, onClick, className }: OpcaoProps) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "flex min-h-[48px] items-center justify-center rounded-xl border-2 px-3.5 text-[15px] font-semibold transition-colors",
        FOCO,
        ativo ? LIGADO[tom] : cn("bg-card text-foreground", falta ? "border-destructive" : "border-border"),
        className,
      )}
    >
      {children}
    </button>
  );
}

export const Fileira = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-2">{children}</div>;

export const LinkBotao = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn("min-h-[44px] rounded-lg px-1 text-[15px] font-bold text-primary underline-offset-4 hover:underline", FOCO)}
  >
    {children}
  </button>
);

export function CampoTexto(props: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  erro?: boolean;
  ariaLabel?: string;
}) {
  return (
    <input
      id={props.id}
      type="text"
      value={props.value}
      maxLength={props.maxLength}
      placeholder={props.placeholder}
      aria-label={props.ariaLabel}
      aria-invalid={props.erro || undefined}
      onChange={(e) => props.onChange(e.target.value)}
      className={cn(
        "min-h-[56px] w-full rounded-xl border-2 bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground",
        FOCO,
        props.erro ? "border-destructive" : "border-border",
      )}
    />
  );
}

/** Atalhos de data (amanhã, +2, +3, +7) e "Outra data". Valor em yyyy-mm-dd. */
export function CampoData(props: { hoje: string; value: string | null; onChange: (iso: string) => void; falta?: boolean }) {
  const id = useId();
  const atalhos = atalhosDeData(props.hoje);
  const fora = props.value && !atalhos.some((a) => a.iso === props.value);
  return (
    <>
      <Fileira>
        {atalhos.map((a) => (
          <Chip key={a.iso} ativo={props.value === a.iso} falta={props.falta && !props.value} onClick={() => props.onChange(a.iso)}>
            {a.label}
          </Chip>
        ))}
        {fora && props.value && (
          <Chip ativo onClick={() => undefined}>
            Escolhida · {ddmm(props.value)}
          </Chip>
        )}
      </Fileira>
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        Outra data
      </label>
      <input
        id={id}
        type="date"
        min={props.hoje}
        value={fora && props.value ? props.value : ""}
        onChange={(e) => e.target.value && props.onChange(e.target.value)}
        className={cn("min-h-[56px] w-full rounded-xl border-2 border-border bg-card px-3.5 text-base text-foreground", FOCO)}
      />
    </>
  );
}

async function comprimir(file: File): Promise<Blob> {
  try {
    const mod = await import("browser-image-compression");
    return await mod.default(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: "image/jpeg",
    });
  } catch {
    return file;
  }
}

/**
 * Um toque abre a câmera; a foto é comprimida e fica no aparelho até o envio.
 * Com foto: "Foto anexada · refazer".
 */
export function BotaoFoto(props: {
  temFoto: boolean;
  rotulo: string;
  falta?: boolean;
  onFoto: (blob: Blob) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFalhou(false);
    if (!file.type.startsWith("image/")) {
      setFalhou(true);
      return;
    }
    setOcupado(true);
    try {
      props.onFoto(await comprimir(file));
    } finally {
      setOcupado(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={ocupado}
        onClick={() => ref.current?.click()}
        className={cn(
          "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border-2 px-4 text-base font-semibold transition-colors",
          FOCO,
          props.temFoto
            ? "border-success bg-success/10 text-foreground"
            : props.falta
              ? "border-destructive bg-card text-destructive"
              : "border-border bg-card text-foreground",
        )}
      >
        {ocupado ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Camera className="h-5 w-5" aria-hidden="true" />}
        <span>{props.temFoto ? "Foto anexada · refazer" : props.rotulo}</span>
      </button>
      {falhou && <Erro>Esse arquivo não é uma foto. Tente de novo.</Erro>}
    </>
  );
}

const SELO: Record<Tom | "neutro", string> = {
  padrao: "bg-primary text-primary-foreground",
  ok: "bg-success text-success-foreground",
  info: "bg-info text-info-foreground",
  alerta: "bg-destructive text-destructive-foreground",
  neutro: "bg-muted text-muted-foreground",
};

export const Selo = ({ children, tom }: { children: ReactNode; tom: Tom | "neutro" }) => (
  <span className={cn("shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-bold", SELO[tom])}>{children}</span>
);

export const TOM_STATUS = { concluida: "ok", andamento: "info", impedida: "alerta" } as const;
