"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

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

export function AskForm() {
  const [token, setToken] = useState("");
  const [question, setQuestion] = useState("");
  const [injuryId, setInjuryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AgentAnswer | null>(null);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    setError("");
    setResult(null);

    const trimmedToken = token.trim();
    const trimmedQuestion = question.trim();
    const trimmedInjuryId = injuryId.trim();

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

    if (trimmedInjuryId) {
      body.injuryId = Number(trimmedInjuryId);
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

      setResult(data as AgentAnswer);
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
                required
              />

              <p className="text-sm text-muted-foreground">
                This service verifies but does not issue tokens (see README) —
                paste one signed with the server&apos;s{" "}
                <code className="font-mono">JWT_SECRET</code>.
              </p>
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

            <div className="space-y-2">
              <Label htmlFor="injuryId">Injury ID</Label>

              <Input
                id="injuryId"
                type="number"
                min={1}
                step={1}
                value={injuryId}
                onChange={(e) => setInjuryId(e.target.value)}
              />

              <p className="text-sm text-muted-foreground">Optional.</p>
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
