import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { User, Phone, Mail, ChevronDown, Pencil } from "lucide-react";

interface TeamContactPopoverProps {
  role: string;
  name: string;
  phone: string;
  email: string;
  crea?: string;
  photoUrl?: string;
  isStaff: boolean;
  onEdit: () => void;
}

export function TeamContactPopover({
  role,
  name,
  phone,
  email,
  crea,
  photoUrl,
  isStaff,
  onEdit,
}: TeamContactPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 hover:bg-accent/50 p-1.5 rounded-lg transition-colors"
          aria-label={`Ver contato de ${name}`}
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={photoUrl} alt={name} />
            <AvatarFallback className="bg-accent text-accent-foreground">
              <User className="w-3 h-3" />
            </AvatarFallback>
          </Avatar>
          <div>
            <span className="font-medium text-xs text-foreground">{role}:</span>{" "}
            <span className="text-xs text-muted-foreground">{name}</span>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        {/* Header with photo and edit button */}
        <div className="flex items-center gap-3 mb-3 pb-2 border-b border-border">
          <Avatar className="h-12 w-12">
            <AvatarImage src={photoUrl} alt={name} />
            <AvatarFallback className="bg-accent text-accent-foreground">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {name}
            </p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
          {isStaff && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0"
              onClick={onEdit}
              aria-label={`Editar ${role}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <div className="space-y-1.5">
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{email}</span>
            </a>
          )}
          {phone && (
            <a
              href={`tel:+55${phone.replace(/\D/g, "")}`}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="w-3 h-3 flex-shrink-0" />
              <span>{phone}</span>
            </a>
          )}
          {crea && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
              <span className="font-medium">CREA:</span>
              <span>{crea}</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
