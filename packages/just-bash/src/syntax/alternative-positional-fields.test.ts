import { describe, expect, it } from "vitest";
import { Bash } from "../Bash.js";

// ${1+"$@"} is a portability idiom for "$@" used by shell wrappers (e.g. the
// grep/find functions Claude Code installs). The quoted operand must keep its
// field boundaries instead of collapsing into one word.
describe('unquoted ${x+"$@"} keeps field boundaries', () => {
  const run = async (script: string) => (await new Bash().exec(script)).stdout;

  it('expands ${1+"$@"} like "$@"', async () => {
    expect(
      await run('f() { printf "[%s]" ${1+"$@"}; echo; }; f a "b c" d; f'),
    ).toBe("[a][b c][d]\n[]\n");
  });

  it("keeps fields in a for loop word list", async () => {
    expect(
      await run(
        'g() { for x in ${1+"$@"}; do printf "<%s>" "$x"; done; echo; }; g -e x "y z"',
      ),
    ).toBe("<-e><x><y z>\n");
  });

  it("honors :+ emptiness", async () => {
    expect(
      await run('h() { printf "[%s]" ${1:+"$@"}; echo; }; h "" "p q"'),
    ).toBe("[]\n");
  });

  it("expands array operands and prefix/suffix text", async () => {
    expect(
      await run(
        'arr=("a 1" b); printf "[%s]" ${arr+"${arr[@]}"}; echo; set -- "m n" o; printf "[%s]" ${1+pre"$@"post}; echo',
      ),
    ).toBe("[a 1][b]\n[prem n][opost]\n");
  });

  it('uses ${x-"$@"} only when x is unset', async () => {
    expect(await run('set -- "m n" o; printf "[%s]" ${nope-"$@"}; echo')).toBe(
      "[m n][o]\n",
    );
  });
});
