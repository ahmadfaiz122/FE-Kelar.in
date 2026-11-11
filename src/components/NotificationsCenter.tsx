'use client';

import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Circle, ExternalLink, Inbox } from "lucide-react";
import { formatWib } from "@/lib/dates";

type Notice = { id: string; title: string; body: string; href: string; createdAt: string; readAt: string | null; applicationId: string | null };

export function NotificationsCenter({ initialNotifications }: { initialNotifications: Notice[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busy, setBusy] = useState(false);
  const unread = notifications.filter((item) => !item.readAt).length;
  async function mark(id?: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { markAll: true }) });
      if (!response.ok) return;
      const at = new Date().toISOString();
      setNotifications((items) => items.map((item) => (!id || item.id === id) && !item.readAt ? { ...item, readAt: at } : item));
    } finally { setBusy(false); }
  }
  return <section><div className="page-heading"><div><span className="eyebrow">Pusat informasi</span><h1>Notifikasi</h1><p>Perubahan status yang terhubung dengan tindakan pengajuan dan aktivitas akun Anda.</p></div>{unread > 0 && <button className="btn btn-secondary" disabled={busy} onClick={() => void mark()}><CheckCheck size={16} /> Tandai semua dibaca</button>}</div><div className="demo-banner"><Bell size={16} /><span>Notifikasi berasal dari perubahan status, keputusan, dan aktivitas yang tersimpan di aplikasi; bukan pesan statis.</span></div><section className="section-card"><div className="section-card-header"><div><h2>Semua informasi</h2><p>{unread ? `${unread} belum dibaca` : "Semua notifikasi sudah dibaca"}</p></div><span className="metric-icon"><Inbox size={17} /></span></div>{notifications.length ? <div className="notice-list">{notifications.map((item) => <article key={item.id} className={`notice-row${item.readAt ? "" : " unread"}`}><span className={`notice-dot${item.readAt ? " read" : ""}`}>{item.readAt ? null : <Circle size={8} fill="currentColor" />}</span><div className="notice-copy"><div className="notice-heading"><b>{item.title}</b><small>{formatWib(item.createdAt)}</small></div><p>{item.body}</p>{item.applicationId && <small>Terhubung dengan pengajuan</small>}</div><div className="notice-actions">{!item.readAt && <button className="text-link" disabled={busy} onClick={() => void mark(item.id)}>Tandai dibaca</button>}<Link className="text-link" href={item.href}>Buka <ExternalLink size={13} /></Link></div></article>)}</div> : <div className="empty-state"><div><Inbox size={27} /><p>Belum ada notifikasi. Pembaruan terkait akan muncul di sini.</p></div></div>}</section></section>;
}
