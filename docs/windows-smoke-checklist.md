# Windows Smoke Checklist

1. Run `npm run smoke:win`.
2. Open Fluxion and confirm the Welcome screen shows Codex CLI readiness.
3. If readiness is blocking, run the shown setup command (`npm i -g @openai/codex` or `codex login`) and use Refresh.
4. Load a new workspace.
5. Use `Try Simple Chain` or manually create a DAG `A -> B`.
6. In `Auto` mode, run the workflow and confirm `B` starts automatically after `A`.
7. Switch the workflow to `Manual`, run again, and confirm every completed node pauses for review.
8. On a paused node, verify `Approve`, `Rerun`, and `Reject` all work as expected.
9. Confirm output files appear under `.fluxion/memory/short-term/<workflow-id>/`.
