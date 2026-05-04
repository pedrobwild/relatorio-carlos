import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserWithRole } from "@/hooks/useUsers";
import type { AppRole } from "@/hooks/useUserRole";
import { roleLabels, roleColors } from "./types";

const roles: AppRole[] = [
  "admin",
  "manager",
  "engineer",
  "arquitetura",
  "cs",
  "customer",
];

export function RoleSelector({
  user,
  onRoleChange,
}: {
  user: UserWithRole;
  onRoleChange: (userId: string, role: AppRole) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Badge variant="outline" className={roleColors[user.role]}>
            {roleLabels[user.role]}
          </Badge>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {roles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => onRoleChange(user.id, role)}
            className="gap-2"
          >
            {user.role === role && <Check className="h-4 w-4" />}
            <Badge variant="outline" className={roleColors[role]}>
              {roleLabels[role]}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
