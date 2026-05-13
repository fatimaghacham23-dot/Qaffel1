"use client";

import { Clock } from "@/components/clock";

function DashboardClock() {
  return (
    <section className="h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          Local time
        </p>

        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          Beirut clock
        </h2>
      </div>

      <div className="flex min-h-[560px] w-full items-center justify-center overflow-visible">
        <Clock
          timeZone="Asia/Beirut"
          initialSecondsMode="smooth"
        />
      </div>
    </section>
  );
}

export { DashboardClock };
export default DashboardClock;