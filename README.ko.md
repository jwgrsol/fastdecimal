# fastdecimal

[English](./README.md) | 한국어

BigInt 기반의 [big.js](https://github.com/MikeMcl/big.js) drop-in 대체 라이브러리 — 모든 크기의 피연산자에서 산술이 극적으로 빠르고, tree-shaking 가능한 함수형 코어를 갖추었으며, big.js 자체 테스트 스위트로 검증되었습니다.

```js
// big.js drop-in 대체 — import만 바꾸면 기존 코드 그대로
import Big from 'fastdecimal/big';

new Big('0.1').plus('0.2').toString(); // '0.3'
```

```js
// 새 코드를 위한 함수형 코어 — tree-shaking 지원, import한 함수만 번들에 포함
import { parse, add, toString } from 'fastdecimal';

toString(add(parse('0.1'), parse('0.2'))); // '0.3'
```

## 함수형 코어

루트 진입점은 plain 값을 다루는 순수 함수들입니다 — 클래스도, 전역 설정도 없고 완전히 tree-shaking 가능합니다. 값의 형태:

```ts
interface DecimalValue {
  sign: 1 | -1 | 0; // 0은 NaN 전용
  coefficient: bigint | null; // 유한수: 음이 아닌 계수 · null: NaN / ±Infinity
  scale: number; // 값 = sign × coefficient × 10^scale
}
```

값은 항상 정규형입니다(계수에 끝자리 0 없음, 0은 scale이 0) — 같은 수는 언제나 같은 표현을 가집니다. `−0`은 `{ sign: -1, coefficient: 0n, scale: 0 }`이고, NaN과 ±Infinity는 IEEE 754 규칙으로 산술을 통과하는 정식 값입니다 — 코어는 값 때문에 throw하지 않습니다.

```ts
import { parse, divToDecimalPlaces, toString } from 'fastdecimal';

const price = parse('149.99');
const people = parse('3');
toString(divToDecimalPlaces(price, people, 2, 4)); // 1인당 '50' (HALF_UP)
```

| 분류                          | 함수                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| 생성                          | `parse`, `fromParts`, `fromNormalized`, `zero`, `infinity`, `nan`                                      |
| 정확 연산                     | `add`, `sub`, `mul`, `powInt`, `neg`, `abs`, `cmp`                                                     |
| 라운딩 연산 (정밀도를 인자로) | `divToDecimalPlaces`, `sqrtToDecimalPlaces`, `mod`, `roundToDecimalPlaces`, `roundToSignificantDigits` |
| 조회 / 출력                   | `exponentOf`, `isFinite`, `isNaN`, `isInfinite`, `isZero`, `toString`                                  |

라운딩 모드는 bignumber.js/decimal.js와 같은 번호 체계입니다:

| #   | 모드                | #   | 모드      | #   | 모드       |
| --- | ------------------- | --- | --------- | --- | ---------- |
| 0   | UP (0에서 멀어지게) | 3   | FLOOR     | 6   | HALF_EVEN  |
| 1   | DOWN (절단)         | 4   | HALF_UP   | 7   | HALF_CEIL  |
| 2   | CEIL                | 5   | HALF_DOWN | 8   | HALF_FLOOR |

`mod`는 추가로 `9`(EUCLID: 항상 음이 아닌 나머지)를 받습니다. 코어가 따르는 설계 규칙 — 정밀도 인자화, special 값 의미론, 순수성 — 은 [docs/core-contract.md](./docs/core-contract.md)에 명세돼 있습니다.

## 호환성

fastdecimal의 목표는 big.js와의 **100% 동작 호환**입니다: 같은 API, 같은 결과, 같은 에러. 다만 big.js 코드를 이식한 것이 아니라, 내부적으로는 값을 BigInt 계수와 스케일로 저장합니다 — 성능이 나오는 이유가 바로 이 구조입니다. 호환성은 관찰 가능한 동작의 속성이지, 구현의 속성이 아닙니다.

### 지원 범위 — 완전히 동일함을 보장

- 모든 메서드와 정적 속성 — 이름, 인자 개수, 의미까지 동일 (`plus`, `div`, `sqrt`, `round`, `toFixed`, …, `DP`, `RM`, `NE`, `PE`, `strict`, `roundDown`–`roundUp`).
- 모든 연산 결과가 자릿수 단위로 동일 — 라운딩 모드, 임의의 `DP`에서의 나눗셈 포함.
- 공개 인스턴스 속성 `s`, `c`, `e` — 읽기는 물론 **쓰기**까지 big.js와 정확히 같게 동작.
- 에러: 같은 상황에서 같은 `[big.js]` 메시지로 throw.
- 특수값과 엣지 케이스: 음수 0(-0), `strict` 모드(bigint 입력 포함), 독립 설정을 갖는 `Big()` 클론 생성자 팩토리.
- 검증 방법: big.js의 전체 테스트 스위트를 vendored로 실행(47,456개 단언, 100% 통과) + big.js 원본과의 차등(differential) 테스트.

### 지원 범위 밖 — 명시적 non-goal

- **인스턴스 own-property 모양.** big.js 인스턴스는 `{s, e, c}`를 plain own property로 저장하지만, fastdecimal 인스턴스는 `{s, _coef, _scale}`로 저장하고 `c`/`e`는 프로토타입 접근자로 파생합니다. 속성 _접근_(`x.c`, `x.e = 5`)은 완전 호환이지만, 인스턴스를 직접 열거하는 코드는 다르게 동작합니다:
  - `{ ...x }`, `Object.assign({}, x)`, `Object.keys(x)`
  - `x.hasOwnProperty('c')` (fastdecimal은 `false`, big.js는 `true`)
  - deep-equality 헬퍼(예: lodash `isEqual`)로 fastdecimal 인스턴스와 big.js 인스턴스를 직접 비교하는 경우
- 내부 인스턴스 필드(`sign`, `coefficient`, `scale`)는 구현 세부사항이며, 어떤 릴리스에서든 바뀔 수 있습니다.
- **의도적 차이 — 충실한 재현보다 종료를 우선:** 원본 big.js는 결과의 지수가 `-DP`보다 훨씬 작은 `sqrt`에서 영원히 멈출 수 있습니다(수렴하지 않는 뉴턴 반복 — 예: `Big.DP = 3; new Big('9.75e-19').sqrt()`). fastdecimal은 대신 반복 상한에서 추정값으로 종료합니다. big.js가 정상 종료하는 모든 입력에서는 결과가 동일합니다.

**마이그레이션 전에** 코드베이스에서 Big 값에 대한 인스턴스 스프레드와 `hasOwnProperty('c'|'e')` 사용을 검색해보세요 — 없다면(압도적으로 흔한 경우) import 경로만 바꾸면 끝입니다. 값 비교에는 `x.eq(y)`, 직렬화에는 `x.toJSON()` / `x.toString()`을 사용하세요 — 두 라이브러리에서 동일하게 동작합니다.

## 벤치마크

`yarn bench`로 big.js 대비 전체 연산 × 피연산자 크기 매트릭스를 직접 재현할 수 있고, 결과는 [bench/RESULTS.md](./bench/RESULTS.md)에 기록됩니다. 매트릭스는 3방향 — 원본 big.js, 함수형 코어 직접 호출, 파사드 — 으로 측정해 래퍼의 오버헤드가 항상 드러납니다. `node bench/bundle-size.mjs`는 실제 번들 크기를 측정합니다: 코어 함수 하나만 import하면 gzip 약 0.5 KB, 코어 전체 약 2.3 KB(big.js의 약 2.9 KB보다 작음), 반면 all-or-nothing인 `fastdecimal/big` 파사드는 약 3.6 KB로 big.js보다 큽니다 — 번역 계층의 문서화된 대가입니다. 하이라이트(Node 24, 500자리 피연산자): `times` 약 870×, `pow` 약 1800×, `div` 약 440×, `sqrt` 약 156× 빠름. 알려진 트레이드오프: 약 20자리를 넘는 피연산자의 `round`는 big.js의 0.4~0.8× 수준입니다 — digit array 표현에서는 절단이 거의 공짜인 반면, BigInt 표현은 실제 나눗셈이 필요하기 때문입니다. 그 외 측정된 모든 연산은 더 빠르며, `round`도 모든 크기에서 초당 100만 회 이상입니다.

## 라이선스

[MIT](./LICENSE)
