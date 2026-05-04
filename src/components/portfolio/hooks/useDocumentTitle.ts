import { useEffect } from "react";

/**
 * Sets the document title dynamically.
 * Shows alert count as a badge when there are urgent items.
 */
export function useDocumentTitle(alertCount: number) {
  useEffect(() => {
    const base = "Portfólio de Obras";
    document.title = alertCount > 0 ? `(${alertCount}) ${base}` : base;
    return () => {
      document.title = "Bwild";
    };
  }, [alertCount]);
}
