import { Router, Request, Response } from 'express';
import config from './config';
import { saveVote, getResults, getAllResults, resetVotes, getLastResetTime, saveReport, getReports, updateReport } from './db';
import { renderPage, renderAboutPage, renderSettingsPage } from './views';
import logger from './logger';

const router = Router();

router.get('/about', (_req: Request, res: Response) => {
  res.send(renderAboutPage());
});

router.get('/settings', (_req: Request, res: Response) => {
  res.send(renderSettingsPage());
});

// GET / – hlavní stránka s anketami (hlasovací formuláře)
router.get('/', (req: Request, res: Response) => {
  const allResults = getAllResults();
  const resetTime = getLastResetTime();

  const votedPollIds = config.polls
    .map((p) => p.id)
    .filter((id) => {
      const cookieVal = req.cookies[`voted_poll_${id}`];
      // Cookie is valid if it exists AND its value (timestamp) is greater than last reset time
      return cookieVal && parseInt(cookieVal, 10) > resetTime;
    });

  const html = renderPage(config.polls, allResults, false, votedPollIds);
  res.send(html);
});

// GET /results – pouze zobrazení výsledků bez formulářů
router.get('/results', (_req: Request, res: Response) => {
  const allResults = getAllResults();
  const html = renderPage(config.polls, allResults, true);
  res.send(html);
});

// Cookie expiruje za 365 dní (v sekundách)
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

// POST /vote – uložení hlasu, vrátí aktualizované výsledky dané ankety
router.post('/vote', (req: Request, res: Response): void => {
  const { pollId, option } = req.body as { pollId: unknown; option: unknown };

  const id = parseInt(String(pollId), 10);
  if (![1, 2].includes(id)) {
    res.status(400).json({ error: 'Neplatné poll_id. Povolené hodnoty: 1, 2.' });
    return;
  }

  if (option !== 'a' && option !== 'b' && option !== 'c') {
    res.status(400).json({ error: 'Neplatná možnost. Povolené hodnoty: a, b, c.' });
    return;
  }

  // Kontrola cookie – zabrání hlasovat více než jednou za anketu
  const cookieName = `voted_poll_${id}`;
  const resetTime = getLastResetTime();

  if (req.cookies[cookieName]) {
    const cookieTimestamp = parseInt(req.cookies[cookieName], 10);
    // If cookie is newer than reset, block vote
    if (cookieTimestamp > resetTime) {
      const results = getResults(id);
      res.status(403).json({ error: 'Již jste v této anketě hlasoval/a.', alreadyVoted: true, ...results });
      return;
    }
    // If cookie is old (pre-reset), we allow voting and will overwrite it below
  }

  const ip = req.ip ?? 'unknown';
  saveVote(id, option);
  logger.info(`Hlas uložen – anketa: ${id}, možnost: ${option}, ip: ${ip}`);

  // Nastav cookie, platí 365 dní, httpOnly zabrání čtení z JS
  res.cookie(cookieName, Date.now().toString(), {
    maxAge: COOKIE_MAX_AGE * 1000,
    httpOnly: true,
    sameSite: 'lax',
  });

  const results = getResults(id);
  res.json(results);
});

// POST /reset – reset hlasů (vyžaduje token)
router.post('/reset', (req: Request, res: Response): void => {
  const { token } = req.body as { token: unknown };
  const ip = req.ip ?? 'unknown';

  if (!token || token !== config.resetToken) {
    logger.warn(`Neúspěšný pokus o reset hlasů – ip: ${ip}`);
    res.status(403).json({ error: 'Nesprávný token. Reset nebyl proveden.' });
    return;
  }

  resetVotes();
  logger.info(`Hlasy byly resetovány – ip: ${ip}`);
  res.json({ message: 'Všechny hlasy byly úspěšně vynulovány.' });
});

// POST /report – uložení hlášení chyby / zpětné vazby
router.post('/report', (req: Request, res: Response): void => {
  const { author, message } = req.body as { author: unknown; message: unknown };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Zpráva nesmí být prázdná.' });
    return;
  }

  if (message.trim().length > 2000) {
    res.status(400).json({ error: 'Zpráva je příliš dlouhá (max 2000 znaků).' });
    return;
  }

  const authorStr = typeof author === 'string' ? author.trim().slice(0, 100) : '';
  const ip = req.ip ?? 'unknown';
  saveReport(authorStr, message.trim(), ip);
  logger.info(`Hlášení uloženo – autor: ${authorStr || 'anonymní'}, ip: ${ip}`);
  res.json({ message: 'Hlášení bylo úspěšně odesláno. Děkujeme!' });
});

// GET /reports – seznam hlášení (pro sekci nastavení)
router.get('/reports', (req: Request, res: Response): void => {
  const { token } = req.query;
  if (!token || token !== config.resetToken) {
    res.status(403).json({ error: 'Přístup odepřen.' });
    return;
  }
  res.json(getReports());
});

// PATCH /reports/:id – update stavu a komentáře hlášení (admin)
router.patch('/reports/:id', (req: Request, res: Response): void => {
  const { token, status, adminComment } = req.body as { token: unknown; status: unknown; adminComment: unknown };

  if (!token || token !== config.resetToken) {
    res.status(403).json({ error: 'Přístup odepřen.' });
    return;
  }

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Neplatné ID hlášení.' });
    return;
  }

  if (status !== 'open' && status !== 'closed') {
    res.status(400).json({ error: 'Neplatný stav. Povolené hodnoty: open, closed.' });
    return;
  }

  const comment = typeof adminComment === 'string' ? adminComment.trim().slice(0, 1000) : '';
  updateReport(id, status, comment);
  const ip = req.ip ?? 'unknown';
  logger.info(`Hlášení #${id} aktualizováno – stav: ${status}, ip: ${ip}`);
  res.json({ message: 'Hlášení bylo aktualizováno.' });
});

export default router;
