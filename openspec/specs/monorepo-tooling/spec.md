# Monorepo Tooling Specification

## Purpose

Define the shared development tooling that every workspace in the Bárbaro's POS monorepo MUST use to guarantee consistent type checking, linting, formatting, and pre-commit validation.

## Requirements

### Requirement: Shared TypeScript base configuration

The repository SHALL contain a root TypeScript base configuration that declares the target ECMAScript version, module system, and strictness rules used by every workspace.

#### Scenario: Happy path — workspace extends base config

- GIVEN the root TypeScript base configuration exists
- WHEN a developer adds a new workspace
- THEN that workspace SHALL reference the base configuration as its foundation
- AND it SHALL only override paths and output settings specific to that workspace

#### Scenario: Edge case — base config is missing

- GIVEN the root TypeScript base configuration is absent
- WHEN a developer runs the type-check command
- THEN the command SHALL fail with a clear error indicating the missing base configuration

### Requirement: Per-workspace TypeScript configuration

Each workspace (apps/api, apps/web, packages/shared) SHALL have its own TypeScript configuration that extends the base configuration and defines workspace-specific compiler options such as outDir, rootDir, and project references.

#### Scenario: Happy path — typecheck passes for all workspaces

- GIVEN every workspace has a valid TypeScript configuration
- WHEN the root typecheck script runs
- THEN all workspaces SHALL compile without type errors

#### Scenario: Edge case — a workspace references a missing project

- GIVEN a workspace declares a project reference to another workspace that does not exist
- WHEN the typecheck script runs
- THEN the command SHALL fail and report the invalid project reference

### Requirement: ESLint flat configuration

The repository SHALL contain a single ESLint flat configuration at the root that lints TypeScript source files across all workspaces and resolves the shared package.

#### Scenario: Happy path — lint passes on clean code

- GIVEN all source files follow the lint rules
- WHEN the lint script runs from the repository root
- THEN ESLint SHALL report zero errors and zero warnings

#### Scenario: Edge case — lint fails on invalid syntax

- GIVEN a source file contains a lint violation
- WHEN the lint script runs
- THEN ESLint SHALL report the violation with the file path and rule name
- AND the command SHALL exit with a non-zero status

### Requirement: Prettier formatting rules

The repository SHALL contain a Prettier configuration file that defines the formatting conventions for the entire monorepo.

#### Scenario: Happy path — format check passes

- GIVEN all source files match the Prettier configuration
- WHEN the format check script runs
- THEN Prettier SHALL report no differences

#### Scenario: Edge case — format check detects drift

- GIVEN a source file does not match the Prettier configuration
- WHEN the format check script runs
- THEN Prettier SHALL list the files that need formatting
- AND the command SHALL exit with a non-zero status

### Requirement: Husky pre-commit validation

The repository SHALL use Husky to run linting, formatting, and type checking on staged files before every commit.

#### Scenario: Happy path — pre-commit allows valid changes

- GIVEN staged files pass lint, format, and typecheck
- WHEN a developer executes a git commit
- THEN the commit SHALL succeed

#### Scenario: Edge case — pre-commit blocks invalid changes

- GIVEN a staged file contains a type error
- WHEN a developer executes a git commit
- THEN the pre-commit hook SHALL abort the commit
- AND it SHALL report the failing check to the developer
