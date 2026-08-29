const tokenInput = document.getElementById('token');
const questionInput = document.getElementById('question');
const injuryIdInput = document.getElementById('injuryId');
const submitButton = document.getElementById('submit');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const resultEl = document.getElementById('result');
const answerEl = document.getElementById('answer');
const citationsEl = document.getElementById('citations');

function setHidden(el, hidden) {
  el.hidden = hidden;
}

function formatCitation(citation) {
  const parts = [citation.label, citation.sourceType, `#${citation.sourceId}`];

  if (citation.date) {
    parts.push(citation.date);
  }

  return parts.filter(Boolean).join(' — ');
}

function renderCitations(citations) {
  citationsEl.innerHTML = '';

  for (const citation of citations ?? []) {
    const item = document.createElement('li');
    item.textContent = formatCitation(citation);
    citationsEl.appendChild(item);
  }
}

async function submitQuestion() {
  const token = tokenInput.value.trim();
  const question = questionInput.value.trim();
  const injuryIdRaw = injuryIdInput.value.trim();

  setHidden(errorEl, true);
  setHidden(resultEl, true);
  errorEl.textContent = '';

  if (!token) {
    errorEl.textContent = 'A bearer token is required.';
    setHidden(errorEl, false);
    return;
  }

  if (!question) {
    errorEl.textContent = 'A question is required.';
    setHidden(errorEl, false);
    return;
  }

  const body = { question };

  if (injuryIdRaw) {
    body.injuryId = Number(injuryIdRaw);
  }

  submitButton.disabled = true;
  statusEl.textContent = 'Asking...';
  setHidden(statusEl, false);

  try {
    const response = await fetch('/ai-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const code = data.code ? ` (${data.code})` : '';
      errorEl.textContent = `${data.error ?? 'Request failed'}${code}`;
      setHidden(errorEl, false);
      return;
    }

    answerEl.textContent = data.answer;
    renderCitations(data.citations);
    setHidden(resultEl, false);
  } catch {
    errorEl.textContent = 'Network error — is the server reachable?';
    setHidden(errorEl, false);
  } finally {
    submitButton.disabled = false;
    setHidden(statusEl, true);
  }
}

submitButton.addEventListener('click', submitQuestion);
