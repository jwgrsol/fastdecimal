# Benchmark results

- Date: 2026-08-04
- Node: v24.18.0 | CPU: 12th Gen Intel(R) Core(TM) i7-12700 | OS: win32 10.0.26200
- big.js: v7.0.1 | settings: library defaults (DP=20, RM=1) for both
- Sizes: small=7 digits, medium=20 digits, large=100 digits, huge=500 digits
- Reproduce: `yarn bench`

| operation | size | big.js (ops/s) | fastdecimal (ops/s) | speedup |
| --- | --- | --- | --- | --- |
| parse | small | 5,318,882 | 7,165,025 | 1.35× |
| plus | small | 6,727,177 | 9,538,670 | 1.42× |
| minus | small | 7,999,681 | 6,949,647 | 0.87× |
| times | small | 4,316,028 | 7,229,655 | 1.68× |
| div | small | 211,244 | 4,042,333 | 19.14× |
| mod | small | 3,202,407 | 7,380,216 | 2.30× |
| pow | small | 331,524 | 5,647,485 | 17.03× |
| sqrt | small | 25,153 | 498,178 | 19.81× |
| cmp | small | 16,677,320 | 18,560,301 | 1.11× |
| round | small | 14,371,565 | 20,394,590 | 1.42× |
| toString | small | 5,493,002 | 10,943,700 | 1.99× |
| toFixed | small | 3,628,823 | 7,324,260 | 2.02× |
| parse | medium | 2,336,441 | 3,017,673 | 1.29× |
| plus | medium | 5,886,892 | 9,048,705 | 1.54× |
| minus | medium | 5,543,042 | 7,206,983 | 1.30× |
| times | medium | 851,156 | 6,214,099 | 7.30× |
| div | medium | 63,455 | 2,459,999 | 38.77× |
| mod | medium | 1,562,418 | 4,894,008 | 3.13× |
| pow | medium | 43,771 | 4,488,076 | 102.54× |
| sqrt | medium | 22,705 | 440,109 | 19.38× |
| cmp | medium | 14,790,978 | 17,740,681 | 1.20× |
| round | medium | 8,378,185 | 4,335,646 | 0.52× |
| toString | medium | 2,321,193 | 6,402,627 | 2.76× |
| toFixed | medium | 2,670,762 | 3,782,770 | 1.42× |
| parse | large | 1,240,388 | 1,852,418 | 1.49× |
| plus | large | 1,902,833 | 7,195,955 | 3.78× |
| minus | large | 2,484,319 | 6,707,302 | 2.70× |
| times | large | 38,147 | 3,747,524 | 98.24× |
| div | large | 15,695 | 2,468,933 | 157.31× |
| mod | large | 652,542 | 4,215,108 | 6.46× |
| pow | large | 1,861 | 1,502,748 | 807.35× |
| sqrt | large | 5,609 | 257,614 | 45.93× |
| cmp | large | 12,041,589 | 18,346,131 | 1.52× |
| round | large | 4,961,063 | 2,187,431 | 0.44× |
| toString | large | 987,206 | 3,076,222 | 3.12× |
| toFixed | large | 1,322,199 | 1,698,881 | 1.28× |
| parse | huge | 312,887 | 514,821 | 1.65× |
| plus | huge | 353,502 | 4,771,503 | 13.50× |
| minus | huge | 362,895 | 4,431,048 | 12.21× |
| times | huge | 1,622 | 1,336,798 | 824.32× |
| div | huge | 3,430 | 1,482,973 | 432.40× |
| mod | huge | 60,984 | 2,269,365 | 37.21× |
| pow | huge | 75 | 138,881 | 1847.16× |
| sqrt | huge | 379 | 62,253 | 164.42× |
| cmp | huge | 4,462,085 | 16,518,277 | 3.70× |
| round | huge | 2,439,535 | 1,195,524 | 0.49× |
| toString | huge | 201,935 | 250,363 | 1.24× |
| toFixed | huge | 335,421 | 476,373 | 1.42× |
