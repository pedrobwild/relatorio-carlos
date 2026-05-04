import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { UserWithRole } from "@/hooks/useUsers";
import type { AppRole } from "@/hooks/useUserRole";
import { RoleSelector } from "./RoleSelector";
import { EditUserDialog } from "./EditUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

export function UserCard({
  user,
  onRoleChange,
  onDelete,
  onEdit,
  onResetPassword,
}: {
  user: UserWithRole;
  onRoleChange: (userId: string, role: AppRole) => void;
  onDelete: (userId: string) => void;
  onEdit: (
    userId: string,
    data: { display_name?: string; email?: string },
  ) => Promise<boolean>;
  onResetPassword: (userId: string, newPassword: string) => Promise<boolean>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">
              {user.display_name || user.email}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {user.email}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Desde{" "}
              {format(new Date(user.created_at), "dd 'de' MMM, yyyy", {
                locale: ptBR,
              })}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <RoleSelector user={user} onRoleChange={onRoleChange} />
            <EditUserDialog user={user} onSave={onEdit} />
            <ResetPasswordDialog user={user} onReset={onResetPassword} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deletar usuário?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O usuário{" "}
                    <strong>{user.email}</strong> será permanentemente removido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(user.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Deletar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
