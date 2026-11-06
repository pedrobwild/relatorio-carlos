
- Weekly schedule templates: calendar/slack math lives only in `src/lib/schedule/weeklySchedule.ts` (pure, tested); UI and submit consume `generateWeeklyPlan`/`buildWeeklyRows`. Why: one source for the acceptance rules.
- Schedule PDF: single generator `src/lib/pdf/cronogramaPdf.ts` (Bewild layout, fonts/logos embedded from `src/assets`); storing/sending goes through `src/lib/pdf/cronogramaExport.ts`. Why: avoid parallel PDF formats.
