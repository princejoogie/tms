import { $ } from "bun";
import type { Row, Target } from "./types";

export async function openTmuxSession(target: Target) {
  if (target.kind === "session") {
    await openExistingTmuxSession(target.sessionName);
    return;
  }

  if (!(await tmuxHasSession(target.sessionName))) {
    await runTmuxNewSession(target.sessionName, target.path);
  }

  await openExistingTmuxSession(target.sessionName);
}

export async function listTmuxSessionRows(): Promise<Row[]> {
  const result = await $`tmux list-sessions -F "#{session_name}"`.quiet().nothrow();
  if (result.exitCode !== 0) {
    return [];
  }

  return parseTmuxSessionRows(result.stdout.toString());
}

export function parseTmuxSessionRows(output: string): Row[] {
  return output
    .toString()
    .split("\n")
    .filter(Boolean)
    .map((name) => {
      return {
        label: name,
        filterText: name,
        target: {
          display: name,
          path: "",
          sessionName: name,
          kind: "session",
        },
        depth: 0,
        id: `session:${name}`,
      } satisfies Row;
    });
}

async function openExistingTmuxSession(name: string) {
  if (process.env.TMUX) {
    await runTmuxSwitchClient(name);
  } else {
    await runTmuxAttachSession(name);
  }
}

async function tmuxHasSession(name: string) {
  const result = await $`tmux has-session -t ${exactTmuxSessionTarget(name)}`.quiet().nothrow();
  return result.exitCode === 0;
}

async function runTmuxNewSession(name: string, path: string) {
  await $`tmux new-session -d -s ${name} -c ${path}`.quiet();
}

async function runTmuxSwitchClient(name: string) {
  await $`tmux switch-client -t ${exactTmuxSessionTarget(name)}`;
}

async function runTmuxAttachSession(name: string) {
  await $`tmux attach-session -t ${exactTmuxSessionTarget(name)} < ${Bun.stdin}`;
}

export function exactTmuxSessionTarget(name: string) {
  return `=${name}`;
}
