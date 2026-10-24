import { describe, expect, it } from "vitest";
import { Bash } from "../Bash.js";
import { defineCommand } from "../custom-commands.js";
import { shebangInterpreter } from "./subshell-group.js";

describe("executable scripts", () => {
  it.each([
    2, 1,
  ])("continues a semicolon list after a script exits %i", async (exitCode) => {
    const env = new Bash({
      files: {
        "/scripts/fail.sh": `exit ${exitCode}\n`,
      },
    });
    await env.exec("chmod +x /scripts/fail.sh");

    const result = await env.exec("/scripts/fail.sh ; echo $?");

    expect(result).toMatchObject({
      stdout: `${exitCode}\n`,
      stderr: "",
      exitCode: 0,
    });
  });

  it("does not continue an AND list after a script fails", async () => {
    const env = new Bash({
      files: {
        "/scripts/fail.sh": "exit 2\n",
      },
    });
    await env.exec("chmod +x /scripts/fail.sh");

    const result = await env.exec("/scripts/fail.sh && echo $?");

    expect(result).toMatchObject({
      stdout: "",
      stderr: "",
      exitCode: 2,
    });
  });

  it("runs a script with the interpreter its #! line names", async () => {
    const node = defineCommand("node", async (args) => ({
      stdout: `node ${args.join(" ")}\n`,
      stderr: "",
      exitCode: 0,
    }));
    const env = new Bash({
      customCommands: [node],
      files: {
        "/bin/tool": "#!/usr/bin/env node\nconsole.log(require('x'))\n",
        "/bin/flagged": "#!/usr/bin/env -S node --no-warnings\n1\n",
        "/bin/sh-tool": "#!/bin/sh\necho shell $1\n",
      },
    });
    await env.exec("chmod +x /bin/tool /bin/flagged /bin/sh-tool");

    expect(await env.exec("PATH=/bin tool a 'b c'")).toMatchObject({
      stdout: "node /bin/tool a b c\n",
      exitCode: 0,
    });
    expect(await env.exec("/bin/flagged x")).toMatchObject({
      stdout: "node --no-warnings /bin/flagged x\n",
      exitCode: 0,
    });
    expect(await env.exec("/bin/sh-tool ok")).toMatchObject({
      stdout: "shell ok\n",
      exitCode: 0,
    });
  });

  it("parses #! lines", () => {
    expect(shebangInterpreter("#!/usr/bin/env node\n")).toEqual({
      name: "node",
      args: [],
    });
    expect(shebangInterpreter("#!/usr/local/bin/python3 -u\n")).toEqual({
      name: "python3",
      args: ["-u"],
    });
    expect(shebangInterpreter("#!/usr/bin/env bash\n")).toBeNull();
    expect(shebangInterpreter("#!/bin/sh\n")).toBeNull();
    expect(shebangInterpreter("echo hi\n")).toBeNull();
  });
});
