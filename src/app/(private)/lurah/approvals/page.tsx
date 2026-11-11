import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "LURAH", path: "/lurah/approvals", title: "Persetujuan surat", description: "Tinjau permohonan yang telah melalui persetujuan lingkungan. Keputusan disimpan pada timeline.", statuses: ["MENUNGGU_LURAH"] }); }
