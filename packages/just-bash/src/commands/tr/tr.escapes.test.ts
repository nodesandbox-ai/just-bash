import { describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";

describe("tr escape sequences", () => {
  const run = (command: string) => new Bash().exec(command);

  it("\\0 is NUL", async () => {
    expect((await run("printf 'x\\0y\\0' | tr '\\0' '|'")).stdout).toBe("x|y|");
  });

  it("\\NNN is an octal character code", async () => {
    expect((await run("echo abc | tr '\\141' 'A'")).stdout).toBe("Abc\n");
    expect((await run("printf 'a b' | tr ' ' '\\012'")).stdout).toBe("a\nb");
  });

  it("supports \\a, \\b, \\f and \\v", async () => {
    const r = await run("printf 'a\\vb' | tr '\\v' '-'");
    expect(r.stdout).toBe("a-b");
  });
});
