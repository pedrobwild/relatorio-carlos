import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutoSave } from "@/hooks/useAutoSave";
import { readOfflineSnapshot } from "@/lib/offlineAutoSaveQueue";

const KEY = "test-report";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value,
    configurable: true,
    writable: true,
  });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

describe("useAutoSave — fila offline", () => {
  beforeEach(() => {
    localStorage.clear();
    setOnline(true);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("guarda a alteração localmente quando está sem conexão e sincroniza ao voltar", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender, result } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 10, offlineKey: KEY }),
      { initialProps: { data: { texto: "inicial" } } },
    );

    setOnline(false);
    rerender({ data: { texto: "editado offline" } });
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.status).toBe("offline");
    expect(result.current.hasOfflineChanges).toBe(true);
    expect(readOfflineSnapshot<{ texto: string }>(KEY)?.data.texto).toBe(
      "editado offline",
    );

    await act(async () => {
      setOnline(true);
    });

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ texto: "editado offline" });
    await waitFor(() => expect(readOfflineSnapshot(KEY)).toBeNull());
  });

  it("limpa a fila após uma gravação bem-sucedida online", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ data }) => useAutoSave({ data, onSave, debounceMs: 10, offlineKey: KEY }),
      { initialProps: { data: { texto: "a" } } },
    );

    rerender({ data: { texto: "b" } });
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(readOfflineSnapshot(KEY)).toBeNull();
  });
});
