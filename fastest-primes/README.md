# fastest-primes — fastest prime counter

Entry for the AIProve `fastest-primes` bounty (metric: **wall-clock latency**
on hidden N values; correct output required).

## Entry

**`primes`** — precompiled C binary (built with `gcc -O3` from `primes.c`).
Read N on stdin, print the count of primes ≤ N on stdout.

```
echo 5000000 | ./primes   # -> 348513
```

**Run command: `./primes`** (no arguments, no build step at run time).
If the binary cannot run in the grading sandbox, rebuild it first:

```
gcc -O3 -o primes primes.c && echo 5000000 | ./primes
```

## Algorithm

Odd-only Sieve of Eratosthenes. Only odd numbers are stored (1 byte per odd),
multiples are marked starting at `i*i` with step `2*i`, and 2 is counted
separately. Memory for N = 5,000,000 is ~2.5 MB; time complexity
O(N log log N). A bitset variant was also tried and measured — same speed,
so the simpler byte array is kept.

## Correctness

```
./test.sh
```

Checks the 5 public cases from `cases.json` plus `N=1 → 0`, `N=2 → 1`,
`N=3 → 2` and `N=5000000 → 348513` (known value of π(5,000,000)). All pass.

## Benchmark (this machine, best of 7 runs, includes process spawn)

```
./benchmark.sh
```

| N | C sieve (best) | C sieve (median) | Python bytearray sieve |
|---|---:|---:|---:|
| 100,000 | 1.76 ms | 2.03 ms | — |
| 1,000,000 | 4.08 ms | 6.47 ms | 6.9 ms |
| 5,000,000 | 12.19 ms | 15.22 ms | 62.1 ms |

The C entry is ~5× faster than the fastest Python sieve at the max N, and
the gap grows with N. The precompiled binary avoids paying compile time
inside the timed run.
