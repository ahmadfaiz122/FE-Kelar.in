import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "PETUGAS", path: "/staff/verification", title: "Verifikasi berkas", description: "Periksa dokumen wajib, kembalikan berkas dengan alasan, atau mulai SLA setelah semua berkas lengkap.", statuses: ["MENUNGGU_VERIFIKASI"] }); }
