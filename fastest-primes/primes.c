// primes.c — count primes <= N (N <= 5,000,000) from stdin.
// Odd-only Sieve of Eratosthenes. O(N log log N), ~2.5 MB for N = 5M.
// Build: gcc -O3 -o primes primes.c
// Run:   echo 5000000 | ./primes
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    long n;
    if (scanf("%ld", &n) != 1) return 0;
    if (n < 2) { printf("0\n"); return 0; }
    // index i represents the odd number 2*i+1 (i = 0 -> 1, i = 1 -> 3, ...)
    long m = (n + 1) / 2;
    unsigned char *comp = (unsigned char *)calloc((size_t)m, 1);
    if (!comp) return 1;
    for (long i = 3; i * i <= n; i += 2) {
        if (!comp[i / 2]) {
            for (long j = i * i; j <= n; j += 2 * i) comp[j / 2] = 1;
        }
    }
    long cnt = 1; // prime 2
    for (long i = 3; i <= n; i += 2) if (!comp[i / 2]) cnt++;
    printf("%ld\n", cnt);
    return 0;
}
