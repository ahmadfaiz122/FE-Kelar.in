import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "RTRW", path: "/rtrw/approvals", title: "Persetujuan lingkungan", description: "Hanya pengajuan yang ditugaskan kepada akun RT/RW Anda. Setujui atau kembalikan dengan alasan yang tercatat.", statuses: ["MENUNGGU_RTRW"] }); }
