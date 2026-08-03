# Benchmark results

- Date: 2026-08-03
- Node: v24.18.0 | CPU: 12th Gen Intel(R) Core(TM) i7-12700 | OS: win32 10.0.26200
- big.js: v7.0.1 | settings: library defaults (DP=20, RM=1) for both
- Sizes: small=7 digits, medium=20 digits, large=100 digits, huge=500 digits
- Reproduce: `yarn bench`

| operation | size | big.js (ops/s) | fastdecimal (ops/s) | speedup |
| --- | --- | --- | --- | --- |
| parse | small | 5,559,597 | 6,598,767 | 1.19× |
| plus | small | 7,091,691 | 9,649,985 | 1.36× |
| minus | small | 7,713,977 | 7,275,740 | 0.94× |
| times | small | 4,490,410 | 7,966,866 | 1.77× |
| div | small | 218,905 | 4,239,233 | 19.37× |
| mod | small | 3,154,455 | 8,069,120 | 2.56× |
| pow | small | 325,542 | 5,657,404 | 17.38× |
| sqrt | small | 23,818 | 466,182 | 19.57× |
| cmp | small | 15,935,452 | 17,733,316 | 1.11× |
| round | small | 10,555,330 | 20,888,495 | 1.98× |
| toString | small | 3,071,528 | 10,360,730 | 3.37× |
| toFixed | small | 4,019,230 | 7,462,961 | 1.86× |
| parse | medium | 2,612,645 | 3,367,292 | 1.29× |
| plus | medium | 5,912,392 | 8,890,301 | 1.50× |
| minus | medium | 6,667,770 | 7,527,041 | 1.13× |
| times | medium | 854,586 | 6,286,574 | 7.36× |
| div | medium | 75,104 | 2,838,057 | 37.79× |
| mod | medium | 1,541,514 | 5,021,780 | 3.26× |
| pow | medium | 42,812 | 4,530,011 | 105.81× |
| sqrt | medium | 22,310 | 397,266 | 17.81× |
| cmp | medium | 14,295,123 | 15,117,652 | 1.06× |
| round | medium | 7,529,082 | 4,411,416 | 0.59× |
| toString | medium | 3,357,063 | 6,006,315 | 1.79× |
| toFixed | medium | 2,860,706 | 3,670,804 | 1.28× |
| parse | large | 1,099,743 | 2,020,043 | 1.84× |
| plus | large | 2,059,447 | 7,022,056 | 3.41× |
| minus | large | 2,569,267 | 7,288,705 | 2.84× |
| times | large | 35,678 | 3,077,945 | 86.27× |
| div | large | 15,976 | 2,421,154 | 151.55× |
| mod | large | 657,090 | 4,618,583 | 7.03× |
| pow | large | 1,889 | 1,517,365 | 803.11× |
| sqrt | large | 5,358 | 248,239 | 46.33× |
| cmp | large | 12,579,925 | 17,065,800 | 1.36× |
| round | large | 4,701,790 | 2,579,815 | 0.55× |
| toString | large | 963,830 | 2,940,939 | 3.05× |
| toFixed | large | 1,325,003 | 1,721,007 | 1.30× |
| parse | huge | 305,020 | 568,063 | 1.86× |
| plus | huge | 465,342 | 4,721,318 | 10.15× |
| minus | huge | 356,667 | 4,693,578 | 13.16× |
| times | huge | 1,582 | 1,299,557 | 821.59× |
| div | huge | 3,386 | 1,413,449 | 417.44× |
| mod | huge | 58,419 | 2,296,406 | 39.31× |
| pow | huge | 78 | 132,020 | 1700.17× |
| sqrt | huge | 380 | 62,630 | 164.76× |
| cmp | huge | 4,102,678 | 18,879,906 | 4.60× |
| round | huge | 1,729,945 | 1,160,012 | 0.67× |
| toString | huge | 189,270 | 241,719 | 1.28× |
| toFixed | huge | 340,693 | 474,516 | 1.39× |
