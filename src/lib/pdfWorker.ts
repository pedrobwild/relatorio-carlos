/**
 * Centralized PDF.js worker configuration.
 * Import this module once in any component that uses react-pdf
 * to ensure the worker is set up consistently.
 */
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
