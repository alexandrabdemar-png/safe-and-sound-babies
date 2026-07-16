-- Emergency-card share links previously always expired 24 hours after
-- creation (expires_at NOT NULL, always set by the client). Per request,
-- links no longer auto-expire — they stay active until the account holder
-- explicitly revokes them (revoked_at). Existing/future rows can now store
-- NULL to mean "never expires"; the client and the public resolve API both
-- treat a NULL expires_at as always-valid, and any link created before this
-- change keeps enforcing its original expiry until it naturally passes.
ALTER TABLE public.emergency_share_links ALTER COLUMN expires_at DROP NOT NULL;
