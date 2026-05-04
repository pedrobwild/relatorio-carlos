/**
 * Files Repository Tests
 *
 * Unit tests for file validation and utility functions.
 */

import { describe, it, expect } from "vitest";
import {
  validateFile,
  sanitizeFilename,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "../files.repository";

describe("validateFile", () => {
  const createMockFile = (name: string, type: string, size: number): File => {
    const file = new File(["content"], name, { type });
    Object.defineProperty(file, "size", { value: size, writable: false });
    return file;
  };

  it("accepts valid PDF files", () => {
    const file = createMockFile("document.pdf", "application/pdf", 1024 * 1024);
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts valid image files", () => {
    const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    for (const type of imageTypes) {
      const file = createMockFile("image.jpg", type, 1024 * 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    }
  });

  it("rejects files exceeding size limit", () => {
    const file = createMockFile(
      "large.pdf",
      "application/pdf",
      MAX_FILE_SIZE_BYTES + 1,
    );
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Arquivo muito grande");
  });

  it("rejects empty files", () => {
    const file = createMockFile("empty.pdf", "application/pdf", 0);
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Arquivo vazio");
  });

  it("rejects files with disallowed MIME types", () => {
    const file = createMockFile("script.exe", "application/x-executable", 1024);
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Tipo de arquivo não permitido");
  });

  it("rejects filenames with path traversal", () => {
    const testCases = [
      "../../../etc/passwd",
      "..\\..\\windows\\system32",
      "folder/../secret.txt",
      "folder/subfolder/file.pdf",
    ];

    for (const name of testCases) {
      const file = createMockFile(name, "application/pdf", 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Nome de arquivo inválido");
    }
  });

  it("accepts file at exactly the size limit", () => {
    const file = createMockFile(
      "exact.pdf",
      "application/pdf",
      MAX_FILE_SIZE_BYTES,
    );
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });
});

describe("sanitizeFilename", () => {
  it("removes path traversal sequences", () => {
    expect(sanitizeFilename("../../../file.pdf")).toBe("file.pdf");
    expect(sanitizeFilename("..\\..\\file.pdf")).toBe("file.pdf");
  });

  it("replaces special characters with underscores", () => {
    expect(sanitizeFilename("file name (1).pdf")).toBe("file_name__1_.pdf");
    expect(sanitizeFilename("file@name#special.pdf")).toBe(
      "file_name_special.pdf",
    );
  });

  it("preserves safe characters", () => {
    expect(sanitizeFilename("document-v1.2.pdf")).toBe("document-v1.2.pdf");
    expect(sanitizeFilename("file_name.pdf")).toBe("file_name.pdf");
  });

  it("truncates long filenames to 100 characters", () => {
    const longName = "a".repeat(150) + ".pdf";
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it("returns default name for empty input", () => {
    expect(sanitizeFilename("")).toBe("unnamed_file");
  });

  it("handles unicode characters", () => {
    expect(sanitizeFilename("arquivo_código.pdf")).toBe("arquivo_c_digo.pdf");
    expect(sanitizeFilename("文件.pdf")).toBe("__.pdf");
  });
});

describe("ALLOWED_MIME_TYPES", () => {
  it("includes common document types", () => {
    const requiredTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    for (const type of requiredTypes) {
      expect(ALLOWED_MIME_TYPES).toContain(type);
    }
  });

  it("includes common image types", () => {
    const requiredTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    for (const type of requiredTypes) {
      expect(ALLOWED_MIME_TYPES).toContain(type);
    }
  });

  it("includes video types", () => {
    expect(ALLOWED_MIME_TYPES).toContain("video/mp4");
    expect(ALLOWED_MIME_TYPES).toContain("video/quicktime");
  });

  it("does not include executable types", () => {
    const dangerousTypes = [
      "application/x-executable",
      "application/x-msdownload",
      "application/javascript",
    ];

    for (const type of dangerousTypes) {
      expect(ALLOWED_MIME_TYPES).not.toContain(type);
    }
  });
});

describe("MAX_FILE_SIZE_BYTES", () => {
  it("equals 500MB", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(500 * 1024 * 1024);
  });
});
