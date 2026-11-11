import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "PETUGAS", path: "/staff/priority", title: "Antrean prioritas", description: "Tinjau alasan dan bukti pendukung. Keputusan wajib mencantumkan pertimbangan tertulis.", priorityOnly: true }); }
