# Windows Smoke Checklist

1. Run `npm run smoke:win`.
2. Open Fluxion and load a new workspace.
3. Create a DAG `A -> B`.
4. In `Auto` mode, run the workflow and confirm `B` starts automatically after `A`.
5. Switch the workflow to `Manual`, run again, and confirm every completed node pauses for review.
6. On a paused node, verify `Approve`, `Rerun`, and `Reject` all work as expected.
7. Confirm output files appear under `.fluxion/memory/short-term/<workflow-id>/`.
