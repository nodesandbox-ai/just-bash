import { describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";

describe("cut --complement and selection order", () => {
  const run = (command: string) => new Bash().exec(command);

  it("--complement drops the listed fields", async () => {
    expect((await run("echo a,b,c | cut -d, -f2 --complement")).stdout).toBe(
      "a,c\n",
    );
  });

  it("--complement drops the listed characters", async () => {
    expect((await run("echo abcdef | cut -c2-3 --complement")).stdout).toBe(
      "adef\n",
    );
  });

  it("prints fields in input order", async () => {
    expect((await run("echo a,b,c,d | cut -d, -f3,1")).stdout).toBe("a,c\n");
  });

  it("does not repeat characters from overlapping ranges", async () => {
    expect((await run("echo abcdef | cut -c1-3,2-4")).stdout).toBe("abcd\n");
  });
});
