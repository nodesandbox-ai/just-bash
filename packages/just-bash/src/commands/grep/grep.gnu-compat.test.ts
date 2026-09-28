import { describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";

describe("grep GNU compatibility", () => {
  const run = (command: string) =>
    new Bash({
      cwd: "/w",
      files: { "/w/s.txt": "alpha red\nbeta\nred gamma\ngamma\nred\n" },
    }).exec(command);

  it("OR-combines repeated -e patterns", async () => {
    const r = await run("grep -e alpha -e beta -e gamma s.txt");
    expect(r.stdout).toBe("alpha red\nbeta\nred gamma\ngamma\n");
  });

  it("accepts attached -ePATTERN and --regexp", async () => {
    const r = await run("grep -ebeta --regexp=alpha --regexp gamma s.txt");
    expect(r.stdout).toBe("alpha red\nbeta\nred gamma\ngamma\n");
  });

  it("caps -c at -m NUM", async () => {
    expect((await run("grep -m1 -c red s.txt")).stdout).toBe("1\n");
    expect((await run("grep -m 2 -c red s.txt")).stdout).toBe("2\n");
    expect((await run("grep -c red s.txt")).stdout).toBe("3\n");
  });

  it("-H prints the file name for a single file and stdin", async () => {
    expect((await run("grep -H beta s.txt")).stdout).toBe("s.txt:beta\n");
    expect((await run("echo beta | grep -H beta")).stdout).toBe(
      "(standard input):beta\n",
    );
  });

  it("accepts --color / --colour and never colors", async () => {
    expect((await run("grep --color=always beta s.txt")).stdout).toBe("beta\n");
    expect((await run("grep --colour beta s.txt")).stdout).toBe("beta\n");
  });

  it("-z reads and writes NUL-terminated records", async () => {
    const r = await run(
      "printf 'a\\0beta\\0gamma\\nbeta2\\0' | grep -z beta | tr '\\0' '|'",
    );
    expect(r.stdout).toBe("beta|gamma\nbeta2|");
  });
});
