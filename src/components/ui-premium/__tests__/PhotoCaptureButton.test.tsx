import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotoCaptureButton } from "../PhotoCaptureButton";

vi.mock("browser-image-compression", () => ({
  __esModule: true,
  default: vi.fn(async (file: File) => file),
}));

const setMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const setInnerWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
};

describe("PhotoCaptureButton", () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setInnerWidth(1280);
    setMatchMedia(false);
    createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation(() => "blob:mock");
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it("renders the upload label on desktop", () => {
    render(<PhotoCaptureButton onCapture={vi.fn()} />);
    expect(screen.getByRole("button", { name: /selecionar foto/i })).toBeInTheDocument();
  });

  it("renders the camera label on mobile", () => {
    setInnerWidth(375);
    setMatchMedia(true);
    render(<PhotoCaptureButton onCapture={vi.fn()} />);
    expect(screen.getByRole("button", { name: /tirar foto/i })).toBeInTheDocument();
  });

  it("uses capture=environment when alwaysCapture is true", () => {
    const { container } = render(
      <PhotoCaptureButton onCapture={vi.fn()} alwaysCapture />,
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    expect(input.getAttribute("capture")).toBe("environment");
  });

  it("compresses and previews the selected file before submit", async () => {
    const user = userEvent.setup();
    const onCapture = vi.fn();
    const { container } = render(<PhotoCaptureButton onCapture={onCapture} />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;

    const file = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByAltText(/foto 1/i)).toBeInTheDocument();
    });
    expect(onCapture).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /enviar foto/i }));

    expect(onCapture).toHaveBeenCalledTimes(1);
    const captured = onCapture.mock.calls[0][0];
    expect(captured).toHaveLength(1);
    expect(captured[0].file.name).toBe("photo.jpg");
  });

  it("removes a pending photo when the trash button is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<PhotoCaptureButton onCapture={vi.fn()} />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;

    const file = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByAltText(/foto 1/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /remover foto 1/i }));

    expect(screen.queryByAltText(/foto 1/i)).toBeNull();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock");
  });

  it("ignores files that are not images", async () => {
    const user = userEvent.setup();
    const onCapture = vi.fn();
    const { container } = render(<PhotoCaptureButton onCapture={onCapture} />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;

    const file = new File(["abc"], "doc.pdf", { type: "application/pdf" });
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /selecionar foto/i })).toBeInTheDocument();
    });
    expect(screen.queryByAltText(/foto 1/i)).toBeNull();
  });
});
