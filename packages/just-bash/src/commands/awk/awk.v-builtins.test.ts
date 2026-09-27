import { describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";

describe("awk -v and field separators", () => {
  const run = (command: string) => new Bash().exec(command);

  it("-v FS sets the field separator", async () => {
    expect((await run("echo a:b | awk -v FS=: '{print $1}'")).stdout).toBe(
      "a\n",
    );
  });

  it("-v OFS and -v ORS set the output separators", async () => {
    expect(
      (await run("echo 'a b' | awk -v OFS='|' '{$1=$1; print}'")).stdout,
    ).toBe("a|b\n");
    expect(
      (await run("printf 'a\\nb\\n' | awk -v ORS=';' '{print}'")).stdout,
    ).toBe("a;b;");
  });

  it("accepts the attached -vNAME=VALUE form", async () => {
    expect((await run("echo x | awk -vn=5 '{print n}'")).stdout).toBe("5\n");
  });

  it("treats a single-character FS as literal", async () => {
    expect((await run("echo 'a|b' | awk -F'|' '{print $2}'")).stdout).toBe(
      "b\n",
    );
    expect((await run("echo 'a|b' | awk -v 'FS=|' '{print $2}'")).stdout).toBe(
      "b\n",
    );
    expect(
      (await run(`echo 'a.b' | awk 'BEGIN{FS="."}{print $2}'`)).stdout,
    ).toBe("b\n");
  });

  it("still treats a longer FS as a regex", async () => {
    expect(
      (await run("echo 'a1b22c' | awk -F'[0-9]+' '{print $3}'")).stdout,
    ).toBe("c\n");
  });
});
