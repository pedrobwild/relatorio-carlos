import { useState } from "react";
import { Edit2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JourneyHero, useUpdateHero } from "@/hooks/useProjectJourney";
import { journeyCopy } from "@/constants/journeyCopy";

interface JourneyHeroSectionProps {
  hero: JourneyHero;
  projectId: string;
  isAdmin: boolean;
}

export function JourneyHeroSection({
  hero,
  projectId,
  isAdmin,
}: JourneyHeroSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(hero.title);
  const [subtitle, setSubtitle] = useState(hero.subtitle);
  const [badgeText, setBadgeText] = useState(hero.badge_text || "");

  const updateHero = useUpdateHero();

  const handleSave = () => {
    updateHero.mutate({
      heroId: hero.id,
      updates: { title, subtitle, badge_text: badgeText || null },
      projectId,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(hero.title);
    setSubtitle(hero.subtitle);
    setBadgeText(hero.badge_text || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-4 p-4 md:p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl md:rounded-2xl border">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {journeyCopy.admin.editHero}
          </span>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              className="h-10 w-10"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              onClick={handleSave}
              disabled={updateHero.isPending}
              className="h-10 w-10"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          className="text-lg md:text-xl font-bold"
        />
        <Textarea
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtítulo"
          rows={3}
        />
        <Input
          value={badgeText}
          onChange={(e) => setBadgeText(e.target.value)}
          placeholder="Texto do badge (ex: 🟢 Contrato assinado)"
        />
      </div>
    );
  }

  return (
    <div className="relative space-y-3 md:space-y-4 p-4 md:p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl md:rounded-2xl border">
      {isAdmin && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-3 right-3 md:top-4 md:right-4 h-10 w-10"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      )}
      {hero.badge_text && (
        <Badge variant="secondary" className="text-xs md:text-sm">
          {hero.badge_text}
        </Badge>
      )}
      <h1 className="text-lg md:text-xl font-bold text-foreground pr-10">
        {hero.title}
      </h1>
      <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
        {hero.subtitle}
      </p>
    </div>
  );
}
