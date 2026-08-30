"use client";

import { useRef, useState } from "react";
import type { SubmitEventHandler } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Radix Select has no concept of an empty value, so "all" stands in for
// "no injuryId". It is never sent to the API -- see handleSubmit.
const ALL_INJURIES = "all";

type Injury = {
  id: number;
  name: string;
  bodyArea: string;
  side: string | null;
};

type Citation = {
  label?: string;
  sourceType?: string;
  sourceId: number | string;
  date?: string;
};

type AgentAnswer = {
  answer: string;
  citations?: Citation[];
};

function formatCitation(citation: Citation) {
  const parts = [citation.label, citation.sourceType, `#${citation.sourceId}`];

  if (citation.date) {
    parts.push(citation.date);
  }

  return parts.filter(Boolean).join(" — ");
}

// Mirrors journalTool's own "Body area: knee (left)" formatting so the two
// surfaces describe an injury the same way.
function formatInjuryLabel(injury: Injury) {
  const area = `${injury.bodyArea}${injury.side ? ` (${injury.side})` : ""}`;

  return `${injury.name} — ${area}`;
}

export function AskForm() {
  const [token, setToken] = useState("");
  const [question, setQuestion] = useState("");
  const [injuryId, setInjuryId] = useState(ALL_INJURIES);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [injuriesLoading, setInjuriesLoading] = useState(false);
  const [injuriesError, setInjuriesError] = useState("");
  const [loadedForToken, setLoadedForToken] = useState("");
  // Tracks which loadInjuries call is newest, so a response for a
  // superseded token can't overwrite state after a later request started.
  const requestRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AgentAnswer | null>(null);

  // Drops the list and any selection made from it. Every exit that isn't a
  // successful load must call this, so the dropdown never shows one token's
  // injuries while the field holds another. Callers own injuriesError, since a
  // failed load keeps its message on screen while a cleared field does not.
  //
  // Resetting loadedForToken also re-arms the fetch, so the next blur retries
  // instead of being skipped by the already-loaded guard.
  function clearInjuries() {
    setInjuries([]);
    setLoadedForToken("");
    setInjuryId(ALL_INJURIES);
  }

  // GET /injuries is authenticated, so the list can only be fetched once a
  // token exists. Triggered on blur rather than per keystroke.
  async function loadInjuries() {
    // Bump before the early returns below too: a blur that gets skipped
    // (already-loaded token) must still invalidate any older in-flight
    // request, or that request's late response can overwrite the correct
    // state the skip just left on screen.
    const requestId = ++requestRef.current;
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      clearInjuries();
      setInjuriesError("");
      return;
    }

    if (trimmedToken === loadedForToken) {
      return;
    }

    setInjuriesLoading(true);
    setInjuriesError("");

    try {
      const response = await fetch("/injuries", {
        headers: { Authorization: `Bearer ${trimmedToken}` },
      });

      let data: unknown;

      try {
        data = await response.json();
      } catch {
        if (requestId === requestRef.current) {
          clearInjuries();
          setInjuriesError(
            `Could not load injuries: unexpected non-JSON response (HTTP ${response.status}).`,
          );
        }
        return;
      }

      if (requestId !== requestRef.current) return;

      if (!response.ok) {
        const { error: message, code } = (data ?? {}) as {
          error?: string;
          code?: string;
        };

        clearInjuries();
        setInjuriesError(
          `Could not load injuries: ${message ?? "request failed"}${code ? ` (${code})` : ""}`,
        );
        return;
      }

      const { injuries: loaded } = (data ?? {}) as { injuries?: unknown };

      // A 200 does not guarantee the shape -- API_ORIGIN can be repointed at
      // another service (see next.config.ts). A non-array would throw in the
      // .find()/.map() below and unmount the form, losing the typed question,
      // so fall back to an empty list instead.
      setInjuries(Array.isArray(loaded) ? (loaded as Injury[]) : []);
      setLoadedForToken(trimmedToken);
      // A different token may be a different user, so any previous selection
      // is no longer meaningful.
      setInjuryId(ALL_INJURIES);
    } catch {
      if (requestId !== requestRef.current) return;
      clearInjuries();
      setInjuriesError("Could not load injuries — is the server reachable?");
    } finally {
      // Unconditional: requestRef is bumped by every call, including ones
      // that skip below without dispatching a fetch, so a stale request's
      // own finally may be the only thing left to ever clear the spinner.
      setInjuriesLoading(false);
    }
  }

  // SelectContent is unmounted until the dropdown is first opened, so Radix has
  // no registered item text to reflect and SelectValue would render empty on
  // load. Passing the label explicitly is Radix's supported escape hatch.
  const selectedInjury = injuries.find(
    (injury) => String(injury.id) === injuryId,
  );
  const selectedLabel = selectedInjury
    ? formatInjuryLabel(selectedInjury)
    : "All injuries";

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    setError("");
    setResult(null);

    const trimmedToken = token.trim();
    const trimmedQuestion = question.trim();

    if (!trimmedToken) {
      setError("A bearer token is required.");
      return;
    }

    if (!trimmedQuestion) {
      setError("A question is required.");
      return;
    }

    const body: { question: string; injuryId?: number } = {
      question: trimmedQuestion,
    };

    if (injuryId !== ALL_INJURIES) {
      body.injuryId = Number(injuryId);
    }

    setLoading(true);

    try {
      const response = await fetch("/ai-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${trimmedToken}`,
        },
        body: JSON.stringify(body),
      });

      let data: unknown;

      try {
        data = await response.json();
      } catch {
        setError(
          `Unexpected non-JSON response from the server (HTTP ${response.status}).`,
        );
        return;
      }

      if (!response.ok) {
        const { error: message, code } = (data ?? {}) as {
          error?: string;
          code?: string;
        };

        setError(`${message ?? "Request failed"}${code ? ` (${code})` : ""}`);
        return;
      }

      const { answer, citations } = (data ?? {}) as {
        answer?: unknown;
        citations?: unknown;
      };

      // Same reasoning as loadInjuries: a malformed 200 surfaces through the
      // existing error path rather than throwing while rendering the answer.
      if (
        typeof answer !== "string" ||
        (citations !== undefined && !Array.isArray(citations))
      ) {
        setError(
          `Unexpected response shape from the server (HTTP ${response.status}).`,
        );
        return;
      }

      setResult({ answer, citations: citations as Citation[] | undefined });
    } catch {
      setError("Network error — is the server reachable?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Injury Journal AI</CardTitle>

          <CardDescription>
            Ask a question grounded in your injury journal.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Bearer token</Label>

              <Input
                id="token"
                placeholder="eyJhbGciOi..."
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onBlur={loadInjuries}
                required
              />

              <p className="text-sm text-muted-foreground">
                This service verifies but does not issue tokens (see README) —
                paste one signed with the server&apos;s{" "}
                <code className="font-mono">JWT_SECRET</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="injury">Injury</Label>

              <Select value={injuryId} onValueChange={setInjuryId}>
                <SelectTrigger id="injury" className="w-full">
                  <SelectValue>{selectedLabel}</SelectValue>
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_INJURIES}>All injuries</SelectItem>

                  {injuries.map((injury) => (
                    <SelectItem key={injury.id} value={String(injury.id)}>
                      {formatInjuryLabel(injury)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {injuriesError ? (
                <p className="text-sm text-destructive">{injuriesError}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {injuriesLoading
                    ? "Loading injuries..."
                    : !loadedForToken
                      ? "Paste a token to load your injuries."
                      : injuries.length === 0
                        ? "No injuries found for this token."
                        : "Leave as All injuries to search across all of them."}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>

              <Textarea
                id="question"
                placeholder="What treatments have I tried?"
                maxLength={10000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Asking..." : "Ask"}
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Answer</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm whitespace-pre-wrap">{result.answer}</p>

            {result.citations && result.citations.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium">Citations</h2>

                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.citations.map((citation, index) => (
                    <li
                      key={`${citation.sourceType ?? "source"}-${citation.sourceId}-${index}`}
                    >
                      {formatCitation(citation)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
