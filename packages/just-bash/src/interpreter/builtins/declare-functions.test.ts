import { describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";

describe("declare -f prints function definitions", () => {
  const run = (command: string) => new Bash().exec(command);

  it("prints a named function's definition", async () => {
    const r = await run('function g { echo "$@"; }; declare -f g');
    expect(r.stdout).toBe('g () \n{ \n    echo "$@"\n}\n');
    expect(r.exitCode).toBe(0);
  });

  it("prints every function, sorted, with no names", async () => {
    const r = await run("b() { echo b; }; a() { echo a; }; declare -f");
    expect(r.stdout).toBe(
      "a () \n{ \n    echo a\n}\nb () \n{ \n    echo b\n}\n",
    );
  });

  it("exits 1 for an unknown function", async () => {
    const r = await run("declare -f nope");
    expect(r.stdout).toBe("");
    expect(r.exitCode).toBe(1);
  });
});
