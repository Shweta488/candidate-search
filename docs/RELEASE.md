# Release strategy

This is an assessment, so I have not included any release steps or release strategy. The app runs locally only (`make setup`, `make dev`), and deployment is explicitly out of scope.

If this were going to production, the next steps would be: environments for preview, staging and production; migrations applied by CI before each deploy; secrets in a managed store; webhook endpoint registered with Stripe per environment; error and latency monitoring on search and billing; and a rollback plan for both code and migrations.
