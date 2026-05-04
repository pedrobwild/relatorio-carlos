import { useMemo } from "react";
import { Activity } from "@/types/report";
import { calcWeightedProgress } from "@/lib/progressCalc";
import {
  calculateWorkingDays,
  type ProjectMetrics,
  type MilestoneItem,
  type MilestoneDates,
  type MilestoneKey,
} from "./types";

export function useProjectMetrics(
  startDate: string | null,
  effectiveEndDate: string | null,
  reportDate: string,
  activities: Activity[],
): ProjectMetrics {
  return useMemo(() => {
    const start = new Date((startDate ?? "") + "T00:00:00");
    const end = new Date((effectiveEndDate ?? "") + "T00:00:00");
    const report = new Date(reportDate + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalWorkingDays = calculateWorkingDays(start, end);
    const hasStarted = today >= start;
    const elapsedWorkingDays = hasStarted
      ? calculateWorkingDays(start, today)
      : 0;
    const remainingWorkingDays = !hasStarted
      ? totalWorkingDays
      : today < end
        ? calculateWorkingDays(today, end)
        : 0;

    // ===== UNIFIED PROGRESS CALCULATION =====
    // Both planned and actual use the SAME weighted-completion logic from calcWeightedProgress.
    // - REALIZADO: peso × 100% para cada atividade com `actualEnd` preenchido.
    // - PREVISTO: peso × 100% para cada atividade cujo `plannedEnd` <= reportDate
    //   (ou seja, deveria estar concluída até esta data).
    const actualProgress = calcWeightedProgress(activities);

    // Para o "Previsto", simulamos que toda atividade que deveria ter terminado
    // (plannedEnd <= reportDate) está concluída — usando a MESMA função.
    const plannedProgress = calcWeightedProgress(
      activities.map((a) => ({
        weight: a.weight,
        actualEnd:
          new Date(a.plannedEnd + "T00:00:00") <= report ? a.plannedEnd : null,
      })),
    );

    const completedActivities = activities.filter((a) => a.actualEnd).length;
    const totalActivities = activities.length;

    const progressDiff = actualProgress - plannedProgress;
    const isOnTrack = progressDiff >= 0;
    const variancePercentage = Math.abs(progressDiff).toFixed(0);

    const allCompleted =
      activities.length > 0 && activities.every((a) => !!a.actualEnd);
    const currentActivity =
      activities.find((a) => {
        const plannedStart = new Date(a.plannedStart + "T00:00:00");
        const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
        return plannedStart <= report && plannedEnd >= report && !a.actualEnd;
      }) || activities.find((a) => !a.actualEnd);

    return {
      totalWorkingDays,
      elapsedWorkingDays,
      remainingWorkingDays,
      actualProgress: Math.round(actualProgress),
      plannedProgress: Math.round(plannedProgress),
      isOnTrack,
      variancePercentage,
      progressDiff: Math.round(progressDiff),
      currentActivity: allCompleted
        ? "Obra concluída"
        : currentActivity?.description || "Sem atividade em andamento",
      completedActivities,
      totalActivities,
    };
  }, [startDate, effectiveEndDate, reportDate, activities]);
}

export function useMilestoneItems(
  milestoneDates?: MilestoneDates,
): MilestoneItem[] {
  return useMemo(() => {
    const items: MilestoneItem[] = [
      {
        label: "Assin. Contrato",
        value: milestoneDates?.contractSigningDate,
        key: "contractSigningDate" as MilestoneKey,
      },
      {
        label: "Briefing Arq.",
        value: milestoneDates?.dateBriefingArch,
        key: "dateBriefingArch" as MilestoneKey,
      },
      {
        label: "Aprov. 3D",
        value: milestoneDates?.dateApproval3d,
        key: "dateApproval3d" as MilestoneKey,
      },
      {
        label: "Aprov. Executivo",
        value: milestoneDates?.dateApprovalExec,
        key: "dateApprovalExec" as MilestoneKey,
      },
      {
        label: "Aprov. Obra",
        value: milestoneDates?.dateApprovalObra,
        key: "dateApprovalObra" as MilestoneKey,
      },
      {
        label: "Início Mobilização",
        value: milestoneDates?.dateMobilizationStart,
        key: "dateMobilizationStart" as MilestoneKey,
      },
    ];
    return items;
  }, [milestoneDates]);
}
