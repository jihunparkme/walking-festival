import { defineConfig } from "vitest/config";

// vite.config.js는 로컬 개발용 API 미들웨어(Supabase 클라이언트 생성 등)를 포함하고 있어
// 테스트 실행 시 그대로 로드하면 부작용이 생길 수 있으므로, 테스트 전용 설정을 분리한다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "api/**/*.test.js"],
  },
});
