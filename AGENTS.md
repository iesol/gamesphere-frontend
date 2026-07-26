# Frontend Agent

## Overview
React SPA for GameSphere, a multi-tenant tournament management system with live cricket match scoring.

## Routing & Auth
- `ProtectedRoute` — redirects to `/login` if unauthenticated
- `AdminRoute` — checks `myRole` against required roles, redirects to `/access-denied` if insufficient
- Sidebar nav items dynamically shown based on org role:
  - `/admin/orgs` — `super_admin` only
  - `/admin/users`, `/admin/form-configs` — `super_admin` or `org_admin`
  - `/dashboard`, `/tournaments`, `/profile` — any authenticated user

## Pages
- **Login** — Google OAuth sign-in
- **OrgPicker** — select active organization (post-login or when none selected)
- **Dashboard** — overview cards, recent tournaments
- **Tournaments** — list with create button (gated behind `isAdmin`)
- **TournamentDetail** — full management:
  - Edit name (inline), Edit Details (DynamicForm), Generate Bracket, Delete — gated behind `isAdmin`
  - Players: Import CSV, Add Players, remove player — gated behind `isAdmin`
  - Teams: Add/Rename/Delete team, add/remove members — gated behind `isAdmin`
  - Matches: Add Match — gated behind `isAdmin`
- **MatchDetail** — match view with toss info, live score, batsman/bowling stats, per-innings result
- **MatchScore** — cricket scoring interface:
  - Striker/non-striker selects with per-batsman stats card
  - Bowling figures card (wickets/runs/overs/eco)
  - Run buttons (0–6), extras (wide/no-ball), wicket selector (with run-out option)
  - Ball history showing `striker → bowler`
  - Complete Innings button with confirmation
- **AdminOrganizations** — list orgs, create/delete (gated behind `super_admin`)
- **AdminUsers** — list org members, edit roles (gated behind `super_admin`/`org_admin`)
- **FormConfigs** — dynamic form configuration per org (gated behind `super_admin`/`org_admin`)
- **Profile** — user profile
- **AccessDenied** — shown when role check fails

## Data Fetching
- TanStack Query for all API calls, cache invalidation on mutations
- Shared `['my-org-role']` query key for role checks across components
- `api` client (axios wrapper) for all HTTP calls

## Technologies
React, TypeScript, MUI, TanStack Query, React Router, DynamicForm (react-dynoform)
