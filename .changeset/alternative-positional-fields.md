---
"just-bash": patch
---

Keep field boundaries when an unquoted `${x+"$@"}` / `${x-"${a[@]}"}` operand applies, so the `${1+"$@"}` idiom expands like `"$@"` instead of joining all arguments into one word.
