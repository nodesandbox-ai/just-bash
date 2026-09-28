import { describe, expect, it } from "vitest";
import { Bash } from "../Bash.js";

// Claude Code's shell snapshot shadows grep/find with these functions (the
// ant-native "embedded bfs/ugrep" wrappers). CLAUDE_CODE_EXECPATH points at a
// node binary that is not executable here, so each call falls back to
// `command grep ${1+"$@"}`. That fallback must pass every argument through
// separately; joining them made `grep -c red sample.txt` one argument.
const find = [
  "function find {",
  '  local _cc_bin="${CLAUDE_CODE_EXECPATH:-}"',
  "  [[ -x $_cc_bin ]] || _cc_bin=/root/.local/bin/claude",
  '  if [[ ! -x $_cc_bin ]]; then command find ${1+"$@"}; return; fi',
  '  (exec -a bfs "$_cc_bin" -S dfs -regextype findutils-default ${1+"$@"})',
  "}",
].join("\n");

const grep = [
  "function grep {",
  "  local _cc_a",
  '  for _cc_a in ${1+"$@"}; do',
  '    case "$_cc_a" in -*-filter*|-*-pager*|-*-view*|-*-format-open*|-*-config*|---*|-@*|-*-save-config*|-[Zz]*|-[!-]*[Zz]*|--null|--null-data) command grep ${1+"$@"}; return ;; esac',
  "  done",
  '  local _cc_bin="${CLAUDE_CODE_EXECPATH:-}"',
  "  [[ -x $_cc_bin ]] || _cc_bin=/root/.local/bin/claude",
  '  if [[ ! -x $_cc_bin ]]; then command grep ${1+"$@"}; return; fi',
  '  (exec -a ugrep "$_cc_bin" -G --ignore-files --hidden -I ${1+"$@"})',
  "}",
].join("\n");

async function run(command: string) {
  const bash = new Bash({
    cwd: "/work",
    env: { CLAUDE_CODE_EXECPATH: "/bin/node" },
    files: { "/work/sample.txt": "alpha red\nbeta\nred gamma\n" },
  });
  return bash.exec(`${find}\n${grep}\n${command}`);
}

describe("Claude Code grep/find wrapper functions", () => {
  it("grep PATTERN FILE reads the file", async () => {
    const r = await run("grep beta sample.txt");
    expect(r.stdout).toBe("beta\n");
    expect(r.exitCode).toBe(0);
  });

  it("does not join the pattern and file into one stdin pattern", async () => {
    const r = await run(
      "printf 'beta sample.txt\\nnope\\n' | grep beta sample.txt",
    );
    expect(r.stdout).toBe("beta\n");
  });

  it("grep -c counts matching lines", async () => {
    const r = await run("grep -c red sample.txt");
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe("2\n");
  });

  it("grep -n -i prints numbered, case-insensitive matches", async () => {
    const r = await run("grep -n -i RED sample.txt");
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe("1:alpha red\n3:red gamma\n");
  });

  it("grep -z takes the wrapper's early command-grep path", async () => {
    const r = await run("printf 'a\\0beta\\0' | grep -z beta | od -c");
    expect(r.stdout).toContain("b   e   t   a  \\0");
  });

  it("find . -type f lists files", async () => {
    const r = await run("find . -type f");
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe("./sample.txt\n");
  });

  it("find with several predicates", async () => {
    const r = await run("find . -name '*.txt' -type f");
    expect(r.stdout).toBe("./sample.txt\n");
  });
});
