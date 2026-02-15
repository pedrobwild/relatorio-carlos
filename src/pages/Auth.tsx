import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Mail, Lock, Eye, EyeOff,
  CalendarClock, FileText, Camera,
  AlertCircle, ShieldCheck, HelpCircle,
} from 'lucide-react';
import bwildLogo from '@/assets/bwild-logo.png';
import { z } from 'zod';
import { logError, logInfo } from '@/lib/errorLogger';

type AppRole = 'engineer' | 'admin' | 'customer';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('Digite um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const redirectBasedOnRole = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      const role = (roleData?.role as AppRole) || 'customer';
      if (role === 'engineer' || role === 'admin') {
        navigate('/gestao', { replace: true });
      } else {
        navigate('/minhas-obras', { replace: true });
      }
    } catch {
      navigate('/minhas-obras', { replace: true });
    }
  };

  useEffect(() => {
    let hasHandledInitialSession = false;
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('Session check failed:', error.message);
        supabase.auth.signOut().catch(() => {});
        setCheckingSession(false);
        return;
      }
      if (session?.user) {
        hasHandledInitialSession = true;
        redirectBasedOnRole(session.user.id);
      }
      setCheckingSession(false);
    }).catch((err) => {
      console.warn('Session check error:', err);
      if (isMounted) setCheckingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        if (event === 'SIGNED_IN' && session?.user && !hasHandledInitialSession) {
          hasHandledInitialSession = true;
          setTimeout(() => {
            if (isMounted) redirectBasedOnRole(session.user.id);
          }, 0);
        }
        if (event === 'SIGNED_OUT') setCheckingSession(false);
      }
    );

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  function validate(): boolean {
    const result = loginSchema.safeParse({ email, password });
    if (result.success) {
      setFieldErrors({});
      return true;
    }
    const errs: { email?: string; password?: string } = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as 'email' | 'password';
      if (!errs[field]) errs[field] = issue.message;
    }
    setFieldErrors(errs);
    return false;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setLoading(true);
    logInfo('Login attempt', { identifierType: 'email' });

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setLoading(false);
        logError('Login failed', error, { component: 'Auth', action: 'login' });

        if (error.message.includes('Invalid login credentials')) {
          setFormError('E-mail ou senha incorretos. Verifique e tente novamente.');
        } else if (error.message.includes('Email not confirmed')) {
          setFormError('Seu acesso ainda não foi ativado. Fale com o suporte para liberar.');
        } else if (/inactive|blocked|disabled/i.test(error.message)) {
          setFormError('Seu acesso está inativo. Fale com o suporte para liberar.');
        } else if (/rate limit/i.test(error.message)) {
          setFormError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else if (/network|fetch|timeout/i.test(error.message)) {
          setFormError('Sem conexão no momento. Verifique sua internet e tente novamente.');
        } else {
          setFormError('Não foi possível entrar. Tente novamente ou fale com o suporte.');
        }
        return;
      }
      logInfo('Login successful');
      // Keep loading=true until redirect via onAuthStateChange
    } catch (error) {
      logError('Unexpected login error', error, { component: 'Auth', action: 'login' });
      setLoading(false);
      setFormError('Não foi possível entrar. Tente novamente ou fale com o suporte.');
    }
  };

  const handlePasswordKeyEvent = (e: React.KeyboardEvent) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  const FEATURES = [
    { icon: CalendarClock, label: 'Cronograma e prazos' },
    { icon: Camera, label: 'Relatórios semanais e fotos' },
    { icon: FileText, label: 'Documentos e aprovações' },
  ] as const;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background p-4 sm:p-8 overflow-y-auto safe-area-top safe-area-bottom">
      <div className="w-full max-w-[420px] space-y-6">
        <Card className="border-border/60 shadow-lg">
          <CardContent className="pt-8 pb-6 px-6 sm:px-8">
            <div className="flex justify-center mb-6">
              <img src={bwildLogo} alt="Bwild" className="h-10" />
            </div>

            <div className="text-center space-y-2 mb-6">
              <h1 className="text-xl font-bold text-foreground leading-tight">
                Acompanhe sua obra em tempo real
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Veja o andamento, prazos, relatórios e documentos da sua obra — tudo em um só lugar.
              </p>
            </div>


            {formError && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 mb-5"
              >
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{formError}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="login-email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-email"
                    data-testid="login-identifier"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    onBlur={() => { if (fieldErrors.email) validate(); }}
                    className="pl-10"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                {fieldErrors.email && (
                  <p id="login-email-error" role="alert" className="text-xs text-destructive mt-1">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Senha</Label>
                  <a
                    href="/recuperar-senha"
                    className="text-xs text-primary hover:underline font-medium"
                    tabIndex={0}
                  >
                    Esqueci minha senha
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-password"
                    data-testid="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    onKeyDown={handlePasswordKeyEvent}
                    onKeyUp={handlePasswordKeyEvent}
                    className="pl-10 pr-10"
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="login-password-error" role="alert" className="text-xs text-destructive mt-1">
                    {fieldErrors.password}
                  </p>
                )}
                {capsLockOn && (
                  <p className="text-xs text-warning flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    Caps Lock está ativado
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={loading}
                data-testid="login-submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Acessar meu portal'
                )}
              </Button>
            </form>

            <Separator className="my-5" />

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Você acompanha aqui:
              </p>
              <ul className="space-y-2.5">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10 shrink-0">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator className="my-5" />

            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4 shrink-0" />
              <span>Problemas para acessar?</span>
              <a href="/suporte" className="text-primary hover:underline font-medium">
                Falar com suporte
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Acesso seguro · LGPD</span>
          </div>
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Bwild · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
