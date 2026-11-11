import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "RTRW", path: "/rtrw/history", title: "Riwayat persetujuan", description: "Riwayat pengajuan pada penugasan RT/RW. Catatan dan aktor dapat dibuka pada detail pengajuan." }); }
