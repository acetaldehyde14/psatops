# Repository Guidelines

## Project Structure & Module Organization

This is a full-stack palletisation optimiser. Backend code lives in `backend/src/main/java/com/psap/palletisation`: REST controllers in `controller/`, packing algorithms in `algorithm/`, domain models in `model/`, typed DTOs in `dto/`, Spring services in `service/`, and enums in `enums/`. Frontend code lives in `frontend/src`: App Router pages in `app/`, reusable UI in `components/`, and shared client types/API helpers in `lib/`. Docker entry points are `docker-compose.yml`, `backend/Dockerfile`, and `frontend/Dockerfile`.

## Build, Test, and Development Commands

- `cd backend && ./mvnw spring-boot:run`: run the API locally at `http://localhost:8000`.
- `cd backend && ./mvnw test`: run all backend unit and integration tests.
- `cd backend && ./mvnw package -DskipTests`: build the fat JAR.
- `java -jar backend/target/palletisation-0.1.0-SNAPSHOT.jar`: run the built JAR directly.
- `cd frontend && npm install`: install Next.js dependencies.
- `cd frontend && npm run dev`: run the frontend at `http://localhost:3000`.
- `cd frontend && npm run build`: build the frontend.
- `cd frontend && npm run lint && npm run typecheck`: run frontend linting and TypeScript checks.
- `docker-compose up --build`: start both services with Docker.

## Coding Style & Naming Conventions

Java uses 4-space indentation, typed DTOs for all request/response contracts, and camelCase for fields (serialized to snake_case via Jackson). Controllers delegate entirely to services — no business logic in controllers. Algorithm classes live in `algorithm/`, shared geometry utilities in `algorithm/util/`.

TypeScript/React uses 2-space indentation, PascalCase component files such as `PalletViewer3D.tsx`, and camelCase helpers in `src/lib`. Prefer typed props and shared interfaces from `src/lib/types.ts`. Use TailwindCSS for styling.

## Testing Guidelines

Backend tests use JUnit 5 and Spring Boot's `MockMvc`. Place tests in `backend/src/test/java/com/psap/palletisation/`, mirroring the main package structure. Name test classes `<Subject>Test.java` and test methods `test<Behavior>`. Add tests for new endpoints, parser behavior, validation rules, and algorithm edge cases. No frontend test framework is configured; validate frontend changes with `npm run lint`, `npm run typecheck`, and manual browser checks.

## Commit & Pull Request Guidelines

The current history uses short imperative commit messages, for example `Update frontend output`. Use concise, action-oriented summaries. Pull requests should include a brief description, testing performed, linked issue or task when available, and screenshots for UI changes. Do not commit generated caches such as `frontend/.next/` or `backend/target/`.

## Security & Configuration Tips

CORS settings are controlled in `backend/src/main/java/com/psap/palletisation/config/WebConfig.java`; restrict allowed origins before deploying outside localhost. Job storage is currently in-memory (`JobStoreService.java`), so avoid presenting it as durable persistence without adding a Spring Data repository.
