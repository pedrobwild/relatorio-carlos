import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, Settings, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import bwildLogo from '@/assets/bwild-logo-dark.png';

interface AppHeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
}

export function AppHeader({ showBackButton, onBack, children }: AppHeaderProps) {
  const navigate = useNavigate();
  const { user, loading, signOut, isAuthenticated } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const handleSignOut = async () => {
    // CRITICAL: signOut already cleans up local state and the onAuthStateChange
    // listener will handle the SIGNED_OUT event. We only navigate AFTER the
    // entire signOut process completes to prevent ERR_ABORTED on the /logout request.
    try {
      await signOut();
      // Only navigate after signOut fully completes (state already cleared)
      navigate('/auth', { replace: true });
    } catch (error) {
      // Even on error, signOut's finally block clears local state, so we can navigate
      console.warn('Sign out error (non-blocking):', error);
      navigate('/auth', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBackButton && onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
            )}
            <Link to="/">
              <img src={bwildLogo} alt="Bwild" className="h-8" />
            </Link>
            {children}
          </div>

          <div className="flex items-center gap-2">
            {loading || roleLoading ? (
              <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
            ) : isAuthenticated ? (
              <>
                {/* Admin Settings Button */}
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate('/admin')}
                    className="gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Configurações</span>
                  </Button>
                )}
                
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground ml-2">
                  <User className="h-4 w-4" />
                  <span>{user?.email?.split('@')[0]}</span>
                </div>
                
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="outline" size="sm">
                  <LogIn className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Entrar</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
