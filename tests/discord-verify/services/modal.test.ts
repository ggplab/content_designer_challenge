import { assertEquals, assertMatch } from "jsr:@std/assert";
import { buildModal } from "../../../supabase/functions/discord-verify/services/modal.ts";

// ── buildModal ─────────────────────────────────────────────────────────────

Deno.test("buildModal: public → custom_id가 :public으로 끝남", () => {
  const modal = buildModal(true);
  assertMatch(modal.data.custom_id, /:public$/);
});

Deno.test("buildModal: private → custom_id가 :private으로 끝남", () => {
  const modal = buildModal(false);
  assertMatch(modal.data.custom_id, /:private$/);
});

Deno.test("buildModal: type 9 (모달)", () => {
  assertEquals(buildModal(true).type, 9);
});

Deno.test("buildModal: 링크 필드 5개", () => {
  const modal = buildModal(true);
  assertEquals(modal.data.components.length, 5);
});

Deno.test("buildModal: 첫 번째 필드만 required", () => {
  const components = buildModal(true).data.components;
  assertEquals(components[0].components[0].required, true);
  assertEquals(components[1].components[0].required, false);
  assertEquals(components[4].components[0].required, false);
});

Deno.test("buildModal: 모든 필드 max_length 500", () => {
  const components = buildModal(true).data.components;
  for (const row of components) {
    assertEquals(row.components[0].max_length, 500);
  }
});
