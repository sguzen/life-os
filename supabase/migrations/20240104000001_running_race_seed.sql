-- P4: Seed the two upcoming races for the authenticated user.
-- Run this AFTER creating your account in the app.
-- Replace <YOUR_USER_ID> with your actual auth.users UUID from Supabase.
--
-- Limassol Half Marathon  — 2026-03-22  target 1:44:30 (6241 s)  21.0975 km
-- Belgrade Marathon        — 2026-04-19  target 3:32:00 (12720 s) 42.195 km

-- NOTE: This is a reference seed. In production, races are added through the UI.
-- The target_pace_sec_per_km column is GENERATED and will be computed automatically.

-- INSERT INTO race_targets (user_id, race_name, location, race_date, distance_km, target_time_seconds, notes)
-- VALUES
--   ('<YOUR_USER_ID>', 'Limassol Half Marathon', 'Limassol, Cyprus',  '2026-03-22', 21.0975, 6270, 'Target 1:44:30. Current fitness: 1:44–1:45 range.'),
--   ('<YOUR_USER_ID>', 'Belgrade Marathon',      'Belgrade, Serbia',  '2026-04-19', 42.195,  12720, 'Target 3:32:00. ~5:00/km race pace.');

-- ── How target times translate to pace ──────────────────────
-- Limassol HM  1:44:30 → 6270 s / 21.0975 km ≈ 4:57 /km
-- Belgrade FM  3:32:00 → 12720 s / 42.195 km  ≈ 5:01 /km
