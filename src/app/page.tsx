import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { LandingExperience } from "@/components/LandingExperience";
import { serviceCatalog } from "@/lib/catalog";
import { ensureDemoData } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let catalog;
  try {
    await ensureDemoData();
    catalog = await db.select({ id: services.id, code: services.code, name: services.name, description: services.description, category: services.category, requirements: services.requirements, slaBusinessDays: services.slaBusinessDays, priorityEnabled: services.priorityEnabled, priorityTargetHours: services.priorityTargetHours }).from(services).where(eq(services.isActive, true)).orderBy(asc(services.name));
  } catch {
    catalog = serviceCatalog.map((service) => ({ ...service, id: service.code, requirements: [...service.requirements] }));
  }
  return <LandingExperience services={catalog} />;
}
