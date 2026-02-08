import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring } from "./lib/errorMonitoring";

// Initialize error monitoring before rendering
initErrorMonitoring();

createRoot(document.getElementById("root")!).render(<App />);
