import { PollConfig } from './config';
import { PollResults } from './db';

function progressBar(count: number, total: number): string {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <div class="d-flex align-items-center gap-2 mb-1">
      <div class="progress flex-grow-1" style="height:20px;">
        <div class="progress-bar bg-primary" role="progressbar"
             style="width:${pct}%"
             aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          ${pct}%
        </div>
      </div>
      <span class="text-muted small" style="min-width:60px;">${count} hlasů</span>
    </div>`;
}

function renderPollCard(
  poll: PollConfig,
  results: PollResults,
  viewOnly: boolean,
  alreadyVoted: boolean
): string {
  const optionKeys: ('a' | 'b' | 'c')[] = ['a', 'b', 'c'];

  const formRows = optionKeys.map((key) => {
    const opt = poll.options.find((o) => o.key === key)!;
    return `
      <div class="mb-2">
        <div class="form-check">
          <input class="form-check-input" type="radio" name="option"
                 id="poll${poll.id}_${key}" value="${key}" required${alreadyVoted ? ' disabled' : ''}>
          <label class="form-check-label fw-semibold" for="poll${poll.id}_${key}">
            ${key.toUpperCase()}) ${escapeHtml(opt.label)}
          </label>
        </div>
        ${progressBar(results.counts[key], results.total)}
      </div>`;
  });

  const alreadyVotedNotice = alreadyVoted
    ? `<div class="alert alert-info mt-2 mb-0">✅ V této anketě jste již hlasoval/a.</div>`
    : '';

  const formHtml = viewOnly
    ? ''
    : `
      <form class="vote-form mt-3" data-poll-id="${poll.id}">
        ${formRows.join('')}
        <button type="submit" class="btn btn-primary mt-2"${alreadyVoted ? ' disabled' : ''}>Hlasovat</button>
      </form>
      ${alreadyVotedNotice}
      <div class="alert mt-2 d-none vote-msg" role="alert"></div>`;

  const resultsOnlyHtml = viewOnly
    ? `<div class="mt-3">${formRows.join('')}</div>`
    : '';

  return `
    <div class="card mb-4 shadow-sm">
      <div class="card-header bg-primary text-white">
        <h5 class="mb-0">Anketa ${poll.id}: ${escapeHtml(poll.title)}</h5>
      </div>
      <div class="card-body">
        <p class="text-muted small mb-2">Celkem hlasů: <strong>${results.total}</strong></p>
        ${viewOnly ? resultsOnlyHtml : formHtml}
      </div>
    </div>`;
}

export function renderPage(
  polls: PollConfig[],
  allResults: PollResults[],
  viewOnly: boolean,
  votedPollIds: number[] = []
): string {
  const cards = polls
    .map((poll) => {
      const results = allResults.find((r) => r.pollId === poll.id)!;
      return renderPollCard(poll, results, viewOnly, votedPollIds.includes(poll.id));
    })
    .join('');

  const modeToggle = viewOnly
    ? `<a href="/" class="btn btn-outline-light btn-sm">🗳️ Hlasovat</a>`
    : ``;

  const votingScript = viewOnly
    ? ''
    : `
  <script>
    document.querySelectorAll('.vote-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pollId = form.dataset.pollId;
        const selected = form.querySelector('input[name="option"]:checked');
        const msgEl = form.nextElementSibling;

        if (!selected) {
          msgEl.className = 'alert alert-warning mt-2';
          msgEl.textContent = 'Prosím vyberte jednu možnost.';
          return;
        }

        try {
          const res = await fetch('/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pollId: parseInt(pollId), option: selected.value })
          });
          const data = await res.json();

          if (!res.ok) {
            if (data.alreadyVoted) {
              msgEl.className = 'alert alert-info mt-2';
              msgEl.textContent = 'V této anketě jste již hlasoval/a.';
              form.querySelectorAll('input[type=radio]').forEach(function(r) { r.disabled = true; });
              form.querySelector('button[type=submit]').disabled = true;
            } else {
              msgEl.className = 'alert alert-danger mt-2';
              msgEl.textContent = data.error || 'Chyba při odesílání hlasu.';
            }
            return;
          }

          msgEl.className = 'alert alert-success mt-2';
          msgEl.textContent = 'Váš hlas byl zaznamenán!';

          // Aktualizuj progress bary
          const counts = data.counts;
          const total = data.total;
          ['a','b','c'].forEach(key => {
            const radio = form.querySelector('#poll' + pollId + '_' + key);
            if (!radio) return;
            const container = radio.closest('.mb-2');
            const bar = container.querySelector('.progress-bar');
            const countEl = container.querySelector('.text-muted');
            const pct = total > 0 ? Math.round((counts[key] / total) * 100) : 0;
            bar.style.width = pct + '%';
            bar.textContent = pct + '%';
            bar.setAttribute('aria-valuenow', pct);
            countEl.textContent = counts[key] + ' hlasů';
          });
          const totalEl = form.closest('.card-body').querySelector('strong');
          if (totalEl) totalEl.textContent = total;

          form.querySelectorAll('input[type=radio]').forEach(r => r.disabled = true);
          form.querySelector('button[type=submit]').disabled = true;

        } catch (err) {
          msgEl.className = 'alert alert-danger mt-2';
          msgEl.textContent = 'Síťová chyba, zkuste to prosím znovu.';
        }
      });
    });
  </script>`;

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Anketa</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
        crossorigin="anonymous" />
  <style>
    body { background: #f8f9fa; }
    .navbar-brand { font-weight: 700; letter-spacing: 1px; }
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
    <div class="container">
      <a class="navbar-brand" href="/">📋 Ankety</a>
      <div class="ms-auto d-flex gap-2">
        <a href="/about" class="btn btn-outline-light btn-sm">ℹ️ O anketě</a>
        <a href="/settings" class="btn btn-outline-light btn-sm">⚙️ Nastavení</a>
        ${modeToggle}
      </div>
    </div>
  </nav>

  <div class="container" style="max-width:680px;">
    ${cards}

    <div class="card mb-4 shadow-sm">
      <div class="card-header bg-secondary text-white">
        <h5 class="mb-0">Nahlásit problém s webem</h5>
      </div>
      <div class="card-body">
        <p class="text-muted small mb-3">Narazili jste na chybu nebo máte návrh na vylepšení? Napište nám.</p>
        <form id="reportForm">
          <div class="mb-3">
            <label for="reportAuthor" class="form-label small fw-semibold">Vaše jméno</label>
            <input type="text" id="reportAuthor" class="form-control" placeholder="Jméno autora" maxlength="100">
          </div>
          <div class="mb-3">
            <label for="reportMessage" class="form-label small fw-semibold">Popis problému</label>
            <textarea id="reportMessage" class="form-control" rows="4"
              placeholder="Popište problém nebo návrh..." maxlength="2000" required></textarea>
            <div class="form-text text-end"><span id="reportCharCount">0</span>/2000</div>
          </div>
          <button type="submit" class="btn btn-secondary" id="reportBtn">Odeslat hlášení</button>
        </form>
        <div id="reportMsg" class="alert mt-3 d-none" role="alert"></div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
          integrity="sha384-YvpcrYf0tY3lHB60NNkmXc4s9bIOgUxi8T/jzmEBjsqgdC0r+AcYMhj6rB8FNQTD"
          crossorigin="anonymous"></script>
  ${votingScript}
  <script>
    (function () {
      const textarea = document.getElementById('reportMessage');
      const authorInput = document.getElementById('reportAuthor');
      const charCount = document.getElementById('reportCharCount');
      const form = document.getElementById('reportForm');
      const msgEl = document.getElementById('reportMsg');
      const btn = document.getElementById('reportBtn');

      if (!textarea || !form) return;

      textarea.addEventListener('input', function () {
        charCount.textContent = textarea.value.length;
      });

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const message = textarea.value.trim();
        if (!message) {
          msgEl.className = 'alert alert-warning mt-3';
          msgEl.textContent = 'Popis problému nesmí být prázdný.';
          msgEl.classList.remove('d-none');
          textarea.focus();
          return;
        }
        const author = authorInput ? authorInput.value.trim() : '';

        btn.disabled = true;
        msgEl.className = 'alert alert-secondary mt-3';
        msgEl.textContent = 'Odesílám...';
        msgEl.classList.remove('d-none');

        try {
          const res = await fetch('/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author, message })
          });
          const data = await res.json();

          if (res.ok) {
            msgEl.className = 'alert alert-success mt-3';
            msgEl.textContent = data.message || 'Hlášení bylo odesláno. Děkujeme!';
            textarea.value = '';
            if (authorInput) authorInput.value = '';
            charCount.textContent = '0';
          } else {
            msgEl.className = 'alert alert-danger mt-3';
            msgEl.textContent = data.error || 'Chyba při odesílání hlášení.';
          }
        } catch {
          msgEl.className = 'alert alert-danger mt-3';
          msgEl.textContent = 'Síťová chyba, zkuste to prosím znovu.';
        } finally {
          btn.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderAboutPage(): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>O anketě</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
  <style>
    body { background: #f8f9fa; }
    .navbar-brand { font-weight: 700; letter-spacing: 1px; }
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
    <div class="container">
      <a class="navbar-brand" href="/">📋 Ankety</a>
      <div class="ms-auto d-flex gap-2">
        <a href="/" class="btn btn-outline-light btn-sm">Zpět na ankety</a>
      </div>
    </div>
  </nav>

  <div class="container" style="max-width:680px;">
    <div class="card shadow-sm">
      <div class="card-header bg-secondary text-white">
        <h5 class="mb-0">O anketě</h5>
      </div>
      <div class="card-body">
        <p>Tato webová aplikace slouží pro hlasování v anketách týkajících se programovacích jazyků a frameworků.</p>
        <p>Aplikace je napsána v TypeScriptu a využívá Express.js a SQLite.</p>
        
        <hr />
        
        <h6>Hlášení chyb</h6>
        <p>
          Pokud narazíte na jakoukoliv chybu nebo máte návrh na vylepšení, kontaktujte nás prosím na emailu:
          <a href="mailto:vegh@spsejecna.cz">vegh@spsejecna.cz</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function renderSettingsPage(): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nastavení</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
  <style>
    body { background: #f8f9fa; }
    .navbar-brand { font-weight: 700; letter-spacing: 1px; }
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
    <div class="container">
      <a class="navbar-brand" href="/">📋 Ankety</a>
      <div class="ms-auto d-flex gap-2">
        <a href="/" class="btn btn-outline-light btn-sm">Zpět na ankety</a>
      </div>
    </div>
  </nav>

  <div class="container" style="max-width:680px;">
    <div class="card shadow-sm mb-4">
      <div class="card-header bg-danger text-white">
        <h5 class="mb-0">⚙️ Nastavení</h5>
      </div>
      <div class="card-body">
        <h6 class="text-danger">Nebezpečná zóna</h6>
        <p class="text-muted small">Následující akce jsou nevratné.</p>
        
        <hr />
        
        <p class="mb-2 fw-semibold">Resetovat všechny hlasy</p>
        <p class="small text-muted">Toto smaže všechny uložené hlasy ze všech anket a zneplatní existující cookies.</p>
        
        <div class="input-group mb-3">
          <input type="password" id="resetToken" class="form-control" placeholder="Zadejte reset token">
          <button class="btn btn-danger" id="resetBtn">Resetovat databázi</button>
        </div>
        <div id="resetMsg" class="small"></div>
      </div>
    </div>

    <div class="card shadow-sm mb-4">
      <div class="card-header bg-secondary text-white">
        <h5 class="mb-0">🐛 Odeslaná hlášení</h5>
      </div>
      <div class="card-body">
        <p class="text-muted small mb-3">Pro zobrazení hlášení zadejte reset token.</p>
        <div class="input-group mb-3">
          <input type="password" id="reportsToken" class="form-control" placeholder="Zadejte reset token">
          <button class="btn btn-secondary" id="loadReportsBtn">Zobrazit hlášení</button>
        </div>
        <div id="reportsMsg" class="small text-danger mb-2 d-none"></div>
        <div id="reportsList" class="d-none">
          <div id="reportsCount" class="text-muted small mb-2"></div>
          <div id="reportsItems"></div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    document.getElementById('resetBtn')?.addEventListener('click', async () => {
      const token = document.getElementById('resetToken').value;
      const msgEl = document.getElementById('resetMsg');
      const btn = document.getElementById('resetBtn');
      
      btn.disabled = true;
      msgEl.className = 'text-muted';
      msgEl.textContent = 'Provádím reset...';
      
      try {
        const res = await fetch('/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        
        if (res.ok) {
          msgEl.className = 'text-success fw-bold';
          msgEl.textContent = data.message || 'Hlasy byly úspěšně resetovány.';
          document.getElementById('resetToken').value = '';
        } else {
          msgEl.className = 'text-danger fw-bold';
          msgEl.textContent = data.error || 'Nesprávný token.';
        }
      } catch {
        msgEl.className = 'text-danger fw-bold';
        msgEl.textContent = 'Chyba při komunikaci se serverem.';
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('loadReportsBtn')?.addEventListener('click', async () => {
      const token = document.getElementById('reportsToken').value;
      const msgEl = document.getElementById('reportsMsg');
      const listEl = document.getElementById('reportsList');
      const countEl = document.getElementById('reportsCount');
      const itemsEl = document.getElementById('reportsItems');
      const btn = document.getElementById('loadReportsBtn');

      btn.disabled = true;
      msgEl.classList.add('d-none');
      listEl.classList.add('d-none');

      try {
        const res = await fetch('/reports?token=' + encodeURIComponent(token));
        const data = await res.json();

        if (!res.ok) {
          msgEl.textContent = data.error || 'Přístup odepřen.';
          msgEl.classList.remove('d-none');
          return;
        }

        countEl.textContent = 'Celkem hlášení: ' + data.length;

        if (data.length === 0) {
          itemsEl.innerHTML = '<p class="text-muted small">Žádná hlášení nebyla nalezena.</p>';
        } else {
          itemsEl.innerHTML = data.map(r => {
            const author = r.author ? '<span class="fw-semibold">' + escHtml(r.author) + '</span>' : '<span class="text-muted fst-italic">Anonymní</span>';
            const date = new Date(r.created_at).toLocaleString('cs-CZ');
            const isClosed = r.status === 'closed';
            const statusBadge = isClosed
              ? \`<span class="badge bg-danger ms-2" id="statusBadge_\${r.id}">● Uzavřeno</span>\`
              : \`<span class="badge bg-success ms-2" id="statusBadge_\${r.id}">● Otevřeno</span>\`;
            const toggleLabel = isClosed ? 'Znovu otevřít' : 'Uzavřít';
            const toggleClass = isClosed ? 'btn-outline-success' : 'btn-outline-danger';
            const adminCommentHtml = r.admin_comment
              ? \`<div class="alert alert-secondary py-1 px-2 mt-2 mb-0 small" id="adminCommentDisplay_\${r.id}"><strong>Komentář admina:</strong> \${escHtml(r.admin_comment)}</div>\`
              : \`<div class="d-none" id="adminCommentDisplay_\${r.id}"></div>\`;
            return \`<div class="border rounded p-3 mb-3 bg-white" id="report_\${r.id}">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <div>\${author} <span class="badge bg-secondary ms-1">#\${r.id}</span>\${statusBadge}</div>
                <small class="text-muted">\${date}</small>
              </div>
              <p class="mb-1 small">\${escHtml(r.message)}</p>
              <small class="text-muted">IP: \${r.ip || '—'}</small>
              \${adminCommentHtml}
              <div class="mt-2 border-top pt-2">
                <div class="mb-2">
                  <textarea class="form-control form-control-sm" id="adminComment_\${r.id}" rows="2"
                    placeholder="Komentář admina (nepovinné, max 1000 znaků)" maxlength="1000">\${escHtml(r.admin_comment || '')}</textarea>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-primary" onclick="saveReport(\${r.id})">💾 Uložit komentář</button>
                  <button class="btn btn-sm \${toggleClass}" id="toggleBtn_\${r.id}" onclick="toggleStatus(\${r.id}, '\${isClosed ? 'open' : 'closed'}')">
                    \${toggleLabel}
                  </button>
                </div>
                <div id="reportActionMsg_\${r.id}" class="small mt-1 d-none"></div>
              </div>
            </div>\`;
          }).join('');
        }

        listEl.classList.remove('d-none');
      } catch {
        msgEl.textContent = 'Chyba při načítání hlášení.';
        msgEl.classList.remove('d-none');
      } finally {
        btn.disabled = false;
      }
    });

    function escHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    async function patchReport(id, payload) {
      const token = document.getElementById('reportsToken').value;
      const msgEl = document.getElementById('reportActionMsg_' + id);
      msgEl.className = 'small mt-1 text-muted';
      msgEl.textContent = 'Ukládám...';
      msgEl.classList.remove('d-none');
      try {
        const res = await fetch('/reports/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, ...payload })
        });
        const data = await res.json();
        if (res.ok) {
          msgEl.className = 'small mt-1 text-success';
          msgEl.textContent = data.message || 'Uloženo.';
        } else {
          msgEl.className = 'small mt-1 text-danger';
          msgEl.textContent = data.error || 'Chyba.';
        }
      } catch {
        msgEl.className = 'small mt-1 text-danger';
        msgEl.textContent = 'Síťová chyba.';
      }
    }

    async function saveReport(id) {
      const comment = document.getElementById('adminComment_' + id).value.trim();
      // Determine current status from the badge
      const badge = document.getElementById('statusBadge_' + id);
      const status = badge && badge.classList.contains('bg-danger') ? 'closed' : 'open';
      await patchReport(id, { status, adminComment: comment });
      // Update displayed comment
      const displayEl = document.getElementById('adminCommentDisplay_' + id);
      if (comment) {
        displayEl.className = 'alert alert-secondary py-1 px-2 mt-2 mb-0 small';
        displayEl.innerHTML = '<strong>Komentář admina:</strong> ' + escHtml(comment);
      } else {
        displayEl.className = 'd-none';
        displayEl.innerHTML = '';
      }
    }

    async function toggleStatus(id, newStatus) {
      const comment = document.getElementById('adminComment_' + id).value.trim();
      await patchReport(id, { status: newStatus, adminComment: comment });
      // Update badge
      const badge = document.getElementById('statusBadge_' + id);
      const btn = document.getElementById('toggleBtn_' + id);
      if (newStatus === 'closed') {
        badge.className = 'badge bg-danger ms-2';
        badge.textContent = '● Uzavřeno';
        btn.className = 'btn btn-sm btn-outline-success';
        btn.textContent = 'Znovu otevřít';
        btn.setAttribute('onclick', 'toggleStatus(' + id + ", 'open')");
      } else {
        badge.className = 'badge bg-success ms-2';
        badge.textContent = '● Otevřeno';
        btn.className = 'btn btn-sm btn-outline-danger';
        btn.textContent = 'Uzavřít';
        btn.setAttribute('onclick', 'toggleStatus(' + id + ", 'closed')");
      }
    }
  </script>
</body>
</html>`;
}
