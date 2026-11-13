# bug-hunt-utils — verified bugs in `utils.js`

Entry for the AIProve `bug-hunt-utils` bounty. Submission file: `bugs.json`
(a JSON list of `{fn, input, expected}`), reproduced by `reproduce.js`
(`node reproduce.js` — exit 0 when every listed bug reproduces and every
sanity check on the correct functions passes).

Audited all 11 functions. **4 functions are buggy** (9 failing inputs below).
The other 7 (`sum`, `max`, `reverse` on BMP text, `isPalindrome`, `clamp`,
`unique`, `average`) were sanity-checked against their obvious correct
behaviour and are not reported.

## Bug 1 — `factorial` drops the final factor (HIGH confidence)

```js
function factorial(n){ let r=1; for(let i=2;i<n;i++) r*=i; return r; }
```

The loop condition is `i < n`, so `n` itself is never multiplied in.

| input | actual | expected |
|------:|-------:|---------:|
| `factorial(5)` | `24` (2·3·4) | `120` |
| `factorial(2)` | `1` | `2` |
| `factorial(10)` | `362880` (9!) | `3628800` (10!) |

Note `factorial(0)` and `factorial(1)` both return `1` by luck (loop never
runs), so they do not expose the bug — the failing inputs above do.
Fix: `i <= n`.

## Bug 2 — `countVowels` misses uppercase vowels (HIGH confidence)

```js
function countVowels(s){ return (s.match(/[aeiou]/g)||[]).length; }
```

The regex has no `i` flag, so uppercase vowels are never counted.

| input | actual | expected |
|------:|-------:|---------:|
| `countVowels("AEIOU")` | `0` | `5` |
| `countVowels("Apple")` | `1` (only `e`) | `2` (`A` + `e`) |
| `countVowels("HELLO WORLD")` | `0` | `3` (`E`, `O`, `O`) |

Fix: `/[aeiou]/gi`.

## Bug 3 — `titleCase` capitalises the letter after an apostrophe (MEDIUM)

```js
function titleCase(s){ return s.replace(/\b\w/g, c=>c.toUpperCase()); }
```

`\b` treats the apostrophe as a word boundary, so the letter after it is
upper-cased too.

| input | actual | expected |
|------:|-------:|---------:|
| `titleCase("don't stop")` | `"Don'T Stop"` | `"Don't Stop"` |
| `titleCase("it's a test")` | `"It'S A Test"` | `"It's A Test"` |

Plain words are fine (`titleCase("hello world")` → `"Hello World"`), so this
only fires on contractions/possessives.
Fix: only capitalise a letter that follows a space (or start of string).

## Bug 4 — `reverse` breaks astral characters / emoji (MEDIUM)

```js
function reverse(s){ return s.split("").reverse().join(""); }
```

`split("")` splits UTF-16 code units, not characters, so a surrogate pair
(emoji, astral plane) is torn apart and re-joined in the wrong order.

| input | actual | expected |
|------:|-------:|---------:|
| `reverse("😀a")` | `"a\uDE00\uD83D"` (lone surrogates — broken string) | `"a😀"` |

Fix: `[...s].reverse().join("")` (iterates code points, not code units).

## How to verify

```
node reproduce.js
```

Output lists each bug with actual vs expected, then runs 14 sanity checks
on the functions that are correct (all pass). `utils.js` is the challenge's
original file, copied unchanged into this directory for the reproduction.
