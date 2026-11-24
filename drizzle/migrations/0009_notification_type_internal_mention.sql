-- Tipo de aviso para menção em observação interna (equipe). Em migration
-- própria: um valor novo de enum só pode ser USADO depois do commit.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'internal_mention';
