import { describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";

/**
 * Output options programs rely on when they run rg and parse what it prints:
 * --json with context lines, multiline matches and byte offsets,
 * --max-columns, --null after file names, --sort=modified and --no-config.
 *
 * Expected output measured against ripgrep 14.1.1.
 */

const FILES = {
  "/w/a.ts": "export const alpha = 1;\nconst beta = 2;\nconst Alpha = 3;\n",
  "/w/u.ts": 'const é = "alpha";\n// 日本 alpha and alpha\nlast beta',
  "/w/multi.ts": "alpha one\nfiller\nfiller\nbeta two\nalpha three\n",
  "/w/long.ts": `const long = "${"x".repeat(40)} alpha";\nconst short = "alpha";\n`,
};

async function run(command: string) {
  const bash = new Bash({ cwd: "/w", files: FILES });
  return bash.exec(command);
}

/** The per-file messages, without the timing stats ripgrep adds. */
async function json(command: string): Promise<unknown[]> {
  const result = await run(command);
  expect(result.stderr).toBe("");
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((message) => message.type !== "summary")
    .map((message) => {
      delete message.data.stats;
      return message;
    });
}

const path = (text: string) => ({ text });

describe("rg --json", () => {
  it("reports context lines around a match", async () => {
    expect(await json("rg --json -n -C 1 -s beta a.ts")).toEqual([
      { type: "begin", data: { path: path("a.ts") } },
      {
        type: "context",
        data: {
          path: path("a.ts"),
          lines: { text: "export const alpha = 1;\n" },
          line_number: 1,
          absolute_offset: 0,
          submatches: [],
        },
      },
      {
        type: "match",
        data: {
          path: path("a.ts"),
          lines: { text: "const beta = 2;\n" },
          line_number: 2,
          absolute_offset: 24,
          submatches: [{ match: { text: "beta" }, start: 6, end: 10 }],
        },
      },
      {
        type: "context",
        data: {
          path: path("a.ts"),
          lines: { text: "const Alpha = 3;\n" },
          line_number: 3,
          absolute_offset: 40,
          submatches: [],
        },
      },
      { type: "end", data: { path: path("a.ts"), binary_offset: null } },
    ]);
  });

  it("reports a multiline match as one message holding its lines", async () => {
    expect(
      await json("rg --json -U --multiline-dotall 'one.*?filler' multi.ts"),
    ).toEqual([
      { type: "begin", data: { path: path("multi.ts") } },
      {
        type: "match",
        data: {
          path: path("multi.ts"),
          lines: { text: "alpha one\nfiller\n" },
          line_number: 1,
          absolute_offset: 0,
          submatches: [{ match: { text: "one\nfiller" }, start: 6, end: 16 }],
        },
      },
      { type: "end", data: { path: path("multi.ts"), binary_offset: null } },
    ]);
  });

  it("counts offsets in UTF-8 bytes", async () => {
    expect(await json("rg --json alpha u.ts")).toEqual([
      { type: "begin", data: { path: path("u.ts") } },
      {
        type: "match",
        data: {
          path: path("u.ts"),
          lines: { text: 'const é = "alpha";\n' },
          line_number: 1,
          absolute_offset: 0,
          submatches: [{ match: { text: "alpha" }, start: 12, end: 17 }],
        },
      },
      {
        type: "match",
        data: {
          path: path("u.ts"),
          lines: { text: "// 日本 alpha and alpha\n" },
          line_number: 2,
          absolute_offset: 20,
          submatches: [
            { match: { text: "alpha" }, start: 10, end: 15 },
            { match: { text: "alpha" }, start: 20, end: 25 },
          ],
        },
      },
      { type: "end", data: { path: path("u.ts"), binary_offset: null } },
    ]);
  });

  it("keeps a last line without a newline as it is", async () => {
    const messages = await json("rg --json -C 2 beta u.ts");
    expect(messages.at(-2)).toEqual({
      type: "match",
      data: {
        path: path("u.ts"),
        lines: { text: "last beta" },
        line_number: 3,
        absolute_offset: 46,
        submatches: [{ match: { text: "beta" }, start: 5, end: 9 }],
      },
    });
  });

  it("prints whole lines whatever --max-columns says", async () => {
    const messages = await json("rg --json -M 5 short long.ts");
    expect(messages[1]).toMatchObject({
      data: { lines: { text: 'const short = "alpha";\n' } },
    });
  });
});

describe("rg --max-columns", () => {
  it("omits long matching and context lines", async () => {
    const result = await run("rg -n --max-columns 25 -C 1 short long.ts");
    expect(result.stdout).toBe(
      '1-[Omitted long context line]\n2:const short = "alpha";\n',
    );
    expect(result.exitCode).toBe(0);
  });

  it("measures the printed match with -o", async () => {
    const result = await run("rg -n -o -M 20 alpha long.ts");
    expect(result.stdout).toBe("1:alpha\n2:alpha\n");
  });

  it("omits a long matching line", async () => {
    const result = await run("rg -n --max-columns=20 short long.ts");
    expect(result.stdout).toBe("2:[Omitted long matching line]\n");
  });

  it("has no limit at 0", async () => {
    const result = await run("rg -n -M 0 short long.ts");
    expect(result.stdout).toBe('2:const short = "alpha";\n');
  });

  it("rejects a value that is not a count", async () => {
    const result = await run("rg -M x short long.ts");
    expect(result.stderr).toBe("rg: invalid --max-columns value: x\n");
    expect(result.exitCode).toBe(1);
  });
});

describe("rg --null", () => {
  it("follows the file name with NUL in count output", async () => {
    const result = await run("rg -c -H --null beta a.ts multi.ts");
    expect(result.stdout).toBe("a.ts\x001\nmulti.ts\x001\n");
  });

  it("follows the file name with NUL on match and context lines", async () => {
    const result = await run("rg -n -H --null -C 1 -s beta a.ts");
    expect(result.stdout).toBe(
      "a.ts\x001-export const alpha = 1;\na.ts\x002:const beta = 2;\na.ts\x003-const Alpha = 3;\n",
    );
  });
});

describe("rg --sort=modified", () => {
  it("lists the least recently modified files first", async () => {
    const bash = new Bash({ cwd: "/w", files: FILES });
    await bash.exec(
      "touch -d 2024-01-01 long.ts && touch -d 2021-01-01 u.ts && touch -d 2023-01-01 a.ts && touch -d 2022-01-01 multi.ts",
    );
    const listed = await bash.exec("rg --files --sort=modified");
    expect(listed.stdout).toBe("u.ts\nmulti.ts\na.ts\nlong.ts\n");
    const matched = await bash.exec("rg -l --sort modified alpha");
    expect(matched.stdout).toBe("u.ts\nmulti.ts\na.ts\nlong.ts\n");
  });
});

describe("rg --no-config", () => {
  it("is accepted, as there is no config file to skip", async () => {
    const result = await run("rg --no-config -n beta a.ts");
    expect(result.stdout).toBe("2:const beta = 2;\n");
    expect(result.exitCode).toBe(0);
  });
});
