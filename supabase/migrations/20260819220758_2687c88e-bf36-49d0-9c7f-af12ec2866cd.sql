DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bottles','caregiver_access','caregiver_invites','category_watchlist','checklist_completions',
    'child_measurements','children','completed_tips','emergency_contacts','emergency_info',
    'emergency_share_links','first_foods','growth_logs','home_profile','insight_dismissals',
    'lifecycle_alerts','milestones','notification_preferences','product_alerts','product_catalog',
    'product_guidelines','product_recalls','products','profiles','recall_radar_dismissals',
    'recalls','recall_source_status','subscriptions','user_agreements'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;