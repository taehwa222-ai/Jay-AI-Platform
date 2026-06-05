# Start Here

The first goal is now a clean working platform foundation:

```text
React dashboard -> FastAPI route -> platform status -> VPS deployment
```

## Architecture

```text
backend/app/main.py
  routers/health.py
  routers/platform.py
frontend/src/App.tsx
scripts/deploy-ubuntu.sh
```

## Where To Add New Features

1. Add a router in `backend/app/routers`.
2. Add request and response types in `backend/app/schemas` when the route needs structured payloads.
3. Add business logic in `backend/app/services`.
4. Add React API calls in `frontend/src/api.ts`.
5. Add UI state and views in `frontend/src/App.tsx` or new components.
6. Add tests in `backend/tests`.

## Next Build Steps

- Decide the first custom module.
- Define the module input and output.
- Build one backend route.
- Add one matching frontend screen.
- Add storage, auth, scheduling, and monitoring only after the first module works.
