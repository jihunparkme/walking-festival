import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// vite.config.js는 로컬 개발용 API 미들웨어(Supabase 클라이언트 생성 등)를 포함하고 있어
// 테스트 실행 시 그대로 로드하면 부작용이 생길 수 있으므로, 테스트 전용 설정을 분리한다.
// react() 플러그인은 컴포넌트(.jsx) 테스트에서 JSX/자동 런타임 변환을 위해 필요하다.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}", "api/**/*.test.js"],
  },
});
