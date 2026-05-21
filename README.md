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
- `src/data/stamps.js`: 부스 스탬프 데이터