import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, CreditCard } from 'lucide-react';
import bwildLogo from '@/assets/bwild-logo.png';

type AppRole = 'engineer' | 'admin' | 'customer';
type LoginIdentifierType = 'email' | 'cpf';

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

export default function Auth() {
  const [loginIdentifierType, setLoginIdentifierType] = useState<LoginIdentifierType>('email');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
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
    } catch (err) {
      // Default to customer route
      navigate('/minhas-obras', { replace: true });
    }
  };

  useEffect(() => {
    // Track if we've already handled initial session to prevent double redirects
    let hasHandledInitialSession = false;

    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only redirect on actual sign-in events, not token refresh
        // TOKEN_REFRESHED happens when switching tabs and should NOT trigger redirect
        if (event === 'SIGNED_IN' && session?.user && !hasHandledInitialSession) {
          hasHandledInitialSession = true;
          // Defer the redirect to avoid Supabase deadlock
          setTimeout(() => {
            redirectBasedOnRole(session.user.id);
          }, 0);
        }
        setCheckingSession(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        hasHandledInitialSession = true;
        redirectBasedOnRole(session.user.id);
      }
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const getLoginEmail = (): string => {
    if (loginIdentifierType === 'cpf') {
      return cpfToEmail(loginIdentifier);
    }
    return loginIdentifier;
  };

  const handleLoginIdentifierChange = (value: string) => {
    if (loginIdentifierType === 'cpf') {
      setLoginIdentifier(formatCPF(value));
    } else {
      setLoginIdentifier(value);
    }
  };

  const validateLoginForm = () => {
    if (loginIdentifierType === 'email') {
      if (!loginIdentifier || !loginIdentifier.includes('@')) {
        toast({
          title: 'Email inválido',
          description: 'Por favor, insira um email válido.',
          variant: 'destructive',
        });
        return false;
      }
    } else {
      const digits = loginIdentifier.replace(/\D/g, '');
      if (digits.length !== 11) {
        toast({
          title: 'CPF inválido',
          description: 'Por favor, insira um CPF válido com 11 dígitos.',
          variant: 'destructive',
        });
        return false;
      }
    }
    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const validateSignupForm = () => {
    if (!email || !email.includes('@')) {
      toast({
        title: 'Email inválido',
        description: 'Por favor, insira um email válido.',
        variant: 'destructive',
      });
      return false;
    }
    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;

    const loginEmail = getLoginEmail();

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Credenciais inválidas',
            description: loginIdentifierType === 'cpf' 
              ? 'CPF ou senha incorretos. Verifique e tente novamente.'
              : 'Email ou senha incorretos. Verifique e tente novamente.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro ao entrar',
            description: error.message,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignupForm()) return;

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName || email.split('@')[0],
            role: 'customer',
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            title: 'Email já cadastrado',
            description: 'Este email já está registrado. Tente fazer login.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro ao criar conta',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Conta criada com sucesso!',
          description: 'Você será redirecionado automaticamente.',
        });
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={bwildLogo} alt="Bwild" className="h-10" />
          </div>
          <div>
            <CardTitle className="text-2xl">Portal Bwild</CardTitle>
            <CardDescription className="mt-2">
              Acesse sua conta para gerenciar obras e acompanhar projetos.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Entrar com</Label>
                  <Select 
                    value={loginIdentifierType} 
                    onValueChange={(v) => {
                      setLoginIdentifierType(v as LoginIdentifierType);
                      setLoginIdentifier('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="cpf">CPF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                      type="text"
                      placeholder={loginIdentifierType === 'email' ? 'seu@email.com' : '000.000.000-00'}
                      value={loginIdentifier}
                      onChange={(e) => handleLoginIdentifierChange(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
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

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Seu nome"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
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
        </CardContent>
      </Card>
    </div>
  );
}
