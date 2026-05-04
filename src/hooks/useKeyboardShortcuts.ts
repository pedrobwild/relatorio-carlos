import { useEffect } from "react";

/**
 * Hook for keyboard shortcuts in tab navigation.
 * Arrow Left/Right to switch between tabs.
 * Escape to close modals (handled natively by Radix).
 */
export function useTabKeyboardNav(
  tabs: string[],
  activeTab: string,
  setActiveTab: (tab: string) => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only when no input/textarea is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const idx = tabs.indexOf(activeTab);
      if (idx < 0) return;

      if (e.key === "ArrowRight" && idx < tabs.length - 1) {
        e.preventDefault();
        setActiveTab(tabs[idx + 1]);
      } else if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        setActiveTab(tabs[idx - 1]);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tabs, activeTab, setActiveTab]);
}
