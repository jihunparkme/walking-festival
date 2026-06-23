import { createClient } from "@supabase/supabase-js";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      // 로컬 개발 전용: Vercel Serverless Function(/api/stamp)을 Vite 미들웨어로 대체
      {
        name: "local-stamp-api",
        configureServer(server) {
          server.middlewares.use("/api/stamp", async (req, res) => {
            res.setHeader("Content-Type", "application/json");

            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }

            // 요청 바디 읽기
            let raw = "";
            for await (const chunk of req) raw += chunk;

            let token, boothId;
            try {
              ({ token, boothId } = JSON.parse(raw));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON" }));
              return;
            }

            if (!token || !boothId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "token과 boothId는 필수입니다." }));
              return;
            }

            const supabase = createClient(
              env.VITE_SUPABASE_URL,
              env.SUPABASE_SERVICE_ROLE_KEY
            );

            // 참여자 조회
            const { data: participant, error: pError } = await supabase
              .from("participants")
              .select("id")
              .eq("token", token)
              .maybeSingle();

            if (pError || !participant) {
              res.statusCode = 401;
              res.end(JSON.stringify({ error: "유효하지 않은 토큰입니다." }));
              return;
            }

            // 도장 INSERT — uq_participant_booth 제약이 중복을 막음
            const { error: insertError } = await supabase
              .from("stamp_records")
              .insert({ participant_id: participant.id, booth_id: boothId });

            if (insertError) {
              if (insertError.code === "23505") {
                res.statusCode = 409;
                res.end(JSON.stringify({ error: "이미 도장을 받은 부스입니다." }));
                return;
              }
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "도장 저장 중 오류가 발생했습니다." }));
              return;
            }

            res.statusCode = 201;
            res.end(JSON.stringify({ success: true, boothId, participantId: participant.id }));
          });
        },
      },
    ],
  };
});
