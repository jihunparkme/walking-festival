// Vitest 전역 테스트 설정.
// - jest-dom 매처(toBeInTheDocument 등)를 등록해 컴포넌트 테스트의 어서션을 단순화한다.
// - 각 테스트 종료 후 렌더링된 DOM을 정리(cleanup)해, 다음 테스트에 이전 렌더 결과가
//   남아 "여러 개의 엘리먼트가 발견됨" 같은 오탐이 발생하지 않도록 한다.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
