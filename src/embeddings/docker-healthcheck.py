"""Docker HEALTHCHECK for the embedding service container.

Every route requires Authorization: Bearer <EMBEDDING_API_KEY> (an app-level
FastAPI dependency in embedding_api.py), so there is no unauthenticated
/health route to poll. This authenticates the same way a real client would.
A 200 response also confirms the sentence-transformers model finished
loading, since it is constructed eagerly at import time (embedding_service.py).
"""

import os
import sys
import urllib.request


def main() -> int:
    request = urllib.request.Request(
        "http://localhost:8000/embed-query",
        data=b'{"text": "healthcheck"}',
        headers={
            "Authorization": f"Bearer {os.environ.get('EMBEDDING_API_KEY', '')}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        # Matches EMBEDDING_API_TIMEOUT_MS's default (30s) -- CPU inference can
        # be this slow on a constrained/shared machine, even once warmed up.
        with urllib.request.urlopen(request, timeout=25) as response:
            return 0 if response.status == 200 else 1
    except Exception:
        return 1


if __name__ == "__main__":
    sys.exit(main())
