import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Mail, Lock, Eye, EyeOff,
  AlertCircle, ShieldCheck, HelpCircle,
} from 'lucide-react';
import authBg from '@/assets/auth-bg.png';
import bwildLogo from '@/assets/bwild-logo-transparent.png';
import workflowLogo from '@/assets/bwild-workflow-manager.png';
import { z } from 'zod';
import { logError, logInfo, logWarn } from '@/lib/errorLogger';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('Digite um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email') ?? '';
  const prefillPassword = searchParams.get('password') ?? '';
  const isDemoPrefill = !!prefillEmail && !!prefillPassword;
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState(prefillPassword);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const hasRedirectedRef = useRef(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const redirectBasedOnRole = async (userId: string) => {
    try {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const isStaff = (roleRows ?? []).some(({ role }) =>
        ['engineer', 'admin', 'manager', 'gestor', 'suprimentos', 'financeiro'].includes(role)
      );

      if (isStaff) {
        navigate('/gestao', { replace: true });
      } else {
        navigate('/minhas-obras', { replace: true });
      }
    } catch {
      navigate('/minhas-obras', { replace: true });
    }
  };

  const redirectOnce = async (userId: string) => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    await redirectBasedOnRole(userId);
  };

  useEffect(() => {
    let isMounted = true;
    let sessionCheckTimeout: number | null = null;

    const finishSessionCheck = () => {
      if (!isMounted) return;
      setCheckingSession(false);
      if (sessionCheckTimeout !== null) {
        window.clearTimeout(sessionCheckTimeout);
        sessionCheckTimeout = null;
      }
    };

    // Failsafe: if backend session check hangs, unblock UI and show login form
    sessionCheckTimeout = window.setTimeout(() => {
      if (!isMounted) return;
      logWarn('Session check timeout on /auth, forcing login form display', {
        component: 'Auth',
        action: 'session_check_timeout',
      });
      setCheckingSession(false);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          finishSessionCheck();
          setTimeout(() => {
            if (isMounted) void redirectOnce(session.user.id);
          }, 0);
        }

        if (event === 'SIGNED_OUT') {
          hasRedirectedRef.current = false;
          finishSessionCheck();
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('Session check failed:', error.message);
        supabase.auth.signOut().catch(() => {});
        finishSessionCheck();
        return;
      }

      if (session?.user) {
        void redirectOnce(session.user.id);
        return;
      }

      finishSessionCheck();
    }).catch((err) => {
      console.warn('Session check error:', err);
      finishSessionCheck();
    });

    return () => {
      isMounted = false;
      if (sessionCheckTimeout !== null) {
        window.clearTimeout(sessionCheckTimeout);
      }
      subscription.unsubscribe();
    };
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
      const { data, error } = await supabase.auth.signInWithPassword({
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

      const signedInUserId = data.user?.id ?? data.session?.user?.id;
      if (signedInUserId) {
        await redirectOnce(signedInUserId);
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

  return (
    <div
      className="min-h-[100dvh] flex relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${authBg})` }}
    >
      {/* Form – centered on mobile, left on desktop */}
      <div className="flex flex-col justify-center items-stretch w-full md:max-w-lg px-5 sm:px-12 md:px-16 py-10 sm:py-16 safe-area-top safe-area-bottom mx-auto md:mx-0">
        <div className="w-full max-w-[220px] sm:max-w-[280px] md:max-w-[340px] lg:max-w-[380px] mx-auto md:mx-0 mb-8 sm:mb-10 self-center md:self-start aspect-[16/5]">
          <img
            src={workflowLogo}
            alt="Bwild Workflow Manager"
            className="block w-full h-auto object-contain"
            onError={(e) => {
              const img = e.currentTarget;
              img.style.display = 'none';
              const fallback = img.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div
            role="img"
            aria-label="Bwild Workflow Manager"
            style={{ display: 'none' }}
            className="w-full h-16 sm:h-20 md:h-24 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white text-lg sm:text-xl md:text-2xl font-semibold tracking-tight"
          >
            Bwild<span className="text-[#366478]">.</span>
          </div>
        </div>

        {isDemoPrefill && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3.5 mb-6 w-full"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-100">
              <p className="font-medium">Acesso à obra demo pré-preenchido</p>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Basta clicar em <strong>Entrar</strong> para visualizar o orçamento na obra demo.
              </p>
            </div>
          </div>
        )}

        {formError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 rounded-lg border border-red-400/30 bg-red-500/10 p-3.5 mb-6 w-full"
          >
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{formError}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 w-full" data-testid="login-form" noValidate>
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-white flex items-center gap-1.5 text-sm font-medium">
              <Mail className="h-3.5 w-3.5" /> E-mail
            </Label>
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
              className="h-12 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus-visible:ring-white/40 focus-visible:border-white/50 text-base"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              disabled={loading}
              autoFocus
            />
            {fieldErrors.email && (
              <p id="login-email-error" role="alert" className="text-xs text-red-400 mt-1">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password" className="text-white flex items-center gap-1.5 text-sm font-medium">
              <Lock className="h-3.5 w-3.5" /> Senha
            </Label>
            <div className="relative">
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
                className="h-12 bg-white/10 border-white/30 text-white placeholder:text-white/50 pr-11 focus-visible:ring-white/40 focus-visible:border-white/50 text-base"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                disabled={loading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="login-password-error" role="alert" className="text-xs text-red-400 mt-1">
                {fieldErrors.password}
              </p>
            )}
            {capsLockOn && (
              <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                Caps Lock está ativado
              </p>
            )}
          </div>

          <div className="flex justify-center pt-1">
            <Link
              to="/recuperar-senha"
              className="text-xs text-white/80 hover:text-white hover:underline font-medium"
              tabIndex={0}
            >
              Esqueci minha senha
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold text-base"
            disabled={loading}
            data-testid="login-submit"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-1.5 text-sm text-white/70 w-full">
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span>Problemas?</span>
          <a
            href="https://web.whatsapp.com/send?phone=5521989362122&text=Ol%C3%A1%2C%20tive%20uma%20dificuldade%20com%20meu%20acesso%20ao%20portal%20de%20jornada%20de%20obra%20da%20bwild%20e%20preciso%20de%20ajuda."
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/90 hover:text-white hover:underline font-medium"
          >
            Falar com suporte
          </a>
        </div>

        <div className="mt-6 flex flex-col items-center gap-1 w-full text-center">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Acesso seguro · LGPD</span>
          </div>
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Bwild · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
