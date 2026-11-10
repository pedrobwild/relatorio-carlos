/**
 * Relatório da semana em passos (celular): mesma fonte de estado do editor,
 * fotos primeiro, e salvar só no último passo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WeeklyReportStepsMobile from "../WeeklyReportStepsMobile";
import { stashReportPhotos } from "@/lib/pendingReportPhotos";
import type { useEditorState } from "../editor/useEditorState";

type State = ReturnType<typeof useEditorState>;

const makeState = (over: Partial<Record<keyof State, unknown>> = {}) =>
  ({
    formData: {
      weekNumber: 6,
      periodStart: "2026-11-03",
      periodEnd: "2026-11-07",
      executiveSummary: "",
      lookaheadTasks: [],
      risksAndIssues: [],
      clientDecisions: [],
      incidents: [],
      gallery: [
        { id: "f1", url: "blob:1", caption: "", area: "Banheiro", date: "2026-11-04", category: "progresso" },
        { id: "f2", url: "blob:2", caption: "", area: "", date: "2026-11-04", category: "progresso" },
      ],
    },
    serverCheck: { diverged: false },
    offlineConflict: { conflict: null },
    applyServerVersion: vi.fn(),
    uploadQueue: { pending: [{ id: "f2" }], blocked: [], isProcessing: true, retryNow: vi.fn() },
    isSaving: false,
    lastSaved: null,
    autoSaveStatus: "idle",
    retryInSeconds: null,
    autoSaveError: null,
    retryAutoSave: vi.fn(),
    richTextOpen: false,
    setRichTextOpen: vi.fn(),
    handleSave: vi.fn(),
    handleBulkFileSelect: vi.fn(),
    updateExecutiveSummary: vi.fn(),
    updateGalleryPhoto: vi.fn(),
    removeGalleryPhoto: vi.fn(),
    ...over,
  }) as unknown as State;

vi.mock("../editor/ServerDivergenceAlert", () => ({ default: () => <div data-testid="alerta-divergencia" /> }));
vi.mock("../editor/OfflineConflictAlert", () => ({ default: () => <div data-testid="alerta-conflito" /> }));
vi.mock("../editor/PendingUploadsBanner", () => ({ default: () => <div data-testid="alerta-uploads" /> }));

describe("WeeklyReportStepsMobile", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("abre no passo 1 (Fotos), com câmera, galeria e os três alertas do editor", () => {
    const { container } = render(<WeeklyReportStepsMobile state={makeState()} projectId="p1" />);
    expect(screen.getByRole("heading", { level: 1, name: "Relatório · semana 6" })).toBeInTheDocument();
    expect(screen.getByText("Passo 1 de 5 · Fotos")).toBeInTheDocument();
    expect(screen.getByText("Tirar foto")).toBeInTheDocument();
    expect(screen.getByText("Da galeria")).toBeInTheDocument();
    const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveAttribute("capture", "environment");
    expect(inputs[1]).toHaveAttribute("multiple");
    expect(screen.getByTestId("alerta-divergencia")).toBeInTheDocument();
    expect(screen.getByTestId("alerta-conflito")).toBeInTheDocument();
    expect(screen.getByTestId("alerta-uploads")).toBeInTheDocument();
    expect(screen.getByText("2 fotos · 1 enviando")).toBeInTheDocument();
    expect(screen.getByText("Enviando")).toBeInTheDocument();
  });

  it("câmera e galeria usam o mesmo handler do editor; ambiente edita a foto", () => {
    const state = makeState();
    const { container } = render(<WeeklyReportStepsMobile state={state} projectId="p1" />);
    const [camera] = Array.from(container.querySelectorAll('input[type="file"]'));
    fireEvent.change(camera, { target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] } });
    expect(state.handleBulkFileSelect).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("textbox", { name: "Ambiente: Foto 2" }), { target: { value: "Cozinha" } });
    expect(state.updateGalleryPhoto).toHaveBeenCalledWith(1, "area", "Cozinha");
    fireEvent.click(screen.getByRole("button", { name: "Remover foto 1" }));
    expect(state.removeGalleryPhoto).toHaveBeenCalledWith(0);
  });

  it("avança pelos cinco passos e só salva no último", () => {
    const state = makeState();
    render(<WeeklyReportStepsMobile state={state} projectId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar: Resumo" }));
    expect(screen.getByText("Passo 2 de 5 · Resumo")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pintura iniciada." } });
    expect(state.updateExecutiveSummary).toHaveBeenCalledWith("Pintura iniciada.");
    fireEvent.click(screen.getByRole("button", { name: "Continuar: Próxima semana" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar: Atenção" }));
    expect(screen.getByText("Passo 4 de 5 · Atenção")).toBeInTheDocument();
    expect(state.handleSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuar: Enviar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar relatório" }));
    expect(state.handleSave).toHaveBeenCalledTimes(1);
  });

  it("fotos tiradas fora do relatório entram pelo handler de vários arquivos", () => {
    const state = makeState();
    const foto = new File(["x"], "obra.jpg", { type: "image/jpeg" });
    stashReportPhotos("p1", [foto]);
    render(<WeeklyReportStepsMobile state={state} projectId="p1" />);
    expect(state.handleBulkFileSelect).toHaveBeenCalledTimes(1);
    const evento = (state.handleBulkFileSelect as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(Array.from(evento.target.files)).toEqual([foto]);
  });
});
