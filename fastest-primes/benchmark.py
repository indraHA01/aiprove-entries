#!/usr/bin/env python3
"""Benchmark ./primes (best of 7 runs per N, includes process spawn) and
compare against a Python bytearray sieve so the speedup is visible."""
import subprocess
import time


def bench_c(n, runs=7):
    ts = []
    for _ in range(runs):
        t0 = time.perf_counter()
        subprocess.run(["./primes"], input=f"{n}\n", text=True,
                       capture_output=True, check=True)
        ts.append(time.perf_counter() - t0)
    ts.sort()
    return ts[0], ts[len(ts) // 2]


def pysieve(n):
    import math
    s = bytearray(b"\x01") * ((n + 1) // 2)
    for i in range(3, int(math.isqrt(n)) + 1, 2):
        if s[i // 2]:
            s[i * i // 2::i] = b"\x00" * ((n - i * i) // (2 * i) + 1)
    return 1 + sum(s[1:])


if __name__ == "__main__":
    for n in (100000, 1000000, 5000000):
        best, med = bench_c(n)
        print(f"C sieve  N={n}: best {best * 1000:.2f} ms, "
              f"median {med * 1000:.2f} ms")
    for n in (1000000, 5000000):
        t0 = time.perf_counter()
        c = pysieve(n)
        dt = time.perf_counter() - t0
        print(f"py sieve N={n}: {c} in {dt * 1000:.1f} ms")
