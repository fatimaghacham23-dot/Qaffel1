"use client";

import { Clock } from "@/components/clock";

function DashboardClock() {
  return (
    <section className="q-panel h-full overflow-hidden p-5">
      <div className="mb-3">
        <p className="q-section-label text-teal-700">
          Local time
        </p>

        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          Beirut clock
        </h2>
      </div>

      <div className="flex min-h-[360px] w-full items-center justify-center overflow-visible sm:min-h-[440px] xl:min-h-[520px]">
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
