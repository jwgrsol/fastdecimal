# fastdecimal 코어 계약 (v1)

> 이 문서는 v1 함수형 코어가 지켜야 하는 계약을 정의한다. 코어는 이 계약만 지키면
> big.js / bignumber.js / decimal.js 세 파사드를 모두 서빙할 수 있어야 한다.
> 파사드는 이 계약 위의 얇은 번역 계층이며, 레거시 호환의 책임은 전적으로 파사드에 있다.

## 0. 설계 원칙

1. **호환성은 관찰 가능한 동작의 속성이다.** 코어는 레거시 코드 스타일·구조를 따르지 않는다.
   파사드가 레거시의 관찰 가능한 표면(반환값, 에러 메시지, 공개 속성)을 정확히 재현한다.
2. **성능이 존재 이유다.** 코어의 모든 설계 선택은 벤치마크로 검증한다.
   직관은 제안까지만 하고, 채택은 측정이 결정한다. (실측 사례: 문자열 슬라이스 라운딩은
   직관과 달리 8배 느렸다 — BigInt 500자리는 26워드에 불과해 나눗셈이 변환보다 싸다.)
3. **tree-shaking은 구조로 보장한다.** 함수 하나 = export 하나, 클래스 금지,
   모듈 최상위 부수효과 금지.

## 1. 값 표현 (Representation)

```ts
interface Dec {
  sign: 1 | -1 | 0;      // 0은 NaN 전용 (bignumber.js의 s === null에 대응)
  coef: bigint | null;   // 유한수: 음이 아닌 계수 / null: special 값 (NaN, ±Infinity)
  scale: number;         // 최하위 자리의 10진 지수 — 값 = sign × coef × 10^scale
}
```

- **정규형(불변식)**: 유한수에서 `coef === 0n`이면 `scale === 0`, 아니면 `coef % 10n !== 0n`
  (끝자리 0은 scale로 흡수). 같은 수학적 값은 항상 같은 표현을 가진다.
- **special 값 인코딩** (bignumber/decimal의 `c === null`/`d === null` 관례를 따름):

  | 값 | sign | coef | scale |
  |---|---|---|---|
  | NaN | 0 | null | 0 |
  | +Infinity | 1 | null | 0 |
  | −Infinity | −1 | null | 0 |
  | −0 | −1 | 0n | 0 |

- **필드는 항상 3개, 같은 순서로 생성한다** (V8 히든 클래스 안정화 — big.ts에서 실측 이득 확인됨).
- 부호를 BigInt에 넣지 않는 이유: BigInt에는 −0이 없다 (`-0n === 0n`).
- 최하위 자리 기준 지수(scale)를 쓰는 이유: 산술 시 자릿수 개수를 몰라도 정렬이 된다.
  최상위 기준 지수(e)는 BigInt에서 `toString()` 없이 얻을 수 없어 핫패스에 못 들어간다.
  e는 필요할 때만 파생 계산한다.

## 2. 정밀도 인자화 (Precision as arguments)

**코어 함수는 전역 설정을 절대 읽지 않는다.** 라운딩이 필요한 연산은 정밀도를 인자로 받는다
(Java `BigDecimal` + `MathContext` 모델). 전역 설정(`Big.DP`, `Decimal.precision` 등)을
읽어 인자로 변환하는 것은 파사드의 책임이다.

두 정밀도 모델은 **별도의 진입점**으로 분리한다 (단일 함수 + mode 분기보다 단형성·tree-shaking에 유리):

```ts
// 소수 자릿수(DP) 모델 — big.js, bignumber.js 파사드가 사용
divToDp(x: Dec, y: Dec, dp: number, rm: RoundingMode): Dec
roundToDp(x: Dec, dp: number, rm: RoundingMode): Dec

// 유효숫자(SD) 모델 — decimal.js 파사드가 사용
divToSd(x: Dec, y: Dec, sd: number, rm: RoundingMode): Dec
roundToSd(x: Dec, sd: number, rm: RoundingMode): Dec
```

