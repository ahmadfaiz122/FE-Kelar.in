import type { ApprovalRole } from "@/db/schema";

export function nextApprovalStatus(approvalStages: ApprovalRole[], currentStage: ApprovalRole) {
  const currentIndex = approvalStages.indexOf(currentStage);
  const next = currentIndex >= 0 ? approvalStages[currentIndex + 1] : undefined;
  if (!next) return "FINALISASI";
  return `MENUNGGU_${next}`;
}

export function isApprovalStatus(status: string) {
  return ["MENUNGGU_RTRW", "MENUNGGU_LURAH", "MENUNGGU_CAMAT"].includes(status);
}

export const demoRoleCredentials = [
  { role: "Warga", email: "warga@kelar.in" },
  { role: "Petugas", email: "petugas@kelar.in" },
  { role: "RT/RW", email: "rtrw@kelar.in" },
  { role: "Lurah", email: "lurah@kelar.in" },
  { role: "Camat", email: "camat@kelar.in" },
] as const;
