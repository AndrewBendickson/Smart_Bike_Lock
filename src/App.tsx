import { useEffect, useMemo, useState } from "react";
import {
  Bike, Lock, Unlock, MapPin, RefreshCw, Clock,
  Moon, SunMedium, CheckCircle2, XCircle
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

/* =========================
   Auburn theme tokens
========================= */
const AUBURN_NAVY = "#0C2340";
const AUBURN_ORANGE = "#E87722";

/* =========================
   Types & helpers
========================= */
type Slot = { id: string; index: number; occupied: boolean; operational: boolean };
type Rack = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  slots: Slot[];
  lastHeartbeat: number;
};
type Session = { active: boolean; rackId?: string; slotId?: string; startedAt?: number };

const now = () => Date.now();
const fmtTime = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString() : "–");

function makeSlots(n: number): Slot[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: crypto.randomUUID(),
    index: i,
    occupied: Math.random() < 0.35,
    operational: Math.random() < 0.95,
  }));
}

/** Replace lat/lng with exact rack spots when you have them */
function seedRacks(): Rack[] {
  return [
    { id: crypto.randomUUID(), name: "RBD Library – North", lat: 32.6022, lng: -85.4869, slots: makeSlots(12), lastHeartbeat: now() },
    { id: crypto.randomUUID(), name: "Student Center – Quad", lat: 32.6041, lng: -85.4877, slots: makeSlots(16), lastHeartbeat: now() },
    { id: crypto.randomUUID(), name: "Engineering Dr – Shelby", lat: 32.6068, lng: -85.4889, slots: makeSlots(20), lastHeartbeat: now() },
    { id: crypto.randomUUID(), name: "Wellness Center", lat: 32.6037, lng: -85.4952, slots: makeSlots(10), lastHeartbeat: now() },
  ];
}

function rackOpen(r: Rack) {
  const usable = r.slots.filter(s => s.operational);
  return { open: usable.filter(s => !s.occupied).length, total: usable.length };
}

/* =========================
   Tiny Toast system
========================= */
type Toast = { id: string; title: string; desc?: string; tone?: "success" | "error" };
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  function push(t: Omit<Toast, "id">) {
    const toast: Toast = { id: crypto.randomUUID(), ...t };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== toast.id)), 3200);
  }
  function dismiss(id: string) { setToasts(prev => prev.filter(t => t.id !== id)); }
  return { toasts, push, dismiss };
}

function ToastHost({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex w-full max-w-sm flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto overflow-hidden rounded-xl border bg-white/95 shadow-lg ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-start gap-3 p-3">
            {t.tone === "error"
              ? <XCircle className="mt-0.5 h-5 w-5 text-red-600" />
              : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />}
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.desc && <div className="text-xs text-slate-600 dark:text-slate-300">{t.desc}</div>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
          <div className="h-1 w-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-full animate-[toastbar_3.2s_linear_forwards] origin-left bg-emerald-500 dark:bg-emerald-400" />
          </div>
        </div>
      ))}
      <style>{`@keyframes toastbar { from { transform:scaleX(1) } to { transform:scaleX(0) } }`}</style>
    </div>
  );
}

/* =========================
   Dark mode toggle (persisted)
========================= */
function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  useEffect(() => {
    const root = document.documentElement;
    if (dark) { root.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else { root.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [dark]);
  return { dark, toggle: () => setDark(d => !d) };
}

/* =========================
   Map helpers (Leaflet)
========================= */
const auburnCenter: [number, number] = [32.6025, -85.4875];

function FitToRacks({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds.pad(0.25));
  }, [points, map]);
  return null;
}

function availabilityIcon(open: number, total: number) {
  const pct = total ? open / total : 0;
  const color = pct > 0.5 ? "#10b981" : pct > 0.2 ? "#f59e0b" : "#ef4444";
  return L.divIcon({
    className: "avail-pin",
    html: `
      <div style="
        background:white; border:1px solid #e2e8f0; border-radius:12px; padding:6px 8px;
        box-shadow: 0 8px 20px rgba(2,6,23,0.12);
      ">
        <div style="display:flex; gap:6px; align-items:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}">
            <path d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7z"/>
          </svg>
          <span style="font:600 12px system-ui">${open}/${total}</span>
        </div>
      </div>`,
    iconAnchor: [18, 36],
  });
}

