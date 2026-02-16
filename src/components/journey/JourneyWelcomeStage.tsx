import { useState } from 'react';
import { Users, Compass, ArrowRight, Mail, Phone, ImageIcon, Plus, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { JourneyHero } from '@/hooks/useProjectJourney';
import { useJourneyTeamMembers, JourneyTeamMember } from '@/hooks/useJourneyTeamMembers';
import { TeamMemberEditModal } from '@/components/journey/TeamMemberEditModal';

interface JourneyWelcomeStageProps {
  hero: JourneyHero;
  projectId: string;
  isAdmin: boolean;
  onAdvance: () => void;
  nextStageName: string;
}

const contentVariants = {
  collapsed: { height: 0, opacity: 0, overflow: 'hidden' as const },
  expanded: {
    height: 'auto',
    opacity: 1,
    overflow: 'visible' as const,
    transition: {
      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: 'hidden' as const,
    transition: {
      height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.15 },
    },
  },
};

const portalBullets = [
  { icon: '📋', text: 'Acompanhe cada etapa e saiba exatamente o que está acontecendo.' },
  { icon: '✅', text: 'Conclua pendências e aprove documentos direto por aqui.' },
  { icon: '📅', text: 'Veja datas, reuniões e prazos em um só lugar.' },
];

export function JourneyWelcomeStage({ hero, projectId, isAdmin, onAdvance, nextStageName }: JourneyWelcomeStageProps) {
  const [guideExpanded, setGuideExpanded] = useState(true);
  const [teamExpanded, setTeamExpanded] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<JourneyTeamMember | null>(null);

  const { members, addMember, updateMember, removeMember, uploadPhoto, isAdding, isUpdating, isUploading } = useJourneyTeamMembers(projectId);

  const handleSaveMember = async (data: {
    display_name: string; role_title: string; description: string;
    email: string | null; phone: string | null; photo_url: string | null;
  }) => {
    if (editingMember) {
      await updateMember({ id: editingMember.id, ...data });
    } else {
      await addMember({ project_id: projectId, ...data });
    }
  };

  const handleUploadPhoto = async (file: File) => {
    return await uploadPhoto({ file });
  };

  const openAddModal = () => { setEditingMember(null); setEditModalOpen(true); };
  const openEditModal = (member: JourneyTeamMember) => { setEditingMember(member); setEditModalOpen(true); };

  return (
    <div className="space-y-4">
      {/* Block 1: Guia de Uso */}
      <Card
        data-stage-id="welcome-guide"
        className="transition-shadow duration-200 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
      >
        <CardHeader
          className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6"
          onClick={() => setGuideExpanded(!guideExpanded)}
          role="button"
          aria-expanded={guideExpanded}
          aria-label="Guia de Uso"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGuideExpanded(!guideExpanded); } }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary shrink-0">
              <Compass className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground">Guia de Uso</h3>
              <p className="text-xs text-primary font-medium">Conheça o portal Bwild e como extrair ao máximo esta ferramenta</p>
            </div>
            <motion.div animate={{ rotate: guideExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
        </CardHeader>

        <AnimatePresence initial={false}>
          {guideExpanded && (
            <motion.div key="guide-content" variants={contentVariants} initial="collapsed" animate="expanded" exit="exit">
              <CardContent className="space-y-5 pt-0 px-4 pb-5 md:px-6 md:pb-6">
                <div className="space-y-2">
                  <h2 className="text-base md:text-lg font-bold text-foreground">{hero.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{hero.subtitle}</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Como usar o portal</h4>
                  <ul className="space-y-2.5">
                    {portalBullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="text-base leading-none mt-0.5 shrink-0">{bullet.icon}</span>
                        <span className="text-sm text-muted-foreground leading-relaxed">{bullet.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  className="w-full md:w-auto min-h-[44px] gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTeamExpanded(true);
                    // Scroll to team section after a brief delay
                    setTimeout(() => {
                      document.querySelector('[data-stage-id="welcome-team"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 350);
                  }}
                >
                  Entendi, conhecer meu time
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Block 2: Seu Time */}
      <Card
        data-stage-id="welcome-team"
        className="transition-shadow duration-200 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
      >
        <CardHeader
          className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6"
          onClick={() => setTeamExpanded(!teamExpanded)}
          role="button"
          aria-expanded={teamExpanded}
          aria-label="Seu Time"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTeamExpanded(!teamExpanded); } }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary shrink-0">
              <Users className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground">Seu Time</h3>
              <p className="text-xs text-primary font-medium">Conheça quem cuida do seu projeto</p>
            </div>
            <motion.div animate={{ rotate: teamExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
        </CardHeader>

        <AnimatePresence initial={false}>
          {teamExpanded && (
            <motion.div key="team-content" variants={contentVariants} initial="collapsed" animate="expanded" exit="exit">
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
                        onEdit={() => openEditModal(member)}
                        onRemove={() => removeMember(member.id)}
                      />
                    ))}
                  </div>
                )}

                {isAdmin && (
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px] gap-2"
                    onClick={(e) => { e.stopPropagation(); openAddModal(); }}
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

      {/* Advance button */}
      <div className="pt-2">
        <Button
          className="w-full min-h-[48px] gap-2 text-sm"
          onClick={onAdvance}
        >
          Confirme meu entendimento, avançar para {nextStageName}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <TeamMemberEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        member={editingMember}
        onSave={handleSaveMember}
        onUploadPhoto={handleUploadPhoto}
        isSaving={isAdding || isUpdating}
        isUploading={isUploading}
      />
    </div>
  );
}

/* ─── Team Member Card ─── */

function TeamMemberCard({
  member, isAdmin, onEdit, onRemove,
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
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Editar">
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" aria-label="Remover">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar className="h-14 w-14 border-2 border-primary/20 shrink-0">
          <AvatarImage src={member.photo_url || undefined} alt={member.display_name} className="object-cover" />
          <AvatarFallback className="text-sm bg-primary/10">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 space-y-1">
          <div>
            <p className="font-semibold text-sm">{member.display_name}</p>
            <p className="text-xs text-primary font-medium">{member.role_title}</p>
          </div>
          {member.description && (
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {member.description}
            </p>
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
                href={`tel:${member.phone.replace(/\D/g, '')}`}
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
