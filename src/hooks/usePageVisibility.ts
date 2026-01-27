import { useEffect, useState } from "react";

export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === "undefined") return true;
    return !document.hidden;
  });

  useEffect(() => {
    const onChange = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return isVisible;
}
