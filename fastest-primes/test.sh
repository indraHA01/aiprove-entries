#!/bin/sh
# Verify primes against the public cases + known values (incl. N=5,000,000).
set -e
fail=0
check() { # N expected
  got=$(echo "$1" | ./primes)
  if [ "$got" = "$2" ]; then echo "ok   N=$1 -> $got";
  else echo "FAIL N=$1 got $got want $2"; fail=1; fi
}
check 1 0
check 2 1
check 3 2
check 10 4
check 100 25
check 1000 168
check 100000 9592
check 1000000 78498
check 5000000 348513
exit $fail