- 정확한 연산(add, sub, mul, cmp, abs, neg)은 정밀도 인자를 받지 않는다 — 항상 정확한 결과.
  (decimal.js는 add/mul에도 precision을 적용하므로, decimal 파사드는 정확 연산 후
  `roundToSd`를 합성한다. 합성 경로의 성능이 문제로 측정되면 융합 변형을 그때 추가한다.)
- sqrt, pow(음수 지수) 등 본질적으로 라운딩이 필요한 연산은 정밀도 인자가 필수다.

## 3. 라운딩 모드 (Rounding)

**코어는 bignumber.js/decimal.js가 공유하는 0–8 번호 체계를 채택한다** (둘은 수치까지 동일).
big.js의 0–3은 다른 체계이므로 big 파사드가 매핑한다.

| 코어(=bignumber/decimal) | 의미 | big.js 파사드 매핑 |
|---|---|---|
| 0 ROUND_UP | 0에서 멀어지게 | big 3 → 코어 0 |
| 1 ROUND_DOWN | 0을 향해 절단 | big 0 → 코어 1 |
| 2 ROUND_CEIL | +∞ 방향 | — |
| 3 ROUND_FLOOR | −∞ 방향 | — |
| 4 ROUND_HALF_UP | 반은 0에서 멀어지게 | big 1 → 코어 4 |
| 5 ROUND_HALF_DOWN | 반은 0을 향해 | — |
| 6 ROUND_HALF_EVEN | 반은 짝수로 | big 2 → 코어 6 |
| 7 ROUND_HALF_CEIL | 반은 +∞ 방향 | — |
| 8 ROUND_HALF_FLOOR | 반은 −∞ 방향 | — |

- **코어의 라운딩 프리미티브는 부호를 인지해야 한다.** CEIL/FLOOR 계열(2,3,7,8)은 값의
  부호에 따라 방향이 달라진다. (현 big.ts의 `applyRound`는 크기만 받는 구조라 v1에서 재설계.)
- **나머지 연산 모드**: bignumber의 MODULO_MODE 0–9 (위 표의 0–8 + `9 EUCLID`)를
  `mod(x, y, mode)`의 인자로 받는다.

## 4. Special 값 의미론

- **코어는 NaN/±Infinity를 값으로 전파한다** (IEEE 754 규칙: `∞ + (−∞) = NaN`,
  `0 × ∞ = NaN`, `x ÷ 0 = ±∞` 등 — 기준 구현은 decimal.js의 동작).
- **코어는 special 값 때문에 throw하지 않는다.** throw 정책은 파사드의 몫:
  - big 파사드: 경계에서 검증하고 throw — special 값이 코어에 도달하기 전에 차단
    (`[big.js] Division by zero`, `Invalid number` 등 레거시 메시지 그대로).
  - bignumber/decimal 파사드: special 값을 그대로 통과·전파.
- 코어가 throw하는 유일한 경우는 프로그래머 오류(잘못된 인자 타입/범위)이며,
  이때 메시지는 중립적이다. **레거시 에러 문자열(`[big.js] ...`)은 파사드에만 존재한다.**

## 5. 순수성과 부수효과

- 모든 코어 함수는 순수하다: 입력을 변이하지 않고 새 객체를 반환한다.
- 허용되는 내부 상태는 호출자가 관찰 불가능한 캐시뿐이다 (예: `pow10` 테이블).
- **난수·시간에 직접 접근하지 않는다.** `random(entropy: EntropySource)`처럼 주입받는다
  — bignumber의 CRYPTO 옵션은 파사드가 `crypto.getRandomValues`를 주입해 구현한다.

## 6. 파사드 경계 규칙

- **변환 비용 0 원칙**: 파사드 인스턴스는 코어 표현을 그대로 필드로 보유한다
  (현 big.ts의 `s`/`_coef`/`_scale`이 이미 이 구조). wrap은 프로토타입 부착뿐이다.
- 레거시 파생 속성(big의 `c`/`e`, bignumber의 base-1e14 `c`, decimal의 base-1e7 `d`)은
  파사드의 getter/setter로 lazy 파생한다. 코어는 이들을 모른다.
- 함수형 코어 사용자와 파사드 사용자가 한 코드베이스에서 공존할 수 있도록,
  파사드 인스턴스 ↔ `Dec` 변환 헬퍼를 각 파사드가 제공한다.

