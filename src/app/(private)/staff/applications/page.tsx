import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "PETUGAS", path: "/staff/applications", title: "Pengajuan masuk", description: "Daftar pengajuan dalam lingkup antrean petugas. Klik detail untuk melakukan tindakan yang diizinkan." }); }
