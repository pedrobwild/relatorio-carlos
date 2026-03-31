import { useNavigate } from 'react-router-dom';
import { LogOut, User, Home, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Compact user menu — avatar icon that opens a dropdown with:
 * - User email
 * - Link to home (minhas-obras or gestão)
 * - Admin settings (if admin)
 * - Logout
 */
export function UserMenu() {
  const navigate = useNavigate();
  const { user, signOut, isAuthenticated } = useAuth();
  const { isAdmin, isStaff, roles } = useUserRole();

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    manager: 'Gestor',
    engineer: 'Engenheiro',
    gestor: 'Supervisor',
    suprimentos: 'Suprimentos',
    financeiro: 'Financeiro',
    customer: 'Cliente',
  };

  const primaryRoleLabel = roles.length > 0 ? ROLE_LABELS[roles[0]] || roles[0] : null;

  if (!isAuthenticated) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch {
      navigate('/auth', { replace: true });
    }
  };

  const homePath = isStaff ? '/gestao' : '/minhas-obras';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-9 sm:w-9 rounded-full hover:bg-primary/10 shrink-0"
          aria-label="Menu do usuário"
        >
          <User className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">
            {user?.email?.split('@')[0]}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.email}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(homePath)}>
          <Home className="mr-2 h-4 w-4" />
          Minhas Obras
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onClick={() => navigate('/admin')}>
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
