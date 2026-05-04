import {
  Edit2,
  Trash2,
  Users,
  ArrowRight,
  Mail,
  Phone,
  Plus,
  ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JourneyTeamMember } from "@/hooks/useJourneyTeamMembers";

const teamContentVariants = {
  collapsed: { height: 0, opacity: 0, overflow: "hidden" as const },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "visible" as const,
    transition: {
      height: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: "hidden" as const,
    transition: {
      height: {
        duration: 0.25,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
      opacity: { duration: 0.15 },
    },
  },
};

interface MobilizacaoTeamCardProps {
  members: JourneyTeamMember[];
  isAdmin: boolean;
  teamExpanded: boolean;
  setTeamExpanded: (v: boolean) => void;
  onAdd: () => void;
  onEdit: (m: JourneyTeamMember) => void;
  onRemove: (id: string) => void;
}

export function MobilizacaoTeamCard({
  members,
  isAdmin,
  teamExpanded,
  setTeamExpanded,
  onAdd,
  onEdit,
  onRemove,
}: MobilizacaoTeamCardProps) {
  return (
    <Card className="transition-shadow duration-200 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6"
        onClick={() => setTeamExpanded(!teamExpanded)}
        role="button"
        aria-expanded={teamExpanded}
        aria-label="Equipe Bwild"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setTeamExpanded(!teamExpanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary shrink-0">
            <Users className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">
              Equipe Bwild
            </h3>
            <p className="text-xs text-primary font-medium">
              Conheça quem cuida do seu projeto
            </p>
          </div>
          <motion.div
            animate={{ rotate: teamExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {teamExpanded && (
          <motion.div
            key="team-content"
            variants={teamContentVariants}
            initial="collapsed"
            animate="expanded"
            exit="exit"
          >
            <CardContent className="space-y-4 pt-0 px-4 pb-5 md:px-6 md:pb-6">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum membro cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <TeamMemberCard
                      key={member.id}
                      member={member}
                      isAdmin={isAdmin}
                      onEdit={() => onEdit(member)}
                      onRemove={() => onRemove(member.id)}
                    />
                  ))}
                </div>
              )}

              {isAdmin && (
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar membro do time
                </Button>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function TeamMemberCard({
  member,
  isAdmin,
  onEdit,
  onRemove,
}: {
  member: JourneyTeamMember;
  isAdmin: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 relative">
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Editar"
          >
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
            aria-label="Remover"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar className="h-14 w-14 border-2 border-primary/20 shrink-0">
          <AvatarImage
            src={member.photo_url || undefined}
            alt={member.display_name}
            className="object-cover"
          />
          <AvatarFallback className="text-sm bg-primary/10">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 space-y-1">
          <div>
            <p className="font-semibold text-sm">{member.display_name}</p>
            <p className="text-xs text-primary font-medium">
              {member.role_title}
            </p>
          </div>
          {member.description && (
            <div
              className="text-xs text-muted-foreground leading-relaxed max-w-none [&_p]:m-0 [&_strong]:font-semibold [&_*]:!text-xs [&_*]:!font-[inherit] [&_span]:!text-inherit"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(member.description),
              }}
            />
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors min-h-[32px]"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{member.email}</span>
              </a>
            )}
            {member.phone && (
              <a
                href={`tel:${member.phone.replace(/\D/g, "")}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors min-h-[32px]"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {member.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
