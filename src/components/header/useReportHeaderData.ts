import { useMemo } from "react";
import { Activity } from "@/types/report";
import { calculateWorkingDays, type ProjectMetrics, type MilestoneItem, type MilestoneDates, type MilestoneKey } from "./types";

export function useProjectMetrics(
  startDate: string | null,
  effectiveEndDate: string | null,
  reportDate: string,
  activities: Activity[]
): ProjectMetrics {
  return useMemo(() => {
    const start = new Date((startDate ?? '') + "T00:00:00");
    const end = new Date((effectiveEndDate ?? '') + "T00:00:00");
    const report = new Date(reportDate + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalWorkingDays = calculateWorkingDays(start, end);
    const hasStarted = today >= start;
    const elapsedWorkingDays = hasStarted ? calculateWorkingDays(start, today) : 0;
    const remainingWorkingDays = !hasStarted
      ? totalWorkingDays
      : (today < end ? calculateWorkingDays(today, end) : 0);

    const hasWeights = activities.some(a => a.weight !== undefined);
    const totalWeight = hasWeights
      ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
      : activities.length;

    const completedWeight = activities.reduce((sum, a) => {
      if (a.actualEnd) return sum + (hasWeights ? (a.weight || 0) : 1);
      return sum;
    }, 0);
    const completedActivities = activities.filter(a => a.actualEnd).length;
    const totalActivities = activities.length;
    const actualProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

    const plannedWeight = activities.reduce((sum, a) => {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      if (plannedEnd <= report) return sum + (hasWeights ? (a.weight || 0) : 1);
      return sum;
    }, 0);
    const plannedProgress = totalWeight > 0 ? (plannedWeight / totalWeight) * 100 : 0;

    const progressDiff = actualProgress - plannedProgress;
    const isOnTrack = progressDiff >= 0;
    const variancePercentage = Math.abs(progressDiff).toFixed(0);

    const currentActivity = activities.find(a => {
      const plannedStart = new Date(a.plannedStart + "T00:00:00");
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      return plannedStart <= report && plannedEnd >= report && !a.actualEnd;
    }) || activities.find(a => !a.actualEnd);

    return {
      totalWorkingDays,
      elapsedWorkingDays,
      remainingWorkingDays,
      actualProgress: Math.round(actualProgress),
      plannedProgress: Math.round(plannedProgress),
      isOnTrack,
      variancePercentage,
      progressDiff: Math.round(progressDiff),
      currentActivity: currentActivity?.description || "Sem atividade em andamento",
      completedActivities,
      totalActivities,
    };
  }, [startDate, effectiveEndDate, reportDate, activities]);
}

export function useMilestoneItems(milestoneDates?: MilestoneDates): MilestoneItem[] {
  return useMemo(() => {
    const items: MilestoneItem[] = [
      { label: "Assin. Contrato", value: milestoneDates?.contractSigningDate, key: 'contractSigningDate' as MilestoneKey },
      { label: "Briefing Arq.", value: milestoneDates?.dateBriefingArch, key: 'dateBriefingArch' as MilestoneKey },
      { label: "Aprov. 3D", value: milestoneDates?.dateApproval3d, key: 'dateApproval3d' as MilestoneKey },
      { label: "Aprov. Executivo", value: milestoneDates?.dateApprovalExec, key: 'dateApprovalExec' as MilestoneKey },
      { label: "Aprov. Obra", value: milestoneDates?.dateApprovalObra, key: 'dateApprovalObra' as MilestoneKey },
      { label: "Início Mobilização", value: milestoneDates?.dateMobilizationStart, key: 'dateMobilizationStart' as MilestoneKey },
    ];
    return items;
  }, [milestoneDates]);
}
