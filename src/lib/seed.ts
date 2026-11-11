import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applicationDocuments, applicationEvents, applications, notifications, ratings, services, users } from "@/db/schema";
import { serviceCatalog } from "@/lib/catalog";
import { hashPassword } from "@/lib/auth";
import { generateSimulationPdf } from "@/lib/pdf";
import { isRequiredRequirement } from "@/lib/format";

let seedPromise: Promise<void> | null = null;
const DEMO_PASSWORD = "kelar123";

function minutesBefore(value: Date, minutes: number) {
  return new Date(value.getTime() - minutes * 60_000);
}
function daysBefore(value: Date, days: number) {
  return new Date(value.getTime() - days * 86_400_000);
}
function daysAfter(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

export async function ensureDemoData() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const demoUsers = [
      { email: "warga@kelar.in", fullName: "Nadia Putri", role: "WARGA" as const },
      { email: "petugas@kelar.in", fullName: "Rizky Pratama", role: "PETUGAS" as const },
      { email: "rtrw@kelar.in", fullName: "Siti Rahmawati", role: "RTRW" as const },
      { email: "lurah@kelar.in", fullName: "Budi Santoso", role: "LURAH" as const },
      { email: "camat@kelar.in", fullName: "Dewi Anggraini", role: "CAMAT" as const },
    ];
    const passwordHash = hashPassword(DEMO_PASSWORD);
    await db.insert(users).values(demoUsers.map((user) => ({ ...user, passwordHash }))).onConflictDoNothing({ target: users.email });
    const serviceValues = serviceCatalog.map((service) => ({
      ...service,
      requirements: [...service.requirements],
      approvalStages: [...service.approvalStages],
      priorityEvidenceReasons: [...service.priorityEvidenceReasons],
      businessWeekdays: [...service.businessWeekdays],
    }));
    await db.insert(services).values(serviceValues).onConflictDoNothing({ target: services.code });

    const userRows = await db.select().from(users).where(inArray(users.email, demoUsers.map((user) => user.email)));
    const userByRole = Object.fromEntries(userRows.map((user) => [user.role, user]));
    const serviceRows = await db.select().from(services);
    const serviceByCode = Object.fromEntries(serviceRows.map((service) => [service.code, service]));
    const citizen = userByRole.WARGA;
    const staff = userByRole.PETUGAS;
    const rtrw = userByRole.RTRW;
    const mayor = userByRole.LURAH;
    const clerk = userByRole.CAMAT;
    if (!citizen || !staff || !rtrw || !mayor || !clerk) return;

    const now = new Date();
    const demoApplications: Array<{
      publicId: string;
      serviceCode: string;
      status: string;
      submittedAt: Date;
      dueAt: Date | null;
      verifiedAt: Date | null;
      completedAt: Date | null;
      assignedStaffId: string | null;
      priorityRequested: boolean;
      priorityStatus: string | null;
      delayReason: string | null;
      formData: Record<string, string>;
    }> = [
      { publicId: "DEMO-2601-0001", serviceCode: "DOMISILI", status: "MENUNGGU_VERIFIKASI", submittedAt: minutesBefore(now, 48), dueAt: null, verifiedAt: null, completedAt: null, assignedStaffId: null, priorityRequested: false, priorityStatus: null, delayReason: null, formData: { fullName: citizen.fullName, address: "Jl. Melati No. 18 (simulasi)", residenceType: "kontrak", purposeType: "pribadi", purpose: "Administrasi pendidikan" } },
      { publicId: "DEMO-2601-0002", serviceCode: "DOMISILI", status: "MENUNGGU_RTRW", submittedAt: daysBefore(now, 1), dueAt: daysAfter(now, 2), verifiedAt: daysBefore(now, 1), completedAt: null, assignedStaffId: staff.id, priorityRequested: true, priorityStatus: "DISETUJUI", delayReason: null, formData: { fullName: citizen.fullName, address: "Jl. Melati No. 18 (simulasi)", residenceType: "sendiri", purposeType: "pribadi", purpose: "Keperluan pendaftaran sekolah" } },
      { publicId: "DEMO-2601-0003", serviceCode: "SKU", status: "SELESAI", submittedAt: daysBefore(now, 22), dueAt: daysBefore(now, 17), verifiedAt: daysBefore(now, 21), completedAt: daysBefore(now, 19), assignedStaffId: staff.id, priorityRequested: false, priorityStatus: null, delayReason: null, formData: { fullName: citizen.fullName, address: "Jl. Melati No. 18 (simulasi)", placeOwnership: "sendiri", purpose: "Contoh keperluan usaha" } },
      { publicId: "DEMO-2601-0004", serviceCode: "AHLI_WARIS", status: "MENUNGGU_CAMAT", submittedAt: daysBefore(now, 5), dueAt: daysAfter(now, 2), verifiedAt: daysBefore(now, 4), completedAt: null, assignedStaffId: staff.id, priorityRequested: false, priorityStatus: null, delayReason: null, formData: { fullName: citizen.fullName, address: "Jl. Melati No. 18 (simulasi)", purpose: "Contoh administrasi keluarga" } },
      { publicId: "DEMO-2601-0005", serviceCode: "SKTM", status: "SEDANG_DIPROSES", submittedAt: daysBefore(now, 9), dueAt: daysBefore(now, 1), verifiedAt: daysBefore(now, 8), completedAt: null, assignedStaffId: staff.id, priorityRequested: false, priorityStatus: null, delayReason: "Contoh simulasi: menunggu klarifikasi lampiran dari pemohon.", formData: { fullName: citizen.fullName, address: "Jl. Melati No. 18 (simulasi)", purpose: "Contoh kebutuhan pendidikan" } },
      { publicId: "DEMO-2601-0006", serviceCode: "KEMATIAN", status: "MENUNGGU_VERIFIKASI", submittedAt: minutesBefore(now, 110), dueAt: null, verifiedAt: null, completedAt: null, assignedStaffId: null, priorityRequested: true, priorityStatus: "MENUNGGU", delayReason: null, formData: { fullName: citizen.fullName, address: "Jl. Melati No. 18 (simulasi)", purpose: "Contoh pengajuan prioritas duka", priorityReason: "bereavement" } },
      { publicId: "DEMO-2601-0007", serviceCode: "PENGHASILAN", status: "MENUNGGU_LURAH", submittedAt: daysBefore(now, 2), dueAt: daysAfter(now, 1), verifiedAt: daysBefore(now, 1), completedAt: null, assignedStaffId: staff.id, priorityRequested: false, priorityStatus: null, delayReason: null, formData: { fullName: citizen.fullName, address: "Jl. Melati No. 18 (simulasi)", purpose: "Contoh administrasi" } },
    ];

    for (const item of demoApplications) {
      await db.insert(applications).values({
        publicId: item.publicId,
        citizenId: citizen.id,
        serviceId: serviceByCode[item.serviceCode].id,
        assignedStaffId: item.assignedStaffId,
        assignedRtrwId: rtrw.id,
        status: item.status,
        formData: item.formData,
        submittedAt: item.submittedAt,
        verifiedAt: item.verifiedAt,
        slaStartedAt: item.verifiedAt,
        dueAt: item.dueAt,
        completedAt: item.completedAt,
        accumulatedPauseDuration: 0,
        delayReason: item.delayReason,
        progressNote: item.status === "SEDANG_DIPROSES" ? "Pemeriksaan dan penyusunan surat contoh sedang berlangsung." : null,
        priorityRequested: item.priorityRequested,
        priorityReason: item.priorityRequested ? (item.formData.priorityReason ?? "bereavement") : null,
        priorityNote: item.priorityRequested ? "Permohonan prioritas data simulasi." : null,
        priorityStatus: item.priorityStatus,
        priorityDecisionReason: item.priorityStatus === "DISETUJUI" ? "Disetujui pada skenario demo." : null,
        priorityDecisionAt: item.priorityStatus === "DISETUJUI" ? minutesBefore(now, 90) : null,
        priorityTargetAt: item.priorityStatus === "DISETUJUI" ? daysAfter(now, 1) : null,
        letterData: item.status === "SELESAI" ? generateSimulationPdf({ title: "Surat Keterangan Usaha", publicId: item.publicId, citizenName: citizen.fullName, serviceName: "Surat Keterangan Usaha", createdAt: item.completedAt ?? now, purpose: "Contoh dokumen hasil finalisasi" }) : null,
        letterFileName: item.status === "SELESAI" ? `${item.publicId}-SIMULASI.pdf` : null,
        createdAt: item.submittedAt,
        updatedAt: item.completedAt ?? now,
      }).onConflictDoNothing({ target: applications.publicId });
    }

    const existingDemo = await db.select({ id: applications.id, publicId: applications.publicId, status: applications.status, serviceId: applications.serviceId, formData: applications.formData, priorityRequested: applications.priorityRequested, priorityReason: applications.priorityReason, submittedAt: applications.submittedAt, citizenId: applications.citizenId, completedAt: applications.completedAt, assignedStaffId: applications.assignedStaffId }).from(applications).where(inArray(applications.publicId, demoApplications.map((item) => item.publicId)));
    for (const application of existingDemo) {
      const hasEvent = await db.select({ id: applicationEvents.id }).from(applicationEvents).where(eq(applicationEvents.applicationId, application.id)).limit(1);
      if (!hasEvent.length) {
        await db.insert(applicationEvents).values([
          { applicationId: application.id, actorId: application.citizenId, eventType: "SUBMITTED", status: "MENUNGGU_VERIFIKASI", note: "Permohonan diterima — data simulasi untuk pratinjau sistem.", createdAt: application.submittedAt },
          ...(application.status !== "MENUNGGU_VERIFIKASI" ? [{ applicationId: application.id, actorId: application.assignedStaffId ?? staff.id, eventType: "DEMO_STAGE", status: application.status, note: "Perubahan tahap pada data demo. Tidak mewakili pelayanan operasional.", createdAt: application.completedAt ?? now }] : []),
        ]);
      }
      const demoService = serviceRows.find((service) => service.id === application.serviceId);
      const existingDocuments = await db.select({ id: applicationDocuments.id }).from(applicationDocuments).where(eq(applicationDocuments.applicationId, application.id)).limit(1);
      if (demoService && !existingDocuments.length) {
        const requiredRequirements = demoService.requirements.filter((item) => isRequiredRequirement(item, application.formData));
        const documentList = [
          ...requiredRequirements.map((item) => ({ id: item.id, label: item.label })),
          ...(application.priorityRequested && demoService.priorityEvidenceReasons.includes(application.priorityReason ?? "") ? [{ id: "priority_evidence", label: "Bukti pendukung prioritas" }] : []),
        ];
        const documentValues = documentList.map((item) => {
          const content = generateSimulationPdf({ title: `Lampiran simulasi: ${item.label}`, publicId: application.publicId, citizenName: application.formData.fullName ?? "Warga demo", serviceName: demoService.name, createdAt: application.submittedAt, purpose: "Contoh berkas untuk latihan verifikasi sistem kelar.in. Bukan dokumen resmi." });
          return { applicationId: application.id, requirementId: item.id, originalName: `${application.publicId}-${item.id}-DEMO.pdf`, mimeType: "application/pdf", sizeBytes: content.length, content, uploadedBy: application.citizenId, revision: 1, isCurrent: true, uploadedAt: application.submittedAt };
        });
        if (documentValues.length) await db.insert(applicationDocuments).values(documentValues);
      }
      if (application.status === "SELESAI") {
        await db.insert(ratings).values({ applicationId: application.id, citizenId: application.citizenId, handledStaffId: application.assignedStaffId, mayorId: mayor.id, stars: 5, category: "kejelasan", comment: "Informasi proses mudah dipahami. (simulasi)", createdAt: application.completedAt ?? now }).onConflictDoNothing({ target: ratings.applicationId });
      }
    }

    const notificationRows = [
      { userId: citizen.id, title: "Selamat datang di kelar.in", body: "Akun demo menampilkan contoh status dan dokumen simulasi. Mulai pengajuan baru untuk mencoba alur secara langsung.", href: "/dashboard" },
      { userId: staff.id, title: "Antrean kerja tersedia", body: "Tinjau pengajuan yang menunggu verifikasi pada antrean demo.", href: "/staff/verification" },
      { userId: rtrw.id, title: "Ada persetujuan lingkungan", body: "Periksa pengajuan yang ditugaskan kepada akun RT/RW demo.", href: "/rtrw/approvals" },
      { userId: mayor.id, title: "Monitoring pelayanan tersedia", body: "Ringkasan SLA dan akuntabilitas demo sudah dapat ditinjau.", href: "/lurah/dashboard" },
      { userId: clerk.id, title: "Persetujuan khusus ahli waris", body: "Satu contoh pengajuan ahli waris menunggu persetujuan Camat.", href: "/camat/approvals" },
    ];
    for (const notice of notificationRows) {
      const hasNotice = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, notice.userId), eq(notifications.title, notice.title))).limit(1);
      if (!hasNotice.length) await db.insert(notifications).values(notice);
    }
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });
  return seedPromise;
}
