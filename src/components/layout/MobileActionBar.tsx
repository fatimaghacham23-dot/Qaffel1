import type { ReactNode } from "react";
export function MobileActionBar({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) { return <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-float backdrop-blur md:hidden"><div className="mx-auto flex max-w-lg gap-2">{secondary ? <div className="flex-1">{secondary}</div> : null}<div className="flex-1">{primary}</div></div></div>; }
export const mobileActionBarContentSpacing = "pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))]";
