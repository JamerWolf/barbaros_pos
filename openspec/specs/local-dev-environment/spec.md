# Local Development Environment Specification

## Purpose

Define the local development services, environment variables, version-control exclusions, and convenience scripts required to run Bárbaro's POS on a developer machine.

## Requirements

### Requirement: PostgreSQL service definition

The repository SHALL contain a Docker Compose file that defines a PostgreSQL service listening on port 5432 and using a named volume for persistent data.

#### Scenario: Happy path — database starts successfully

- GIVEN Docker Desktop is running
- WHEN the developer runs the db:up script
- THEN a PostgreSQL container SHALL start
- AND it SHALL accept connections on localhost:5432

#### Scenario: Edge case — port 5432 is already in use

- GIVEN another process is already bound to port 5432
- WHEN the developer runs the db:up script
- THEN Docker Compose SHALL fail and report the port conflict

### Requirement: Database data persistence

The PostgreSQL service SHALL store its data in a named Docker volume so that data survives container restarts.

#### Scenario: Happy path — data persists after restart

- GIVEN the PostgreSQL container is running with a named volume
- WHEN the developer runs db:down followed by db:up
- THEN previously created databases and tables SHALL still exist

#### Scenario: Edge case — volume is manually removed

- GIVEN the named volume has been deleted by the developer
- WHEN the db:up script runs
- THEN Docker Compose SHALL recreate the volume
- AND the database SHALL start empty

### Requirement: Environment variable documentation

The repository SHALL contain a .env.example file that lists every environment variable required for local development, including the database connection string, server port, and any API-specific variables.

#### Scenario: Happy path — new developer copies .env.example

- GIVEN .env.example contains all required variables
- WHEN a new developer copies it to .env and fills in the values
- THEN the API and database scripts SHALL have all variables they need

#### Scenario: Edge case — required variable is missing from .env.example

- GIVEN .env.example omits a variable used by the API
- WHEN a developer creates .env from the example
- THEN the API SHALL fail to start with a clear error about the missing variable

### Requirement: Version control exclusions

The repository SHALL contain a .gitignore file that excludes node_modules, build output, local environment files, and generated Prisma migration artifacts.

#### Scenario: Happy path — generated files are ignored

- GIVEN .gitignore lists node_modules, dist, .env, and generated migration directories
- WHEN a developer runs git status
- THEN those paths SHALL not appear as untracked files

#### Scenario: Edge case — .env is accidentally committed

- GIVEN .gitignore does not include .env
- WHEN a developer creates a .env file
- THEN git status SHALL show .env as untracked
- AND a commit that includes it SHALL be considered a security risk

### Requirement: Git repository initialization

The project root SHALL be a valid Git repository.

#### Scenario: Happy path — git commands work

- GIVEN the repository has been initialized with git
- WHEN the developer runs git status
- THEN Git SHALL report the current branch and working tree status

#### Scenario: Edge case — git is not initialized

- GIVEN the project root is not a Git repository
- WHEN the developer runs git status
- THEN Git SHALL fail with "not a git repository"

### Requirement: Database lifecycle scripts

The root package.json SHALL provide scripts to start, stop, migrate, and inspect the local database.

#### Scenario: Happy path — db lifecycle scripts execute

- GIVEN the root package.json defines db:up, db:down, db:migrate, and db:studio
- WHEN the developer runs any of these scripts
- THEN the corresponding database operation SHALL execute successfully

#### Scenario: Edge case — Docker is not running

- GIVEN Docker Desktop is stopped
- WHEN the developer runs db:up
- THEN the script SHALL fail with an error indicating that Docker is unavailable
