import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { ReactNode } from "react";

// Mock Supabase
const mockUpload = vi.fn();
const mockEq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: mockUpload,
      }),
    },
    from: () => ({
      update: () => ({
        eq: mockEq,
      }),
    }),
  },
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock logger
vi.mock("@/lib/errorLogger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { useBoletoUpload } from "../useBoletoUpload";
import { toast } from "sonner";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

// Helper to wait for mutation to complete
const waitForMutation = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
};

describe("useBoletoUpload - File Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockReset();
    mockEq.mockReset();
  });

  it("should reject files with invalid MIME type", async () => {
    const { result } = renderHook(() => useBoletoUpload(), {
      wrapper: createWrapper(),
    });

    const invalidFile = new File(["content"], "test.exe", {
      type: "application/x-msdownload",
    });

    act(() => {
      result.current.mutate({
        paymentId: "payment-123",
        projectId: "project-123",
        file: invalidFile,
      });
    });

    await waitForMutation();

    expect(result.current.isError).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Tipo de arquivo não permitido"),
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("should reject files larger than 10MB", async () => {
    const { result } = renderHook(() => useBoletoUpload(), {
      wrapper: createWrapper(),
    });

    // Create a file with size > 10MB
    const largeContent = new ArrayBuffer(11 * 1024 * 1024);
    const largeFile = new File([largeContent], "large.pdf", {
      type: "application/pdf",
    });

    act(() => {
      result.current.mutate({
        paymentId: "payment-123",
        projectId: "project-123",
        file: largeFile,
      });
    });

    await waitForMutation();

    expect(result.current.isError).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Arquivo muito grande"),
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("should accept valid PDF files", async () => {
    mockUpload.mockResolvedValueOnce({ error: null });
    mockEq.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useBoletoUpload(), {
      wrapper: createWrapper(),
    });

    const validFile = new File(["pdf content"], "boleto.pdf", {
      type: "application/pdf",
    });

    act(() => {
      result.current.mutate({
        paymentId: "payment-123",
        projectId: "project-123",
        file: validFile,
      });
    });

    await waitForMutation();

    // Should attempt upload
    expect(mockUpload).toHaveBeenCalled();
  });

  it("should accept valid PNG files", async () => {
    mockUpload.mockResolvedValueOnce({ error: null });
    mockEq.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useBoletoUpload(), {
      wrapper: createWrapper(),
    });

    const validFile = new File(["png content"], "boleto.png", {
      type: "image/png",
    });

    act(() => {
      result.current.mutate({
        paymentId: "payment-123",
        projectId: "project-123",
        file: validFile,
      });
    });

    await waitForMutation();

    expect(mockUpload).toHaveBeenCalled();
  });

  it("should accept valid JPEG files", async () => {
    mockUpload.mockResolvedValueOnce({ error: null });
    mockEq.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useBoletoUpload(), {
      wrapper: createWrapper(),
    });

    const validFile = new File(["jpeg content"], "boleto.jpg", {
      type: "image/jpeg",
    });

    act(() => {
      result.current.mutate({
        paymentId: "payment-123",
        projectId: "project-123",
        file: validFile,
      });
    });

    await waitForMutation();

    expect(mockUpload).toHaveBeenCalled();
  });

  it("should use MIME type to determine extension (not file name)", async () => {
    mockUpload.mockResolvedValueOnce({ error: null });
    mockEq.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useBoletoUpload(), {
      wrapper: createWrapper(),
    });

    // File has .exe extension but PDF MIME type - should be saved as .pdf
    const sneakyFile = new File(["pdf content"], "virus.exe", {
      type: "application/pdf",
    });

    act(() => {
      result.current.mutate({
        paymentId: "payment-123",
        projectId: "project-123",
        file: sneakyFile,
      });
    });

    await waitForMutation();

    expect(mockUpload).toHaveBeenCalledWith(
      "project-123/payment-123.pdf", // Extension from MIME, not file name
      expect.any(File),
      expect.any(Object),
    );
  });
});

describe("useBoletoUpload - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockReset();
    mockEq.mockReset();
  });

  it("should show RLS error message for permission issues", async () => {
    mockUpload.mockResolvedValueOnce({
      error: { message: "new row violates row-level security policy" },
    });

    const { result } = renderHook(() => useBoletoUpload(), {
      wrapper: createWrapper(),
    });

    const validFile = new File(["pdf content"], "boleto.pdf", {
      type: "application/pdf",
    });

    act(() => {
      result.current.mutate({
        paymentId: "payment-123",
        projectId: "project-123",
        file: validFile,
      });
    });

    await waitForMutation();

    expect(result.current.isError).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(
      "Apenas administradores podem anexar boletos",
    );
  });
});
