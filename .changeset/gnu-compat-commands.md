---
"just-bash": patch
---

GNU compatibility fixes for commands used by agent shells:

- `grep`: repeated `-e` / `--regexp` patterns OR-combine (only the last was used); `-m NUM` caps `-c`; `-H` / `--with-filename`, `-z` / `--null-data` and `--color[=WHEN]` are supported.
- `awk`: `-v` sets built-ins (`-v FS=:`, `-v OFS=|`, `-v ORS=`) and accepts `-vNAME=VALUE`; a single-character FS such as `|` or `.` is literal, so `-F'|'` no longer errors.
- `xargs`: option values may be attached (`-I{}`, `-n1`, `-d,`) or long (`--max-args=N`, `--replace=R`); `-i` is `-I {}`.
- `cut`: `--complement`; fields and characters print in input order without repeats.
- `tr`: octal escapes (`\0`, `\NNN`) and `\a \b \f \v`.
- `declare -f NAME` prints the function definition.
