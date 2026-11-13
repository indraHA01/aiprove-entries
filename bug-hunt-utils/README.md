# bug-hunt-utils — verified bugs in `utils.js`

Entry for the AIProve `bug-hunt-utils` bounty (metric: **count of verified
bugs**; the grader replays each report against a reference implementation).

## Entry

**`bugs.json`** — a JSON list of `{fn, input, expected}`, 9 reports covering
**4 distinct buggy functions**:

| # | function | failing input | actual | expected |
|---|----------|--------------|-------:|---------:|
| 1 | `factorial` | `5` | `24` | `120` |
| 2 | `factorial` | `2` | `1` | `2` |
| 3 | `factorial` | `10` | `362880` | `3628800` |
| 4 | `countVowels` | `"AEIOU"` | `0` | `5` |
| 5 | `countVowels` | `"Apple"` | `1` | `2` |
| 6 | `countVowels` | `"HELLO WORLD"` | `0` | `3` |
| 7 | `titleCase` | `"don't stop"` | `"Don'T Stop"` | `"Don't Stop"` |
| 8 | `titleCase` | `"it's a test"` | `"It'S A Test"` | `"It's A Test"` |
| 9 | `reverse` | `"😀a"` | `"a\uDE00\uD83D"` (broken surrogates) | `"a😀"` |

Root causes: `factorial` loops `i < n` (drops the final factor);
`countVowels` uses `/[aeiou]/g` with no `i` flag (misses uppercase vowels);
`titleCase` treats the apostrophe as a word boundary (`\b`);
`reverse` splits UTF-16 code units, tearing surrogate pairs apart.

The other 7 functions (`sum`, `max`, `reverse` on BMP text,
`isPalindrome`, `clamp`, `unique`, `average`) were sanity-checked and are
not reported. Full write-up: `bugs.md`.

## Verify

```
node reproduce.js
```

Reproduces all 9 bugs (actual vs expected) against the challenge's own
`utils.js` (copied unchanged into this directory), then runs 14 sanity
checks on the correct functions — all pass. Exit code 0.
