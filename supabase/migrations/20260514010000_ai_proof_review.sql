-- Advisory AI proof review (internal only). Never used for auto-accept/reject.

alter table public.payment_proofs
add column if not exists ai_review_json jsonb,
add column if not exists ai_review_summary text,
add column if not exists reviewer_decision_note text,
add column if not exists ai_analyzed_at timestamp with time zone,
add column if not exists ai_image_fingerprint text;

comment on column public.payment_proofs.ai_review_json is 'Structured GPT-4o vision extraction + computed warnings; advisory only.';
comment on column public.payment_proofs.ai_review_summary is 'Short human-readable AI summary for internal reviewers.';
comment on column public.payment_proofs.reviewer_decision_note is 'Internal note from human reviewer; not shown to clients.';
