export function humanStatus(status: string) {
  const labels: Record<string, string> = {
    MENUNGGU_VERIFIKASI: "Menunggu verifikasi",
    MENUNGGU_WARGA: "Perlu perbaikan",
    TERVERIFIKASI: "Terverifikasi",
    SEDANG_DIPROSES: "Sedang diproses",
    MENUNGGU_RTRW: "Menunggu persetujuan RT/RW",
    MENUNGGU_LURAH: "Menunggu persetujuan Lurah",
    MENUNGGU_CAMAT: "Menunggu persetujuan Camat",
    FINALISASI: "Finalisasi surat",
    SELESAI: "Selesai",
    DITOLAK: "Ditolak",
  };
  return labels[status] ?? status.replaceAll("_", " ").toLowerCase();
}

export function statusTone(status: string) {
  if (["MENUNGGU_VERIFIKASI", "MENUNGGU_WARGA"].includes(status)) return "amber";
  if (["SEDANG_DIPROSES", "TERVERIFIKASI", "FINALISASI"].includes(status)) return "blue";
  if (status.startsWith("MENUNGGU_")) return "orange";
  if (status === "SELESAI") return "green";
  if (status === "DITOLAK") return "red";
  return "neutral";
}

export function isRequiredRequirement(requirement: { required: boolean; conditional?: { field: string; values: string[] } }, answers: Record<string, string>) {
  if (requirement.conditional) return requirement.conditional.values.includes(answers[requirement.conditional.field] ?? "");
  return requirement.required;
}

export function safeInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
