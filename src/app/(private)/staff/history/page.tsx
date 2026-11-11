import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "PETUGAS", path: "/staff/history", title: "Riwayat pengajuan", description: "Tinjau catatan pengajuan yang berada pada lingkup kerja akun petugas." }); }
