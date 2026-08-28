# Security guidance for Injury Journal AI

## Authentication

- Protected API endpoints must require a valid `Authorization: Bearer <JWT>` token.
- JWTs must be verified using `JWT_SECRET`.
- Only `HS256` is accepted; do not accept algorithms supplied by the token outside the explicit allowlist.
- JWT expiration (`exp`) must be validated.
- The verified JWT `sub` claim is the authenticated user's identity and is attached to `req.userId`.
- Never trust a client-supplied `userId` from request bodies, query parameters, or URL parameters when `req.userId` is available.
- This repository verifies externally-issued tokens; it does not implement login, password handling, or token issuance.

## Authorization and data ownership

- Authenticated user identity must be enforced server-side for user-owned journal data.
- A client-controlled resource ID must never be sufficient to access another user's journal data.
- Database queries for user-owned records must enforce the authenticated user's ownership where applicable.
- Do not introduce endpoints that allow one authenticated user to read, modify, or delete another user's journal data.
- Authorization checks must happen before returning or mutating protected user data.

## Medical and journal data

- Injury Journal data is sensitive user data.
- Do not log journal contents, medical information, JWTs, authorization headers, secrets, or database credentials.
- Do not expose sensitive journal data through error messages, debugging output, or unnecessary API responses.
- Do not return database errors or internal implementation details directly to API clients.

## Database security

- The running application must use the least-privileged PostgreSQL role.
- Application code must not require schema-owner or DDL privileges.
- Database queries must preserve user-level data isolation.
- Avoid dynamically constructed SQL from client-controlled input.
- Do not introduce database operations that bypass the application's authorization boundary.

## RAG and AI security

- Retrieval must only return documents belonging to the authenticated user.
- A user's retrieved journal chunks must never be exposed to another user.
- User-controlled journal content must be treated as untrusted input.
- Retrieved content must not be treated as trusted instructions to the AI system.
- Do not allow retrieved content or user input to override system-level safety or authorization instructions.
- Do not expose internal prompts, secrets, credentials, or security configuration through AI responses.
- If retrieval finds no relevant authorized information, the system must not invent medical or journal facts.

## Secrets and configuration

- Secrets must come from environment variables or an appropriate secret-management mechanism.
- Never hardcode JWT secrets, database passwords, API keys, or cloud credentials.
- Never commit secrets to the repository.
- Avoid exposing secrets through logs, errors, API responses, tests, or generated files.

## Security review priorities

When reviewing changes, pay particular attention to:

1. Authentication bypasses.
2. Authorization or ownership bypasses.
3. IDOR vulnerabilities.
4. Cross-user retrieval or database access.
5. Exposure of medical journal data.
6. JWT verification weaknesses.
7. Injection vulnerabilities.
8. Secrets or credentials leaking into source code or logs.
9. AI/RAG prompt injection or unauthorized retrieval.
10. Changes that weaken existing security boundaries.
