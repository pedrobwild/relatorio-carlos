import { Link, useNavigate } from "react-router-dom";
import { LogOut, User, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import bwildLogo from "@/assets/bwild-logo-dark.png";

interface AppHeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
}

export function AppHeader({
  showBackButton,
  onBack,
  children,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { user, loading, signOut, isAuthenticated } = useAuth();

  const handleSignOut = async () => {
    // CRITICAL: signOut already cleans up local state and the onAuthStateChange
    // listener will handle the SIGNED_OUT event. We only navigate AFTER the
    // entire signOut process completes to prevent ERR_ABORTED on the /logout request.
    try {
      await signOut();
      // Only navigate after signOut fully completes (state already cleared)
      navigate("/auth", { replace: true });
    } catch (error) {
      // Even on error, signOut's finally block clears local state, so we can navigate
      console.warn("Sign out error (non-blocking):", error);
      navigate("/auth", { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-header bg-background/95 backdrop-blur border-b border-border-subtle pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 pl-safe pr-safe">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {showBackButton && onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                aria-label="Voltar"
                className="shrink-0 h-11 w-11 rounded-full hover:bg-primary/10 active:bg-primary/15 active:scale-[0.94] transition-transform"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Button>
            )}
            <Link
              to="/"
              className="shrink-0 inline-flex items-center"
              aria-label="Início"
            >
              <img src={bwildLogo} alt="Bwild" className="h-7 sm:h-8" />
            </Link>
            {children}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {loading ? (
              <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
            ) : isAuthenticated ? (
              <>
                <ErrorBoundary
                  name="NotificationBell"
                  feature="general"
                  fallback={null}
                >
                  <NotificationBell />
                </ErrorBoundary>

                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground ml-2">
                  <User className="h-4 w-4" />
                  <span>{user?.email?.split("@")[0]}</span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  aria-label="Sair"
                  className="h-10 sm:h-9"
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Entrar"
                  className="h-10 sm:h-9"
                >
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
