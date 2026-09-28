import { describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";

describe("xargs attached and long option values", () => {
  const run = (command: string) => new Bash().exec(command);

  it("-I{} replaces per input line", async () => {
    const r = await run("printf 'x\\ny\\n' | xargs -I{} echo '<{}>'");
    expect(r.stdout).toBe("<x>\n<y>\n");
  });

  it("-i is -I {}", async () => {
    const r = await run("printf 'p\\nq\\n' | xargs -i echo '[{}]'");
    expect(r.stdout).toBe("[p]\n[q]\n");
  });

  it("-n1 and --max-args=2 limit arguments per command", async () => {
    expect((await run("echo a b c | xargs -n1 echo")).stdout).toBe("a\nb\nc\n");
    expect((await run("echo a b c | xargs --max-args=2 echo")).stdout).toBe(
      "a b\nc\n",
    );
  });

  it("-d, attaches the delimiter", async () => {
    expect((await run("printf 'u,v' | xargs -d, -n1 echo")).stdout).toBe(
      "u\nv\n",
    );
  });

  it("leaves option-like words in the command alone", async () => {
    expect((await run("echo hi | xargs echo -n1")).stdout).toBe("-n1 hi\n");
  });
});
