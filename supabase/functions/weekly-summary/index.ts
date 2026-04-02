import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { getPrevWeekLabel } from "../_shared/week.ts";
import { runSummary } from "./summary.ts";

// ── 엔트리포인트 ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const weekLabel = getPrevWeekLabel();
    await runSummary(weekLabel);
    return new Response(JSON.stringify({ ok: true, weekLabel }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[weekly-summary] 오류:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
