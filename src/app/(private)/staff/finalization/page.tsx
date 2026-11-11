import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "PETUGAS", path: "/staff/finalization", title: "Finalisasi surat", description: "Setelah seluruh persetujuan selesai, terbitkan PDF simulasi yang jelas diberi watermark.", statuses: ["FINALISASI"] }); }
