-- ONG follows use the same global user relationship as every other profile.
-- Keep the legacy table for compatibility, but copy active relationships into
-- user_follows so Feed, Users, and ONG screens cannot disagree.
INSERT INTO user_follows (follower_id, followed_id, active, created_at, updated_at)
SELECT legacy.user_id, ong.user_id, legacy.active, legacy.created_at, legacy.updated_at
FROM user_ong_follows legacy
JOIN ong_profiles ong ON ong.id = legacy.ong_id
ON CONFLICT (follower_id, followed_id)
DO UPDATE SET active = EXCLUDED.active, updated_at = GREATEST(user_follows.updated_at, EXCLUDED.updated_at);