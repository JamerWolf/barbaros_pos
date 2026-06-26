# Workspace Scaffold Specification

## Purpose

Define the directory structure, package identity, and module resolution rules for the three workspaces of the Bárbaro's POS monorepo: apps/api, apps/web, and packages/shared.

## Requirements

### Requirement: Root workspace declaration

The root package.json SHALL declare apps/api, apps/web, and packages/shared as npm workspaces.

#### Scenario: Happy path — workspaces are recognized

- GIVEN the root package.json contains the workspaces list
- WHEN npm install runs at the repository root
- THEN npm SHALL create symlinks for @barbaros/api, @barbaros/web, and @barbaros/shared

#### Scenario: Edge case — a workspace path is missing

- GIVEN the workspaces list references a directory that does not exist
- WHEN npm install runs
- THEN npm SHALL fail with an error indicating the missing workspace path

### Requirement: API workspace package identity

The apps/api workspace SHALL have a package.json whose name matches the @barbaros/api scope.

#### Scenario: Happy path — API package is installable

- GIVEN apps/api/package.json declares "name": "@barbaros/api"
- WHEN npm install runs
- THEN the workspace SHALL be resolvable as @barbaros/api from any other workspace

### Requirement: Web workspace package identity

The apps/web workspace SHALL have a package.json whose name matches the @barbaros/web scope.

#### Scenario: Happy path — web package is installable

- GIVEN apps/web/package.json declares "name": "@barbaros/web"
- WHEN npm install runs
- THEN the workspace SHALL be resolvable as @barbaros/web

### Requirement: Shared workspace package identity and exports

The packages/shared workspace SHALL have a package.json whose name matches the @barbaros/shared scope and SHALL export its public types through a single entry point.

#### Scenario: Happy path — shared types are imported

- GIVEN packages/shared exports SocketEvents and other base types from its entry point
- WHEN apps/api imports { SocketEvents } from "@barbaros/shared"
- THEN the import SHALL resolve and TypeScript SHALL recognize the type

#### Scenario: Edge case — missing barrel export

- GIVEN packages/shared does not declare a main/types entry or barrel file
- WHEN apps/web imports from "@barbaros/shared"
- THEN the build SHALL fail with a module resolution error

### Requirement: Per-workspace TypeScript extension

Each workspace SHALL have a tsconfig.json file that extends the root base configuration and defines workspace-specific compiler behavior.

#### Scenario: Happy path — all tsconfigs are valid

- GIVEN apps/api, apps/web, and packages/shared each have a tsconfig.json
- WHEN the root typecheck script runs
- THEN TypeScript SHALL process each workspace with its own configuration

#### Scenario: Edge case — tsconfig references non-existent base

- GIVEN a workspace tsconfig extends a file that does not exist
- WHEN the typecheck script runs
- THEN TypeScript SHALL fail and report the missing base configuration

### Requirement: Cross-workspace module resolution for shared package

Both apps/api and apps/web SHALL be able to import values and types from @barbaros/shared without manual path aliasing.

#### Scenario: Happy path — API and web resolve shared imports

- GIVEN @barbaros/shared is correctly declared as a workspace dependency
- WHEN both apps/api and apps/web import from it
- THEN the imports SHALL resolve during development and build

#### Scenario: Edge case — shared package name mismatch

- GIVEN the installed package name differs from the import specifier
- WHEN an app imports from "@barbaros/shared"
- THEN the build SHALL fail with a "module not found" error
