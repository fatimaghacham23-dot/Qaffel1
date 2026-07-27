export function drawerSideClass(isRtl: boolean) {
  return isRtl ? "left-0 border-r" : "right-0 border-l";
}

export function drawerShouldClose(event: "escape" | "overlay" | "navigation" | "close-button") {
  return ["escape", "overlay", "navigation", "close-button"].includes(event);
}
