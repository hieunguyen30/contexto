const MIN_EASE_FACTOR = 1.3;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function updateSM2(vocabItem, quality) {
  if (!Number.isFinite(quality) || quality < 0 || quality > 5) {
    throw new Error('quality must be a number between 0 and 5');
  }

  let { ease_factor, interval, repetitions } = vocabItem;
  ease_factor = typeof ease_factor === 'number' ? ease_factor : 2.5;
  interval = typeof interval === 'number' ? interval : 1;
  repetitions = typeof repetitions === 'number' ? repetitions : 0;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease_factor);
    }
    repetitions += 1;
    ease_factor = ease_factor + 0.1 - (5 - quality) * 0.08;
    if (ease_factor < MIN_EASE_FACTOR) ease_factor = MIN_EASE_FACTOR;
  }

  const next_review_date = addDays(startOfToday(), interval);

  return { ease_factor, interval, repetitions, next_review_date };
}

module.exports = { updateSM2, MIN_EASE_FACTOR };
