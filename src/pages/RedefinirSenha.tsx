import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import authBg from "@/assets/auth-bg.png";
import bwildLogo from "@/assets/bwild-logo-transparent.png";
import { z } from "zod";
import { logError, logInfo, logWarn } from "@/lib/errorLogger";

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

export default function RedefinirSenha() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(
    null,
  );
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Quando o usuário chega via link de recuperação, o Supabase define a sessão
  // automaticamente e dispara um evento PASSWORD_RECOVERY. Verificamos se há
  // sessão ativa para permitir a troca da senha.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setHasRecoverySession(!!data.session);
      } catch {
        if (!cancelled) setHasRecoverySession(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(!!session);
      }
    });

    check();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

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

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) throw error;

      logInfo("Password updated via recovery flow");
      setDone(true);
      toast({
        title: "Senha redefinida",
        description: "Sua nova senha foi salva. Você já está conectado.",
      });

      // Pequeno delay para o usuário ler a confirmação visual
      setTimeout(() => navigate("/auth", { replace: true }), 1800);
    } catch (err: any) {
      logError(err, { context: "redefinir-senha" });
      setFormError(
        err?.message?.includes("expired")
          ? "O link expirou. Solicite um novo link de recuperação."
          : "Não foi possível atualizar a senha. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderBody = () => {
    if (hasRecoverySession === null) {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-6 w-6 animate-spin text-white/70" />
          <p className="text-sm text-white/70">Validando link...</p>
        </div>
      );
    }

    if (!hasRecoverySession) {
      logWarn("Reset password page opened without recovery session");
      return (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-amber-400" />
            <p className="text-sm text-white/80">
              Este link é inválido ou expirou. Solicite um novo link de
              recuperação.
            </p>
          </div>
          <Button
            type="button"
            className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold"
            onClick={() => navigate("/recuperar-senha")}
          >
            Solicitar novo link
          </Button>
        </div>
      );
    }

    if (done) {
      return (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <p className="text-sm text-white/80">
            Senha alterada com sucesso. Redirecionando...
          </p>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/90">
            Nova senha
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
              disabled={loading}
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
            Confirmar nova senha
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
              disabled={loading}
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
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar nova senha"
          )}
        </Button>
      </form>
    );
  };

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
            <img src={bwildLogo} alt="BWild" className="h-12 mb-4" />
            <h1 className="text-2xl font-semibold text-white">
              Definir nova senha
            </h1>
            <p className="text-sm text-white/70 mt-2 text-center">
              Crie uma senha forte para acessar o portal.
            </p>
          </div>
          {renderBody()}
        </CardContent>
      </Card>
    </div>
  );
}
