import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";

type ClipboardCommand = {
  command: string;
  args: string[];
};

export function copyToClipboard(text: string) {
  for (const command of clipboardCommands()) {
    if (runClipboardCommand(command, text)) {
      return;
    }
  }

  process.stdout.write(osc52Sequence(text));
}

function clipboardCommands(): ClipboardCommand[] {
  if (process.platform === "darwin") {
    return [{ command: "pbcopy", args: [] }];
  }

  if (process.platform === "win32") {
    return [{ command: "clip.exe", args: [] }];
  }

  return [
    { command: "wl-copy", args: [] },
    { command: "xclip", args: ["-selection", "clipboard"] },
    { command: "xsel", args: ["--clipboard", "--input"] },
  ];
}

function runClipboardCommand(command: ClipboardCommand, text: string) {
  const result = spawnSync(command.command, command.args, {
    input: text,
    stdio: ["pipe", "ignore", "ignore"],
    timeout: 1000,
  });

  return !result.error && result.status === 0;
}

function osc52Sequence(text: string) {
  const sequence = `\x1b]52;c;${Buffer.from(text).toString("base64")}\x07`;

  if (!process.env.TMUX) {
    return sequence;
  }

  return `\x1bPtmux;${sequence.replace(/\x1b/g, "\x1b\x1b")}\x1b\\`;
}
