import { RoleQueuePage } from "@/components/PrivatePageContent";
export const dynamic = "force-dynamic";
export default function Page() { return RoleQueuePage({ role: "RTRW", path: "/rtrw/residents", title: "Profil warga terkait", description: "Informasi warga dibatasi pada pengajuan yang ditugaskan kepada akun RT/RW ini." }); }