/* =========================
   App
========================= */
export default function App() {
  const [racks, setRacks] = useState<Rack[]>(seedRacks);
  const [session, setSession] = useState<Session>({ active: false });
  const [selectedRackId, setSelectedRackId] = useState<string | undefined>();
  const { dark, toggle } = useDarkMode();
  const toasts = useToasts();

  useEffect(() => {
    if (!selectedRackId && racks.length) setSelectedRackId(racks[0].id);
  }, [racks, selectedRackId]);

  // Simulate live occupancy updates
  useEffect(() => {
    const t = setInterval(() => {
      setRacks(prev =>
        prev.map(r => {
          const mySlotId = session.active && session.rackId === r.id ? session.slotId : undefined;
          const updated: Rack = { ...r, lastHeartbeat: now() };
          if (Math.random() < 0.25) {
            updated.slots = r.slots.map(s => {
              if (s.id === mySlotId || !s.operational) return s;
              if (Math.random() < 0.1) return { ...s, occupied: !s.occupied };
              return s;
            });
          }
          return updated;
        })
      );
    }, 3000);
    return () => clearInterval(t);
  }, [session]);

  const totals = useMemo(() => {
    const arr = racks.map(rackOpen);
    const open = arr.reduce((a, b) => a + b.open, 0);
    const total = arr.reduce((a, b) => a + b.total, 0);
    const pct = total ? Math.round((open / total) * 100) : 0;
    return { open, total, pct };
  }, [racks]);

  const currentRack = racks.find(r => r.id === session.rackId);
  const currentSlot = currentRack?.slots.find(s => s.id === session.slotId);

  function startSession(rackId?: string) {
    const targetId = rackId ?? selectedRackId;
    if (!targetId) return;
    const rack = racks.find(r => r.id === targetId);
    if (!rack) return;

    const slot = rack.slots.find(s => s.operational && !s.occupied);
    if (!slot) { toasts.push({ title: "No open slots", desc: `${rack.name} is full right now.`, tone: "error" }); return; }

    setRacks(prev =>
      prev.map(r =>
        r.id === rack.id ? { ...r, slots: r.slots.map(s => (s.id === slot.id ? { ...s, occupied: true } : s)) } : r
      )
    );
    setSession({ active: true, rackId: rack.id, slotId: slot.id, startedAt: now() });
    setSelectedRackId(rack.id);
    toasts.push({ title: "Bike locked", desc: `Locked at ${rack.name} — Slot #${slot.index}.`, tone: "success" });
  }

  function endSession() {
    if (!session.active || !session.rackId || !session.slotId) return;
    const rack = racks.find(r => r.id === session.rackId);
    const slot = currentSlot;
    setRacks(prev =>
      prev.map(r =>
        r.id === session.rackId
          ? { ...r, slots: r.slots.map(s => (s.id === session.slotId ? { ...s, occupied: false } : s)) }
          : r
      )
    );
    setSession({ active: false });
    toasts.push({
      title: "Bike unlocked",
      desc: rack && slot ? `Unlocked at ${rack.name} — Slot #${slot.index}.` : "Unlocked.",
      tone: "success",
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900 antialiased dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      {/* Brand header */}
      <div
        className="border-b bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
        style={{ boxShadow: "0 2px 12px rgba(2,6,23,.06)" }}
      >
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <img
                src="/auburn-logo.svg"
                alt="Auburn University logo"
                className="h-9 w-auto"
              />
              <div>
                <h1 className="text-lg font-semibold md:text-xl text-slate-900 dark:text-slate-100">
                  Auburn Smart Bike Rack
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400">Prototype • UI Demo</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-3 rounded-full border bg-white/70 px-3 py-1.5 text-sm text-slate-700 shadow-sm backdrop-blur md:flex dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                <Clock className="h-4 w-4" />
                <span>Last heartbeat: {fmtTime(Math.max(...racks.map(r => r.lastHeartbeat)))}</span>
                <button
                  className="inline-flex items-center rounded-md border px-2 py-1 text-xs transition hover:bg-slate-50 active:scale-[.98] dark:border-slate-700 dark:hover:bg-slate-700/60"
                  onClick={() => setRacks(r => r.map(rr => ({ ...rr, lastHeartbeat: now() })))}
                >
                  <RefreshCw className="mr-1 h-3 w-3" /> Refresh
                </button>
              </div>
              <button
                onClick={toggle}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition hover:bg-slate-50 active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800/60"
                aria-label="Toggle dark mode"
                title="Toggle dark mode"
              >
                {dark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="hidden md:inline">{dark ? "Light" : "Dark"}</span>
              </button>
            </div>
          </div>

          {/* Thin orange brand underline */}
          <div style={{ background: AUBURN_ORANGE }} className="h-[3px] w-full rounded-t-full" />
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 md:p-6 lg:p-8 lg:grid-cols-3">
        {/* Map card */}
        <section className="relative overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="border-b p-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold tracking-tight">Auburn Campus Map</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Click a marker to view details; lock from the popup.</p>
          </div>

          <div className="relative h-[520px]">
            <MapContainer center={auburnCenter} zoom={15} className="h-full w-full">
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitToRacks points={racks.map(r => [r.lat, r.lng]) as [number, number][]} />

              {racks.map(r => {
                const { open, total } = rackOpen(r);
                return (
                  <Marker
                    key={r.id}
                    position={[r.lat, r.lng]}
                    icon={availabilityIcon(open, total)}
                    eventHandlers={{
                      click: () =>
                        document.getElementById(`rack-${r.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-slate-600 dark:text-slate-300">{open}/{total} open</div>
                        <button
                          onClick={() => startSession(r.id)}
                          className="mt-2 inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white shadow transition hover:opacity-90 active:scale-[.98]"
                          style={{ background: AUBURN_NAVY }}
                        >
                          <Lock className="mr-2 h-3 w-3" /> Lock here
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Legend chip */}
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border bg-white/90 p-2 text-xs shadow dark:border-slate-700 dark:bg-slate-900/80">
              <div className="mb-1 font-medium">Legend</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> &gt;50% open</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> 20–50%</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> &lt;20%</div>
            </div>
          </div>
        </section>

        {/* My Bike card */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Bike className="h-5 w-5" style={{ color: AUBURN_NAVY }} /> My Bike
          </h3>

          {!session.active ? (
            <div className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">
                No active lock session. Choose a rack below or click a map marker to lock there.
              </p>
              <label className="block text-sm font-medium">Rack</label>
              <select
                value={selectedRackId}
                onChange={(e) => setSelectedRackId(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {racks.map(r => {
                  const { open, total } = rackOpen(r);
                  return <option key={r.id} value={r.id}>{r.name} ({open}/{total} open)</option>;
                })}
              </select>
              <button
                onClick={() => startSession()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white shadow transition hover:opacity-95 active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: AUBURN_NAVY }}
              >
                <Lock className="h-4 w-4" /> Lock my bike
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border bg-emerald-50 p-4 dark:border-slate-800 dark:bg-emerald-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Locked at</div>
                  <div className="text-base font-semibold">{currentRack?.name}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Slot #{currentSlot?.index} • since {fmtTime(session.startedAt)}
                  </div>
                </div>
                <span className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white">Active</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="inline-flex items-center rounded-md border px-3 py-2 text-sm transition hover:bg-slate-50 active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800/60"
                  onClick={() =>
                    document.getElementById(`rack-${session.rackId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                >
                  <MapPin className="mr-2 h-4 w-4" /> View rack
                </button>
                <button
                  onClick={endSession}
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white shadow transition hover:opacity-90 active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-red-500"
                  style={{ background: "#DC2626" }}
                >
                  <Unlock className="mr-2 h-4 w-4" /> Unlock
                </button>
              </div>
            </div>
          )}

          {/* Campus totals */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">Campus Availability</span>
              <span className="text-slate-600 dark:text-slate-300">{totals.open}/{totals.total} open</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full will-change-[width] animate-[bar_600ms_ease-out] transition-[width]"
                style={{ width: `${totals.pct}%`, background: AUBURN_ORANGE }}
              />
            </div>
          </div>
        </section>

        {/* Rack list card */}
        <section className="rounded-2xl border bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
          <div className="border-b p-4 dark:border-slate-800">
            <h3 className="text-lg font-semibold tracking-tight">Bike Racks</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Click “Lock here” to simulate using that rack.</p>
          </div>
          <div className="max-h-[360px] overflow-auto divide-y dark:divide-slate-800">
            {racks.map(r => {
              const { open, total } = rackOpen(r);
              const isActive = session.active && session.rackId === r.id;
              return (
                <div
                  id={`rack-${r.id}`}
                  key={r.id}
                  className={`grid grid-cols-12 items-center gap-2 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                    isActive ? "bg-blue-50 dark:bg-blue-950/30" : ""
                  }`}
                >
                  <div className="col-span-7">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Last updated {fmtTime(r.lastHeartbeat)}
                    </div>
                  </div>
                  <div className="col-span-2 text-sm">
                    <span className="font-semibold">{open}</span> / {total} open
                  </div>
                  <div className="col-span-3 flex justify-end">
                    {!isActive ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
                        onClick={() => startSession(r.id)}
                      >
                        <Lock className="h-4 w-4" /> Lock here
                      </button>
                    ) : (
                      <button
                        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-white shadow transition hover:opacity-90 active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-red-500"
                        style={{ background: "#DC2626" }}
                        onClick={endSession}
                      >
                        <Unlock className="h-4 w-4" /> Unlock
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-slate-500 dark:text-slate-400">
        Prototype only — no Tiger Card or hardware connections. UI & interactions for class demo.
      </footer>

      {/* Toasts */}
      <ToastHost toasts={toasts.toasts} dismiss={toasts.dismiss} />
    </div>
  );
}
