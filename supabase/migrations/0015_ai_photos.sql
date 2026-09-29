-- AI product photos (DECISIONS.md "AI product photos via Codex", 2026-09-29):
-- null = pending; set by scripts/ai-photos/upload.ts once the studio + model
-- shots are live. Admin-only field, deliberately not added to public_designs.
alter table designs
  add column ai_photos_at timestamptz;
