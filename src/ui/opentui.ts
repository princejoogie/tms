import { dlopen, ptr, type Pointer } from "bun:ffi";

export type Color = Uint16Array;

export type RenderLib = ReturnType<typeof loadRenderLib>;

const encoder = new TextEncoder();

export async function createRenderer() {
  const lib = loadRenderLib(await nativeLibraryPath());
  const renderer = lib.symbols.createRenderer(terminalWidth(), terminalHeight(), false, false);

  if (!renderer) {
    throw new Error("Failed to create OpenTUI renderer.");
  }

  lib.symbols.setClearOnShutdown(renderer, true);
  return new NativeRenderer(lib, renderer);
}

export class NativeRenderer {
  width = terminalWidth();
  height = terminalHeight();
  private buffer: Pointer;

  constructor(
    private readonly lib: RenderLib,
    private readonly renderer: Pointer,
  ) {
    this.buffer = requirePointer(this.lib.symbols.getNextBuffer(this.renderer), "Failed to get OpenTUI buffer.");
  }

  clear(color: Color) {
    this.lib.symbols.bufferClear(this.buffer, ptr(color.buffer));
  }

  drawText(x: number, y: number, text: string, fg: Color, bg: Color) {
    if (text.length === 0) return;

    const bytes = encoder.encode(text);
    this.lib.symbols.bufferDrawText(this.buffer, ptr(bytes.buffer), bytes.byteLength, x, y, ptr(fg.buffer), ptr(bg.buffer), 0);
  }

  fillRect(x: number, y: number, width: number, height: number, color: Color) {
    this.lib.symbols.bufferFillRect(this.buffer, x, y, width, height, ptr(color.buffer));
  }

  render() {
    this.lib.symbols.render(this.renderer, true);
  }

  resize() {
    this.width = terminalWidth();
    this.height = terminalHeight();
    this.lib.symbols.resizeRenderer(this.renderer, this.width, this.height);
    this.buffer = requirePointer(this.lib.symbols.getNextBuffer(this.renderer), "Failed to get OpenTUI buffer.");
  }

  destroy() {
    this.lib.symbols.destroyRenderer(this.renderer);
  }
}

export function rgba(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) * 257;
  const green = Number.parseInt(hex.slice(3, 5), 16) * 257;
  const blue = Number.parseInt(hex.slice(5, 7), 16) * 257;
  return new Uint16Array([red, green, blue, 0xffff]);
}

export function terminalWidth() {
  return Math.max(20, process.stdout.columns || 80);
}

export function terminalHeight() {
  return Math.max(8, process.stdout.rows || 24);
}

export function setupTerminal() {
  process.stdout.write("\x1b[?1049h\x1b[?25l");
}

export function restoreTerminal() {
  process.stdout.write("\x1b[0m\x1b[?25h\x1b[?1049l");
}

export function positionCursor(row: number, column: number) {
  process.stdout.write(`\x1b[?25h\x1b[${row};${column}H`);
}

async function nativeLibraryPath() {
  const nativePackage = (await import(`@opentui/core-${process.platform}-${process.arch}`)) as { default: string };
  return normalizeBundledPath(nativePackage.default);
}

function loadRenderLib(path: string) {
  return dlopen(path, {
    createRenderer: { args: ["u32", "u32", "bool", "bool"], returns: "ptr" },
    destroyRenderer: { args: ["ptr"], returns: "void" },
    setClearOnShutdown: { args: ["ptr", "bool"], returns: "void" },
    getNextBuffer: { args: ["ptr"], returns: "ptr" },
    resizeRenderer: { args: ["ptr", "u32", "u32"], returns: "void" },
    bufferClear: { args: ["ptr", "ptr"], returns: "void" },
    bufferDrawText: { args: ["ptr", "ptr", "u32", "u32", "u32", "ptr", "ptr", "u32"], returns: "void" },
    bufferFillRect: { args: ["ptr", "u32", "u32", "u32", "u32", "ptr"], returns: "void" },
    render: { args: ["ptr", "bool"], returns: "void" },
  });
}

function requirePointer(value: Pointer | null, message: string): Pointer {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function normalizeBundledPath(path: string) {
  if (path.includes("$bunfs") || path.includes("~BUN")) {
    return path.replace(/\.\.[/\\]/g, "");
  }
  return path;
}
