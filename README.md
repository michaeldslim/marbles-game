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

## EAS (Expo Application Services)

This project uses **EAS Build** for cloud builds and **EAS Update** for over-the-air (OTA) JS updates.

### Setup

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account
eas login

# Link this project to EAS (first time only)
eas init
```

### Build

```bash
# Build for production (Android AAB + iOS IPA)
eas build --platform android --profile production
eas build --platform ios --profile production

# Build both platforms at once
eas build --platform all --profile production
```

> Builds run on Expo's cloud servers. When complete, a download link for the `.aab` / `.ipa` is provided.

### OTA Update (JS-only changes)

Use this instead of a full store release when only JavaScript/assets changed.

```bash
# Push an OTA update to production
eas update --channel production --message "Fix bug / update description"
```

> OTA updates are only delivered to devices whose `runtimeVersion` matches. A new binary build is required when native code changes.

### Channels

| Profile | Channel | Purpose |
|---|---|---|
| `development` | `development` | Dev client builds |
| `production` | `production` | App Store / Play Store |

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
|---|---|---|--|
| **왼회전** | 왼회전 | Left English | 큐볼에 좌측 사이드 스핀을 주어 쿠션 반사 시 왼쪽으로 편향됩니다. · Left side-spin; ball deflects left off cushions. |
| **무회전** | 무회전 | Center ball (No English) | 사이드 스핀 없음. 기본 반사 각도 유지. · No side-spin; standard reflection angle. |
| **오른회전** | 오른회전 | Right English | 큐볼에 우측 사이드 스핀을 주어 쿠션 반사 시 오른쪽으로 편향됩니다. · Right side-spin; ball deflects right off cushions. |

#### 동작 기준 — 방향 기준 (중요)

- 앱의 `왼회전`/`오른회전`은 **사용자가 화면을 보는 기준이 아니라, 공이 발사되는 방향(이동 방향)을 기준**으로 동작합니다.
- 즉, 오른회전(`Right English`)을 선택하면 "공의 진행방향에서 본 오른쪽" 쪽으로 쿠션 충돌 후 편향이 발생합니다. 왼회전(`Left English`)은 그 반대입니다.

예시 (오른회전 선택 시):

| 공의 이동방향 | 맞는 쿠션 | 미리보기/실제 편향 방향 |
|---:|---|---|
| → (오른쪽으로 발사) | 오른쪽 벽 | 아래쪽으로 꺾임 |
| ← (왼쪽으로 발사) | 왼쪽 벽 | 위쪽으로 꺾임 |
| ↑ (위쪽으로 발사) | 위쪽 벽 | 오른쪽으로 꺾임 |
| ↓ (아래쪽으로 발사) | 아래쪽 벽 | 왼쪽으로 꺾임 |

이 규칙 덕분에, 공을 어느 방향으로 보내느냐에 따라 같은 `오른회전`이라도 화면에서 보이는 편향 방향은 달라질 수 있습니다. 미리보기 선은 이 발사 방향 기준으로 쿠션에서의 영어 효과를 반영하도록 업데이트되어 있습니다.

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
| Ball friction / 마찰 | 3-Cushion: `0.993` · 4-Ball: `0.993` (per-frame multiplier at 60 fps) |

### Launch Speed & Friction / 발사 속도 및 마찰 튜닝

Effective launch speed (px/s) = `LAUNCH_SPEED × PLAYER_POWER × chargePower (0.1 – 1.0)`

| Parameter | 3-Cushion | 4-Ball | Notes |
|---|---|---|---|
| `LAUNCH_SPEED` | `220` | `220` | Base speed multiplier |
| `PLAYER_POWER` | `5` | `5` | Shared constant |
| Max speed | **1012 px/s** | **1012 px/s** | At full charge |
| Min speed | **101 px/s** | **101 px/s** | At minimum charge |
| `BALL_FRICTION` | `0.991` | `0.991` | Per-frame velocity × factor |
| Speed after 1 s (60 fps) | ~65% | ~65% | `0.993^60 ≈ 0.65` |
| Speed after 2 s (60 fps) | ~42% | ~42% | `0.993^120 ≈ 0.42` |

> **Tuning tips / 조정 가이드**  
> - Want more power? Raise `LAUNCH_SPEED` (e.g. 220 → 250) or `PLAYER_POWER`.  
> - Want balls to roll further? Raise `BALL_FRICTION` (e.g. 0.991 → 0.995).  
> - Want a snappier stop? Lower `BALL_FRICTION` (e.g. 0.991 → 0.988).