## 7. 모듈 구조와 이름

```
src/
  core/            # 함수형 코어 — 이 문서의 계약을 구현
    _internal/     # export 맵에 노출되지 않는 내부 헬퍼 (pow10, strip 등)
    add.ts, mul.ts, divToDp.ts, ...   # 함수 하나 = 파일 하나 (es-toolkit 방식)
  big.ts           # big.js 파사드 (v1.0)
  bignumber.ts     # bignumber.js 파사드 (v1.x)
  decimal.ts       # decimal.js 파사드 (v2) — 초월함수는 별도 모듈로 분리
```

- 이름은 서술적으로: `sign`/`coef`/`scale`, `stripTrailingZeros` 등. 축약 금지.
- 코어의 plain 객체 필드에는 밑줄을 붙이지 않는다 (공개 데이터 구조).
  밑줄 필드는 상태를 가진 파사드 인스턴스의 내부 저장에만 쓴다.
- 초월함수(ln/exp/trig, v2)는 decimal 파사드만 import하는 분리 모듈로 두어
  big/bignumber 사용자의 번들에 실리지 않게 한다.

## 8. 검증 계약

각 계층이 통과해야 하는 관문:

1. **파사드**: 해당 레거시 라이브러리의 원본 테스트 스위트를 vendored로 100% 통과
   (big.js 47,456개 — 현재 통과 중 / bignumber 34파일 / decimal 61파일).
2. **코어**: 자체 단위 테스트 (파사드를 경유하지 않는 직접 검증).
3. **차등 검증**: 원본 라이브러리를 devDependency로 두고 무작위 입력 대조
   (시드 고정, 실패 재현 가능). 원본 테스트에 없는 케이스를 잡는 층 —
   strict+bigint 비호환을 실제로 잡아낸 방법.
4. **성능 무회귀**: `bench/run.mjs` 전체 매트릭스에서 파사드 전환 전후 회귀 없음.
   파사드 위임 오버헤드는 측정 가능한 수준이어서는 안 된다.

## 9. 명시적 non-goal과 예약된 결정

- **인스턴스 own-property 모양 재현은 non-goal이다** (README 호환성 섹션 참조).
- **Number 고속 경로 (예약, v1.x)**: 계수가 2^53 미만(≤15자리)일 때 BigInt를 우회하는
  Java `intCompact`식 이중 경로. 표현 계약은 이를 막지 않도록 유지하되(coef는 항상 bigint,
  고속 경로는 연산 내부 구현 세부사항으로만 존재), 구현은 아키텍처 전환과 분리해
  v1.x에서 벤치마크와 함께 진행한다.
- **round의 표현 기인 열세는 수용한다**: DP 라운딩은 BigInt 나눗셈 1회가 하한이다.
  digit array 대비 0.4–0.8×는 표현 선택의 계산된 대가이며 문서화로 대응한다
  (절대 성능은 모든 크기에서 초당 100만 회 이상).
- decimal.js-light 호환은 지원하지 않는다 (절단 산술 + 다른 `e` 의미론 — 별개의 의미 체계).

## 10. 결정 기록 (요약)

| 결정 | 선택 | 근거 |
|---|---|---|
| 계수 표현 | 이진 BigInt (십진 림 아님) | JS 루프로는 네이티브 BigInt를 못 이김 — 십진 림 방식(libmpdec/bignumber)은 JS에서는 경쟁 상대이지 선택지가 아님 |
| special 인코딩 | `coef: null` + `sign: 0`(NaN) | bignumber/decimal 관례와 정합, 3필드 shape 유지 |
| 정밀도 전달 | 연산 인자 (Java 모델) | 전역 컨텍스트(Python 모델)는 파사드에서 재현 가능, 역방향은 불가 |
| dp/sd 분리 | 별도 함수 진입점 | 단형성, tree-shaking, 파사드별 필요 함수만 번들 |
| 라운딩 번호 | bignumber/decimal의 0–8 + EUCLID 9 | 두 라이브러리가 이미 공유하는 체계, big.js만 매핑 필요 |
| 에러 정책 | 코어 중립 / 레거시 메시지는 파사드 | 메시지까지 관찰 가능한 표면이므로 파사드 책임 |
