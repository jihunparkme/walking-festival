# walking-festival

사람사랑 생명사랑 걷기캠페인 웹앱 프로토타입입니다.

## 실행 방법

1. 의존성 설치

```bash
npm install
```

2. 개발 서버 실행

```bash
npm run dev
```

3. 프로덕션 빌드

```bash
npm run build
```

## 기술 스택

- React + Vite
- Tailwind CSS
- 브라우저 localStorage

## 화면 구성

- Home: 세계자살예방의 날 안내와 캠페인 소개, 협력기관 정보
- Stamp Card: 5개 부스 도장판, 관리자 비밀번호 확인 후 도장 처리
- Walk & Certify: 위치 기반/시뮬레이션 걸음수, 6자리 고유번호, 사진 인증 업로드

## 핵심 로직

- localStorage 키
  - `walkingFestival.stamps`
  - `walkingFestival.steps`
  - `walkingFestival.entryNumber`
  - `walkingFestival.photo`
- 관리자 비밀번호: `1234` (프로토타입 고정값)
- 걸음 수 계산: 좌표 간 거리(Haversine) 기준으로 대략 `0.75m = 1보` 환산

## 컴포넌트 구조

- `src/App.jsx`: 상태/저장/권한/측정 로직 관리
- `src/components/HomeSection.jsx`: 소개 화면
- `src/components/StampCardSection.jsx`: 도장판 UI
- `src/components/WalkCertifySection.jsx`: 걷기/인증 UI
- `src/components/BottomNav.jsx`: 하단 탭 네비게이션
- `src/components/PasswordModal.jsx`: 관리자 비밀번호 모달

## Sentry 연동

프런트엔드(`@sentry/react`)와 서버리스 API(`@sentry/node`)의 예외를 Sentry로 전송합니다.
DSN이 설정되지 않으면 초기화 로직이 아무 동작도 하지 않으므로, 로컬 개발 시 별도 설정 없이도
기존과 동일하게 동작합니다.

환경변수 (`.env`, Vercel Project Settings):

| 변수 | 위치 | 용도 |
|---|---|---|
| `VITE_SENTRY_DSN` | 클라이언트 | 브라우저 에러 전송용 DSN |
| `SENTRY_DSN` | 서버(`api/*`) | 서버리스 함수 에러 전송용 DSN |
| `SENTRY_AUTH_TOKEN` | 빌드(CI/Vercel) | 소스맵 업로드용 토큰 (설정 시에만 업로드 플러그인 활성화) |
| `SENTRY_ORG` / `SENTRY_PROJECT` | 빌드(CI/Vercel) | 소스맵 업로드 대상 Sentry 조직/프로젝트 |
| `VITE_SENTRY_RELEASE` | 클라이언트/빌드 | 릴리스 버전 태깅(선택) |

관련 코드:

- `src/lib/sentry.js`: 클라이언트 초기화 (`main.jsx`에서 렌더링 전 호출, `ErrorBoundary`로 감쌈)
- `api/_lib/sentry.js`: 서버 초기화 및 `withSentry(handler)` 래퍼 — 모든 `api/*.js` 핸들러가
  처리하지 못한 예외를 캡처해 Sentry로 전송한 뒤 500 응답을 반환
- `vite.config.js`: 빌드 시 소스맵 생성 + `SENTRY_AUTH_TOKEN`이 있을 때만 `@sentry/vite-plugin`으로
  소스맵 업로드
