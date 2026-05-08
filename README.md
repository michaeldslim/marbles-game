# Marbles Game (Expo + TypeScript)

당구 물리 시뮬레이션 모바일 게임 — 3쿠션(three-cushion billiards)과 사구(4-ball billiards)를 지원합니다.  
A mobile billiards physics simulation supporting 3-Cushion and 4-Ball (Korean) billiards.

---

## Run locally / 실행 방법

Install dependencies and start the Expo dev server:

```bash
npm install
npm run start
```

Run on Android (requires Android emulator or device):

```bash
npm run android
```

Run on iOS (macOS + Xcode required):

```bash
npm run ios
```

---

## Game Modes / 게임 모드

### 1. 3-Cushion Billiards / 3쿠션 당구

#### How to Play / 게임 방법

| | English | 한국어 |
|---|---|---|
| **Objective** | Score points by making the cue ball touch 3+ cushions before hitting the 2nd object ball | 큐볼이 2번째 목적구를 맞히기 전에 쿠션을 3회 이상 맞혀야 득점 |
| **Break rule** | On the very first shot, the cue ball must hit the **red ball** first. Hitting yellow first = foul | 첫 번째 샷(브레이크)에서는 반드시 **빨간 공**을 먼저 맞혀야 합니다. 노란 공을 먼저 맞히면 파울 |
| **Scoring** | Hit both object balls with 3+ cushions before 2nd contact → **+1 pt**, keep shooting | 2번째 공 접촉 전에 쿠션 3회 이상 + 두 공 모두 맞히면 **+1점**, 연속 샷 가능 |
| **Miss** | Failed to meet conditions → turn ends, no penalty | 조건 미달 → 턴 종료, 패널티 없음 |
| **Turn** | Players alternate turns on a miss | 미스 시 턴이 상대방에게 넘어감 |
| **Balls** | ⚪ White (Player 1 cue) · 🟡 Yellow (Player 2 cue) · 🔴 Red (object ball) | 흰 공(Player 1 큐볼) · 노란 공(Player 2 큐볼) · 빨간 공(목적구) |

#### How to Shoot / 조준 및 발사 방법

- **Aim / 조준**: Drag your finger on the screen in the direction you want to shoot. A dotted trajectory line shows the predicted path. · 화면을 드래그하면 점선으로 예상 경로가 표시됩니다.
- **Release / 발사**: Lift your finger to fire. · 손을 떼면 큐볼이 발사됩니다.
- **Active cue ball** is highlighted with a white ring. · 현재 턴의 큐볼에 흰색 링이 표시됩니다.

---

### 2. 4-Ball Billiards / 사구 (四球)

#### How to Play / 게임 방법

| | English | 한국어 |
|---|---|---|
| **Objective** | Hit **both red balls** with your cue ball in a single shot → +1 pt | 한 번의 샷으로 **빨간 공 2개를 모두** 큐볼로 맞히면 +1점 |
| **Scoring** | Both reds hit → **+1 pt**, keep shooting | 두 빨간 공 모두 맞히면 **+1점**, 연속 샷 가능 |
| **Miss** | Failed to hit both reds → turn changes, no penalty | 두 빨간 공을 모두 맞히지 못하면 턴 교체, 패널티 없음 |
| **Foul** | Cue ball hits the **opponent's cue ball** → **−1 pt**, turn changes | 큐볼이 **상대방 큐볼**을 맞히면 **−1점**, 턴 교체 |
| **Win condition** | First player to reach **20 points** wins | 먼저 **20점**에 도달한 플레이어가 승리 |
| **Balls** | 🟡 Yellow (Player 1 cue) · ⚪ White (Player 2 cue) · 🔴🔴 Two red balls (object balls) | 노란 공(Player 1 큐볼) · 흰 공(Player 2 큐볼) · 빨간 공 2개(목적구) |

#### How to Shoot / 조준 및 발사 방법

Same drag-and-release controls as 3-Cushion. The active cue ball is highlighted with a white ring.  
3쿠션과 동일한 드래그 조작 방식. 현재 턴의 큐볼에 흰색 링이 표시됩니다.

---

## Shot Techniques / 구현된 기술

두 게임 모드 모두 샷 전에 아래 기술을 선택할 수 있습니다.  
Both game modes support the following shot techniques, selectable before each shot.

### Vertical Spin / 수직 스핀 (상단 버튼 행)

| Button | Korean | English | Physics Effect / 물리 효과 |
|---|---|---|---|
| **끌어치기** | 하끄 / 끌어치기 | Draw shot (Backspin) | 큐볼에 역회전을 주어 목적구 충돌 후 큐볼이 뒤로 물러납니다. · Backspin applied; cue ball reverses direction after contact. |
| **스톱샷** | 스톱샷 | Stop shot | 무회전 상태. 정면 충돌 시 큐볼이 그 자리에 멈춥니다. · No spin; cue ball stops dead on center-ball contact. |
| **밀어치기** | 오시 / 밀어치기 | Follow shot (Topspin) | 큐볼에 순회전을 주어 충돌 후에도 계속 전진합니다. · Topspin applied; cue ball continues forward after contact. |

### Side Spin (English) / 좌우 회전 — 영어 (하단 버튼 행)

| Button | Korean | English | Physics Effect / 물리 효과 |
|---|---|---|---|
| **왼회전** | 왼회전 | Left English | 큐볼에 좌측 사이드 스핀을 주어 쿠션 반사 시 왼쪽으로 편향됩니다. · Left side-spin; ball deflects left off cushions. |
| **무회전** | 무회전 | Center ball (No English) | 사이드 스핀 없음. 기본 반사 각도 유지. · No side-spin; standard reflection angle. |
| **오른회전** | 오른회전 | Right English | 큐볼에 우측 사이드 스핀을 주어 쿠션 반사 시 오른쪽으로 편향됩니다. · Right side-spin; ball deflects right off cushions. |

### Technique Combinations / 기술 조합 예시

| 조합 | Combination | 활용 상황 |
|---|---|---|
| 끌어치기 + 무회전 | Draw + Center | 큐볼을 뒤로 빼서 안전한 위치로 피할 때 |
| 밀어치기 + 오른회전 | Follow + Right English | 쿠션에서 우측으로 크게 커브를 만들 때 |
| 스톱샷 + 왼회전 | Stop + Left English | 큐볼을 정지시키면서 다음 쿠션 각도를 조정할 때 |
| 끌어치기 + 왼회전 | Draw + Left English | 역회전으로 물러나면서 왼쪽으로 방향 전환 |

> **Note / 참고**: 기본값은 항상 `스톱샷 + 무회전`으로, 선택을 바꾸지 않으면 스핀 없는 기본 샷이 발사됩니다.  
> Default is always `Stop + Center (no spin)`, so leaving selections unchanged fires a plain shot.

---

## Technical Notes / 기술 구현 세부사항

| Feature | Implementation |
|---|---|
| Spin decay / 스핀 감쇠 | `spin` and `sideSpin` decay each frame via `SPIN_DECAY = 0.975` |
| Cushion English / 쿠션 편향 | Side-spin deflects tangential velocity on cushion bounce via `ENGLISH_FACTOR = 0.32` |
| Spin transfer / 충돌 스핀 전달 | On marble collision, spin shifts cue ball along normal via `SPIN_TRANSFER_FACTOR = 0.45` |
| Restitution / 반발계수 | `ENGINE_DEFAULT_RESTITUTION = 0.8` |
| Ball friction / 마찰 | 3-Cushion: `0.991` · 4-Ball: `0.987` |
