import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "LURAH", path: "/lurah/monitoring", title: "Monitoring pengajuan", description: "Pantau status, estimasi, prioritas, dan kendala seluruh pengajuan dalam sistem demo." }); }
