import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Mail, Lock, User, CreditCard, Eye, EyeOff,
  CalendarClock, FileText, Camera, ShieldCheck, HelpCircle,
  AlertCircle,
} from 'lucide-react';
import bwildLogo from '@/assets/bwild-logo.png';
import { z } from 'zod';
import { logError, logInfo } from '@/lib/errorLogger';

type AppRole = 'engineer' | 'admin' | 'customer';
type LoginIdentifierType = 'email' | 'cpf';

// Validation schemas
const emailLoginSchema = z.object({
  email: z.string().trim().min(1, 'Email obrigatório').email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const cpfLoginSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const signupSchema = z.object({
  email: z.string().trim().min(1, 'Email obrigatório').email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(128, 'Senha muito longa'),
  displayName: z.string().trim().max(100, 'Nome muito longo').optional(),
});

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function cpfToEmail(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  return `${digits}@cpf.bwild.com.br`;
}

const FEATURES = [
  { icon: CalendarClock, label: 'Cronograma e prazos' },
  { icon: FileText, label: 'Relatórios semanais' },
  { icon: Camera, label: 'Fotos da obra' },
  { icon: ShieldCheck, label: 'Documentos e contratos' },
] as const;

export default function Auth() {
  const [loginIdentifierType, setLoginIdentifierType] = useState<LoginIdentifierType>('email');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
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

  const getLoginEmail = (): string => {
    if (loginIdentifierType === 'cpf') return cpfToEmail(loginIdentifier);
    return loginIdentifier;
  };

  const handleLoginIdentifierChange = (value: string) => {
    if (loginIdentifierType === 'cpf') {
      setLoginIdentifier(formatCPF(value));
    } else {
      setLoginIdentifier(value);
    }
  };

  const validateLoginForm = (): boolean => {
    try {
      if (loginIdentifierType === 'email') {
        emailLoginSchema.parse({ email: loginIdentifier, password });
      } else {
        const digits = loginIdentifier.replace(/\D/g, '');
        cpfLoginSchema.parse({ cpf: digits, password });
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({ title: 'Dados inválidos', description: firstError.message, variant: 'destructive' });
        logInfo('Login validation failed', { field: firstError.path.join('.'), error: firstError.message });
      }
      return false;
    }
  };

  const validateSignupForm = (): boolean => {
    try {
      signupSchema.parse({ email, password, displayName: displayName || undefined });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({ title: 'Dados inválidos', description: firstError.message, variant: 'destructive' });
        logInfo('Signup validation failed', { field: firstError.path.join('.'), error: firstError.message });
      }
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;
    const loginEmail = getLoginEmail();
    setLoading(true);
    logInfo('Login attempt', { identifierType: loginIdentifierType });

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) {
        setLoading(false);
        logError('Login failed', error, { component: 'Auth', action: 'login', identifierType: loginIdentifierType });
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Credenciais inválidas',
            description: loginIdentifierType === 'cpf'
              ? 'CPF ou senha incorretos. Verifique e tente novamente.'
              : 'Email ou senha incorretos. Verifique e tente novamente.',
            variant: 'destructive',
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast({ title: 'Email não verificado', description: 'Verifique seu email antes de fazer login.', variant: 'destructive' });
        } else {
          toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
        }
        return;
      }
      logInfo('Login successful');
    } catch (error) {
      logError('Unexpected login error', error, { component: 'Auth', action: 'login' });
      setLoading(false);
      toast({ title: 'Erro', description: 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignupForm()) return;
    setLoading(true);
    logInfo('Signup attempt', { email: email.substring(0, 3) + '***' });

    try {
      const redirectUrl = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { display_name: displayName || email.split('@')[0], role: 'customer' },
        },
      });
      if (error) {
        setLoading(false);
        logError('Signup failed', error, { component: 'Auth', action: 'signup' });
        if (error.message.includes('already registered')) {
          toast({ title: 'Email já cadastrado', description: 'Este email já está registrado. Tente fazer login.', variant: 'destructive' });
        } else if (error.message.includes('rate limit')) {
          toast({ title: 'Muitas tentativas', description: 'Aguarde alguns minutos antes de tentar novamente.', variant: 'destructive' });
        } else {
          toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' });
        }
        return;
      }
      setLoading(false);
      logInfo('Signup successful');
      toast({ title: 'Conta criada com sucesso!', description: 'Verifique seu email para confirmar o cadastro antes de fazer login.' });
    } catch (error) {
      logError('Unexpected signup error', error, { component: 'Auth', action: 'signup' });
      setLoading(false);
      toast({ title: 'Erro', description: 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
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
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-background">
      {/* ===== Left panel — branding / value prop (hidden on mobile, shown lg+) ===== */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between bg-primary p-10 text-primary-foreground">
        <div>
          <img src={bwildLogo} alt="Bwild" className="h-9 brightness-0 invert" />
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              Acompanhe sua obra em tempo real
            </h1>
            <p className="text-primary-foreground/75 text-base leading-relaxed max-w-sm">
              Veja andamento, prazos, relatórios e documentos da sua obra — tudo em um só lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-primary-foreground/10 px-4 py-3">
                <Icon className="h-5 w-5 shrink-0 text-primary-foreground/80" />
                <span className="text-sm font-medium text-primary-foreground/90">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} Bwild · Todos os direitos reservados
        </p>
      </div>

      {/* ===== Right panel — auth form ===== */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto safe-area-top safe-area-bottom">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <img src={bwildLogo} alt="Bwild" className="h-9" />
            <p className="text-sm text-muted-foreground text-center">
              Acompanhe sua obra em tempo real
            </p>
          </div>

          <Card className="border-border/60 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl">Portal Bwild</CardTitle>
              <CardDescription>
                Entre com o e-mail cadastrado pela Bwild.
              </CardDescription>
            </CardHeader>

            <CardContent className="pb-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>

                {/* ===== LOGIN TAB ===== */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
                    {/* Identifier type */}
                    <div className="space-y-2">
                      <Label>Entrar com</Label>
                      <Select
                        value={loginIdentifierType}
                        onValueChange={(v) => {
                          setLoginIdentifierType(v as LoginIdentifierType);
                          setLoginIdentifier('');
                        }}
                      >
                        <SelectTrigger data-testid="login-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="cpf">CPF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Identifier input */}
                    <div className="space-y-2">
                      <Label htmlFor="login-identifier">
                        {loginIdentifierType === 'email' ? 'Email' : 'CPF'}
                      </Label>
                      <div className="relative">
                        {loginIdentifierType === 'email' ? (
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        ) : (
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        )}
                        <Input
                          id="login-identifier"
                          data-testid="login-identifier"
                          type={loginIdentifierType === 'email' ? 'email' : 'text'}
                          inputMode={loginIdentifierType === 'email' ? 'email' : 'numeric'}
                          autoComplete={loginIdentifierType === 'email' ? 'email' : 'off'}
                          autoCapitalize="none"
                          autoCorrect="off"
                          placeholder={loginIdentifierType === 'email' ? 'seu@email.com' : '000.000.000-00'}
                          value={loginIdentifier}
                          onChange={(e) => handleLoginIdentifierChange(e.target.value)}
                          className="pl-10"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          data-testid="login-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={handlePasswordKeyEvent}
                          onKeyUp={handlePasswordKeyEvent}
                          className="pl-10 pr-10"
                          required
                          minLength={6}
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
                      {capsLockOn && (
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Caps Lock está ativado
                        </p>
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
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
                </TabsContent>

                {/* ===== SIGNUP TAB ===== */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4" data-testid="signup-form">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nome</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          data-testid="signup-name"
                          type="text"
                          autoComplete="name"
                          placeholder="Seu nome"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="pl-10"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          data-testid="signup-email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          data-testid="signup-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Mínimo 6 caracteres"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={handlePasswordKeyEvent}
                          onKeyUp={handlePasswordKeyEvent}
                          className="pl-10 pr-10"
                          required
                          minLength={6}
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
                      {capsLockOn && (
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Caps Lock está ativado
                        </p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={loading} data-testid="signup-submit">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando conta...
                        </>
                      ) : (
                        'Criar conta'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <Separator className="my-5" />

              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
                <span>Precisa de ajuda?</span>
                <a href="/suporte" className="text-primary hover:underline font-medium ml-1">
                  Fale com o suporte
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Footer copyright (mobile) */}
          <p className="text-center text-xs text-muted-foreground lg:hidden">
            © {new Date().getFullYear()} Bwild · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
