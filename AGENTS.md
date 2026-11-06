
- Weekly schedule templates: calendar/slack math lives only in `src/lib/schedule/weeklySchedule.ts` (pure, tested); UI and submit consume `generateWeeklyPlan`/`buildWeeklyRows`. Why: one source for the acceptance rules.
- Schedule PDF: single generator `src/lib/pdf/cronogramaPdf.ts` (Bewild layout, fonts/logos embedded from `src/assets`); storing/sending goes through `src/lib/pdf/cronogramaExport.ts`. Why: avoid parallel PDF formats.
- Schedule-generated purchases: date rules live in SQL `schedule_purchase_dates` (writes/recalcs via SECURITY DEFINER RPCs and the `planned_start` trigger) mirrored 1:1 in `src/lib/schedule/weeklyPurchases.ts` for preview/tests. Why: purchases are a state machine; the DB is authoritative.
