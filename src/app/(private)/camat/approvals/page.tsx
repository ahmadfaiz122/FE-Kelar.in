import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "CAMAT", path: "/camat/approvals", title: "Persetujuan ahli waris", description: "Akses terbatas pada pengajuan ahli waris yang menunggu persetujuan Camat.", statuses: ["MENUNGGU_CAMAT"] }); }
