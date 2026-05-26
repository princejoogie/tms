export function parseKeys(input: string) {
  const keys: string[] = [];

  for (let index = 0; index < input.length; ) {
    const rest = input.slice(index);
    const sequence = parseSequence(rest);
    if (sequence) {
      if (sequence.key) {
        keys.push(sequence.key);
      }
      index += sequence.length;
      continue;
    }

    const char = Array.from(rest)[0] ?? "";
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint >= 32 && codePoint !== 127) {
      keys.push(char);
    }
    index += char.length || 1;
  }

  return keys;
}

function parseSequence(input: string): { key: string; length: number } | undefined {
  if (input.startsWith("\x1b[A")) return { key: "up", length: 3 };
  if (input.startsWith("\x1b[B")) return { key: "down", length: 3 };
  if (input.startsWith("\x1bOA")) return { key: "up", length: 3 };
  if (input.startsWith("\x1bOB")) return { key: "down", length: 3 };
  if (input.startsWith("\x1b[3~")) return { key: "delete", length: 4 };
  const terminalReplyLength = parseTerminalReplyLength(input);
  if (terminalReplyLength) return { key: "", length: terminalReplyLength };
  if (input.startsWith("\x7f") || input.startsWith("\b")) return { key: "backspace", length: 1 };
  if (input.startsWith("\t")) return { key: "tab", length: 1 };
  if (input.startsWith("\x03")) return { key: "ctrl-c", length: 1 };
  if (input.startsWith("\x0e")) return { key: "ctrl-n", length: 1 };
  if (input.startsWith("\x10")) return { key: "ctrl-p", length: 1 };
  if (input.startsWith("\x0a")) return { key: "ctrl-j", length: 1 };
  if (input.startsWith("\x0b")) return { key: "ctrl-k", length: 1 };
  if (input.startsWith("\r")) return { key: "enter", length: 1 };
  if (input.startsWith("\x1b")) return { key: "escape", length: 1 };
  return undefined;
}

function parseTerminalReplyLength(input: string) {
  if (input.startsWith("\x1b]")) {
    const bel = input.indexOf("\x07", 2);
    const st = input.indexOf("\x1b\\", 2);
    return sequenceEnd(input, bel, st);
  }

  if (input.startsWith("\x1bP")) {
    const st = input.indexOf("\x1b\\", 2);
    return st === -1 ? undefined : st + 2;
  }

  const csiReply = /^\x1b\[[0-9;?$> ]+(?:\$?[A-Za-z]|~)/.exec(input);
  return csiReply?.[0].length;
}

function sequenceEnd(input: string, ...ends: number[]) {
  const end = ends.filter((value) => value !== -1).sort((a, b) => a - b)[0];
  if (end === undefined) {
    return undefined;
  }

  return input.startsWith("\x1b\\", end) ? end + 2 : end + 1;
}
