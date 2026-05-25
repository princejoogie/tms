import { $ } from "bun";
import type { Target } from "./types";

export async function openTmuxSession(target: Target) {
  if (!(await tmuxHasSession(target.sessionName))) {
    await runTmuxNewSession(target.sessionName, target.path);
  }

  if (process.env.TMUX) {
    await runTmuxSwitchClient(target.sessionName);
  } else {
    await runTmuxAttachSession(target.sessionName);
  }
}

async function tmuxHasSession(name: string) {
  const result = await $`tmux has-session -t ${name}`.quiet().nothrow();
  return result.exitCode === 0;
}

async function runTmuxNewSession(name: string, path: string) {
  await $`tmux new-session -d -s ${name} -c ${path}`.quiet();
}

async function runTmuxSwitchClient(name: string) {
  await $`tmux switch-client -t ${name}`;
}

async function runTmuxAttachSession(name: string) {
  await $`tmux attach-session -t ${name} < ${Bun.stdin}`;
}
