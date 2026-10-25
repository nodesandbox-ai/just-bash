import { describe, expect, it } from "vitest";
import { isIncomplete } from "./parser.js";

describe("isIncomplete", () => {
  it("waits for the rest of an open quote, substitution or here-document", () => {
    for (const source of [
      "echo 'abc",
      'echo "abc',
      "echo $(ls",
      "echo `ls",
      "echo ${x",
      "cat > s.ts <<'EOF'\nconst a = 1;",
      "cat <<EOF",
      "cat <<-EOF\n\tbody",
    ]) {
      expect(isIncomplete(source), source).toBe(true);
    }
  });

  it("waits for a compound command's closing word", () => {
    for (const source of [
      "if true; then",
      "if true; then\n  echo a",
      "if true; then echo a; else",
      "for i in 1 2; do",
      "while true",
      "until false; do echo",
      "case x in",
      "case x in a) echo",
      "f() {",
      "{ echo a",
      "( echo a",
      "[[ -n x",
    ]) {
      expect(isIncomplete(source), source).toBe(true);
    }
  });

  it("waits after a trailing operator or backslash", () => {
    for (const source of [
      "echo a |",
      "echo a |&",
      "echo a &&",
      "echo a ||\n",
      "echo a \\",
      "echo a\\",
    ]) {
      expect(isIncomplete(source), source).toBe(true);
    }
  });

  it("treats finished input and real syntax errors as complete", () => {
    for (const source of [
      "",
      "echo hi",
      "echo 'a' \"b\" $(ls) `pwd`",
      "cat <<'EOF'\nbody\nEOF",
      "if true; then echo a; fi",
      "for i in 1; do echo $i; done",
      "f() { echo; }",
      "echo a \\\\",
      "echo a # trailing \\",
      "echo a &",
      "echo )",
      "fi",
      "if true; then fi",
      "echo a | | b",
    ]) {
      expect(isIncomplete(source), source).toBe(false);
    }
  });
});
