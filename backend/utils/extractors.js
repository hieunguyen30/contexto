const axios = require('axios');
const cheerio = require('cheerio');
const { YoutubeTranscript } = require('youtube-transcript');

const USER_AGENT =
  'Mozilla/5.0 (compatible; ContextoBot/0.1; +https://example.invalid)';

async function extractArticle(url) {
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    timeout: 15000,
    maxContentLength: 10 * 1024 * 1024,
  });

  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header, aside, form, iframe, svg').remove();

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    url;

  const candidates = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
  ];

  let $container = null;
  for (const sel of candidates) {
    const $el = $(sel).first();
    if ($el.length && $el.text().trim().length > 200) {
      $container = $el;
      break;
    }
  }
  if (!$container) $container = $('body');

  const blocks = $container
    .find('p, li, h1, h2, h3, h4, blockquote, pre')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter((t) => t.length > 0);

  let text = blocks.join('\n\n');
  if (text.length < 200) {
    text = $container.text().replace(/\s+/g, ' ').trim();
  }

  return { title, text };
}

async function extractYoutube(url) {
  const segments = await YoutubeTranscript.fetchTranscript(url);
  const text = segments
    .map((s) => (s.text || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');

  let title = url;
  try {
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });
    const $ = cheerio.load(html);
    const raw =
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text();
    const cleaned = (raw || '').replace(/\s*-\s*YouTube\s*$/i, '').trim();
    if (cleaned) title = cleaned;
  } catch {
    // best-effort title; ignore
  }

  return { title, text };
}

module.exports = { extractArticle, extractYoutube };
