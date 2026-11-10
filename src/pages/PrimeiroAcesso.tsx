import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Mail,
} from "lucide-react";
import authBg from "@/assets/auth-bg.webp";
import bwildLogo from "@/assets/bwild-logo-transparent.png";
import { z } from "zod";
import { logError, logInfo } from "@/lib/errorLogger";
import { accessInvitesRepo, type AccessInviteInfo } from "@/infra/repositories";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .max(72, "Senha muito longa."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

const STATUS_MESSAGE: Record<string, string> = {
  invalid: "Link inválido. Confira se abriu o link completo que recebeu.",
  used: "Este link já foi usado. Se você já criou sua senha, é só entrar.",
  expired: "Este link expirou. Peça um novo link à equipe Bwild.",
};

/**
 * Primeiro acesso do cliente: abre o link enviado pela equipe, cria a senha
 * e já entra no portal. O token só é consumido ao salvar (pré-visualização
 * de link do WhatsApp/e-mail não gasta o convite).
 */
export default function PrimeiroAcesso() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const navigate = useNavigate();

  const [invite, setInvite] = useState<AccessInviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setInvite({ status: "invalid", email: null, displayName: null });
      return;
    }
    accessInvitesRepo.getAccessInvite(token).then((result) => {
      if (cancelled) return;
      if (result.error) {
        logError("Falha ao validar link de primeiro acesso", result.error, {
          component: "PrimeiroAcesso",
        });
        setLoadError("Não foi possível validar o link. Tente novamente.");
        return;
      }
      setInvite(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const errs: typeof fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof typeof errs;
        if (!errs[key]) errs[key] = issue.message;
      });
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const result = await accessInvitesRepo.redeemAccessInvite(
        token,
        parsed.data.password,
      );
      if (result.error || !result.data) {
        setFormError(accessInvitesRepo.describeAccessInviteError(result.error));
        return;
      }

      logInfo("First access password created");
      setDone(true);

      // Entra direto com a senha recém-criada.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.data,
        password: parsed.data.password,
      });
      if (signInError) {
        logError("Falha no login após primeiro acesso", signInError, {
          component: "PrimeiroAcesso",
        });
        setTimeout(() => navigate("/auth", { replace: true }), 1800);
        return;
      }
      setTimeout(() => navigate("/", { replace: true }), 1200);
    } catch (err) {
      logError("Falha ao criar senha no primeiro acesso", err, {
        component: "PrimeiroAcesso",
      });
      setFormError("Não foi possível salvar a senha. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const renderBody = () => {
    if (loadError) {
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-amber-400" />
          <p className="text-sm text-white/80">{loadError}</p>
        </div>
      );
    }

    if (!invite) {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-6 w-6 animate-spin text-white/70" />
          <p className="text-sm text-white/70">Validando link...</p>
        </div>
      );
    }

    if (done) {
      return (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <p className="text-sm text-white/80">
            Senha criada! Entrando no portal...
          </p>
        </div>
      );
    }

    if (invite.status !== "valid") {
      return (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-amber-400" />
            <p className="text-sm text-white/80">
              {STATUS_MESSAGE[invite.status] ?? STATUS_MESSAGE.invalid}
            </p>
          </div>
          <Button
            type="button"
            className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold"
            onClick={() => navigate("/auth")}
          >
            Ir para o login
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-5">
        {invite.email && (
          <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white/80 flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-white/60" />
            <span>
              Seu login: <strong className="text-white">{invite.email}</strong>
            </span>
          </div>
        )}

        {/* Ajuda o gerenciador de senhas a salvar o par e-mail + senha. */}
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={invite.email ?? ""}
          readOnly
          hidden
        />

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/90">
            Crie sua senha
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="pl-10 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              disabled={saving}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p
              id="password-error"
              role="alert"
              className="text-xs text-red-400 mt-1"
            >
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-white/90">
            Confirme a senha
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              disabled={saving}
              aria-invalid={!!fieldErrors.confirm}
              aria-describedby={
                fieldErrors.confirm ? "confirm-error" : undefined
              }
            />
          </div>
          {fieldErrors.confirm && (
            <p
              id="confirm-error"
              role="alert"
              className="text-xs text-red-400 mt-1"
            >
              {fieldErrors.confirm}
            </p>
          )}
        </div>

        {formError && (
          <p
            role="alert"
            className="text-sm text-red-400 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{formError}</span>
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold text-base"
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Criar senha e entrar"
          )}
        </Button>
      </form>
    );
  };

  const firstName = invite?.displayName?.trim().split(/\s+/)[0];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-slate-900"
      style={{
        backgroundImage: `linear-gradient(rgba(15,23,42,0.7), rgba(15,23,42,0.85)), url(${authBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Card className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border-white/10 shadow-2xl">
        <CardContent className="p-8">
          <div className="flex flex-col items-center mb-6">
            <img width={1000} height={400} src={bwildLogo} alt="BWild" className="h-12 mb-4 w-auto" />
            <h1 className="text-2xl font-semibold text-white text-center">
              {firstName && invite?.status === "valid"
                ? `Bem-vindo(a), ${firstName}`
                : "Primeiro acesso"}
            </h1>
            <p className="text-sm text-white/70 mt-2 text-center">
              Crie sua senha para acompanhar sua obra no Portal Bwild.
            </p>
          </div>
          {renderBody()}
        </CardContent>
      </Card>
    </div>
  );
}
