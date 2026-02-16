import { Users, Compass, ArrowRight, Mail, Phone, Upload, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { JourneyCSM } from '@/components/journey/JourneyCSMSection';
import { JourneyHero } from '@/hooks/useProjectJourney';
import defaultCsmPhoto from '@/assets/csm-victorya.png';

interface JourneyWelcomeStageProps {
  hero: JourneyHero;
  csm: JourneyCSM | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onGoToBriefing: () => void;
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

export function JourneyWelcomeStage({
  hero,
  csm,
  isExpanded,
  onToggleExpand,
  onGoToBriefing,
}: JourneyWelcomeStageProps) {
  const photoUrl = csm?.photo_url || defaultCsmPhoto;

  return (
    <Card
      data-stage-id="welcome"
      className={cn(
        'transition-shadow duration-200 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10',
      )}
    >
      {/* Header — always visible */}
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6"
        onClick={onToggleExpand}
        role="button"
        aria-expanded={isExpanded}
        aria-label="Etapa: Boas-vindas & Time"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary shrink-0">
            <Users className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">
              Boas-vindas & Seu Time
            </h3>
            <p className="text-xs text-primary font-medium">Conheça o portal e quem cuida do seu projeto</p>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>
      </CardHeader>

      {/* Animated content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="exit"
          >
            <CardContent className="space-y-6 pt-0 px-4 pb-5 md:px-6 md:pb-6">
              {/* Hero welcome message */}
              <div className="space-y-2">
                <h2 className="text-base md:text-lg font-bold text-foreground">
                  {hero.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {hero.subtitle}
                </p>
              </div>

              {/* Como usar o portal */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Como usar o portal</h4>
                </div>
                <ul className="space-y-2.5">
                  {portalBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-base leading-none mt-0.5 shrink-0">{bullet.icon}</span>
                      <span className="text-sm text-muted-foreground leading-relaxed">{bullet.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Seu Time */}
              {csm && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Seu time</h4>
                  </div>

                  {/* CSM Card */}
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-14 w-14 border-2 border-primary/20 shrink-0">
                        <AvatarImage src={photoUrl} alt={csm.name} className="object-cover" />
                        <AvatarFallback className="text-sm bg-primary/10">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div>
                          <p className="font-semibold text-sm">{csm.name}</p>
                          <p className="text-xs text-primary font-medium">{csm.role_title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                          {csm.description}
                        </p>
                        <div className="flex flex-wrap gap-3 pt-1">
                          {csm.email && (
                            <a
                              href={`mailto:${csm.email}`}
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors min-h-[32px]"
                            >
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="break-all">{csm.email}</span>
                            </a>
                          )}
                          {csm.phone && (
                            <a
                              href={`tel:${csm.phone.replace(/\D/g, '')}`}
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors min-h-[32px]"
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {csm.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA to next stage */}
              <Button
                className="w-full md:w-auto min-h-[44px] gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onGoToBriefing();
                }}
              >
                Entendi, ir para o Briefing
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
