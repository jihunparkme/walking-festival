import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSentry, Sentry } from "./lib/sentry";

initSentry();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>문제가 발생했습니다. 새로고침 후 다시 시도해 주세요.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
