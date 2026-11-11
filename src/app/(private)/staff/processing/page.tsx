import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "PETUGAS", path: "/staff/processing", title: "Proses surat", description: "Kelola penyusunan surat dan kirimkan dokumen ke tahap persetujuan yang ditetapkan layanan.", statuses: ["TERVERIFIKASI", "SEDANG_DIPROSES"] }); }
