import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import authBg from "@/assets/auth-bg.png";
import bwildLogo from "@/assets/bwild-logo-transparent.png";
import { z } from "zod";
import { logError, logInfo } from "@/lib/errorLogger";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("Digite um e-mail válido."),
});

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(undefined);

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        parsed.data.email,
        {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        },
      );

      if (error) throw error;

      logInfo("Password reset email sent", { email: parsed.data.email });
      setSent(true);
      toast({
        title: "E-mail enviado",
        description: "Confira sua caixa de entrada para redefinir a senha.",
      });
    } catch (err: any) {
      logError(err, { context: "recuperar-senha" });
      // Por segurança, não revelamos se o e-mail existe ou não.
      setSent(true);
      toast({
        title: "E-mail enviado",
        description:
          "Se o e-mail estiver cadastrado, você receberá um link em instantes.",
      });
    } finally {
      setLoading(false);
    }
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
              Recuperar senha
            </h1>
            <p className="text-sm text-white/70 mt-2 text-center">
              {sent
                ? "Enviamos um link para o seu e-mail."
                : "Informe seu e-mail e enviaremos um link para você redefinir a senha."}
            </p>
          </div>

          {sent ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                <p className="text-sm text-white/80">
                  Verifique sua caixa de entrada (e o spam) e clique no link
                  para criar uma nova senha.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 bg-white/5 text-white border-white/20 hover:bg-white/10"
                onClick={() => navigate("/auth")}
              >
                Voltar para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    disabled={loading}
                    aria-invalid={!!fieldError}
                    aria-describedby={fieldError ? "email-error" : undefined}
                  />
                </div>
                {fieldError && (
                  <p
                    id="email-error"
                    role="alert"
                    className="text-xs text-red-400 mt-1"
                  >
                    {fieldError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold text-base"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>

              <div className="flex justify-center pt-1">
                <Link
                  to="/auth"
                  className="text-xs text-white/80 hover:text-white hover:underline font-medium inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
