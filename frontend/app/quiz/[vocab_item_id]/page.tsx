'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { generateQuiz, getPronunciation, submitReview, type QuizData } from '@/lib/api';

type Stage = 'fill' | 'mc' | 'translate' | 'rate' | 'done';

const QUALITY_OPTIONS = [
  { value: 0, label: 'Again', hint: 'Blackout' },
  { value: 3, label: 'Hard', hint: 'Recalled with difficulty' },
  { value: 4, label: 'Good', hint: 'Recalled correctly' },
  { value: 5, label: 'Easy', hint: 'Perfect' },
];

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export default function QuizPage() {
  const { vocab_item_id } = useParams<{ vocab_item_id: string }>();
  const startedAt = useRef(Date.now());
  const [word, setWord] = useState('');
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>('fill');
  const [fillAnswer, setFillAnswer] = useState('');
  const [fillResult, setFillResult] = useState<boolean | null>(null);
  const [mcChoice, setMcChoice] = useState<number | null>(null);
  const [translateAnswer, setTranslateAnswer] = useState('');
  const [translateRevealed, setTranslateRevealed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [nextReview, setNextReview] = useState<string | null>(null);

  useEffect(() => {
    if (!vocab_item_id) return;
    (async () => {
      try {
        const res = await generateQuiz(vocab_item_id);
        setQuiz(res.quiz);
        startedAt.current = Date.now(); // response time excludes quiz generation
        setWord(res.word);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setError(err.response?.data?.error || err.message || 'Could not load quiz');
      } finally {
        setLoading(false);
      }
    })();
  }, [vocab_item_id]);

  const speak = async () => {
    if (!vocab_item_id) return;
    try {
      const url = URL.createObjectURL(await getPronunciation(vocab_item_id));
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      setError('Pronunciation is not available for this word.');
    }
  };

  const rate = async (quality: number) => {
    if (!vocab_item_id) return;
    setSubmitting(true);
    try {
      const res = await submitReview(vocab_item_id, quality, Date.now() - startedAt.current);
      setNextReview(res.next_review_date);
      setStage('done');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Review failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="mx-auto max-w-2xl px-6 py-8 text-sm text-slate-500">Loading…</main>;
  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-8">
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      </main>
    );
  }
  if (!quiz) return null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="text-xs uppercase tracking-wide text-slate-400">Quiz</div>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        {word}
        <button
          type="button"
          onClick={() => void speak()}
          aria-label="Play pronunciation"
          className="rounded border border-slate-300 px-2 py-0.5 text-xs font-normal hover:border-slate-500"
        >
          ▶ Listen
        </button>
      </h1>

      <div className="mt-2 flex gap-1.5">
        {(['fill', 'mc', 'translate', 'rate'] as const).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded ${
              ['fill', 'mc', 'translate', 'rate', 'done'].indexOf(stage) >= i
                ? 'bg-slate-900'
                : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      <section className="mt-6 rounded border border-slate-200 bg-white p-6">
        {stage === 'fill' && (
          <div>
            <div className="text-sm font-medium text-slate-500">Fill in the blank</div>
            <p className="mt-2 text-lg">{quiz.fill_in_blank.sentence}</p>
            <input
              type="text"
              value={fillAnswer}
              onChange={(e) => setFillAnswer(e.target.value)}
              placeholder="your answer"
              className="mt-4 w-full rounded border border-slate-300 px-3 py-2"
              disabled={fillResult !== null}
            />
            {fillResult !== null && (
              <p className={`mt-3 text-sm ${fillResult ? 'text-green-700' : 'text-red-700'}`}>
                {fillResult ? 'Correct.' : `Answer: ${quiz.fill_in_blank.answer}`}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {fillResult === null ? (
                <button
                  type="button"
                  onClick={() =>
                    setFillResult(normalize(fillAnswer) === normalize(quiz.fill_in_blank.answer))
                  }
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  Check
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStage('mc')}
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        )}

        {stage === 'mc' && (
          <div>
            <div className="text-sm font-medium text-slate-500">Multiple choice</div>
            <p className="mt-2 text-lg">{quiz.multiple_choice.question}</p>
            <ul className="mt-4 space-y-2">
              {quiz.multiple_choice.options.map((opt, i) => {
                const chosen = mcChoice === i;
                const isCorrect = i === quiz.multiple_choice.answer_index;
                const revealed = mcChoice !== null;
                let cls = 'border-slate-300';
                if (revealed && isCorrect) cls = 'border-green-500 bg-green-50';
                else if (revealed && chosen && !isCorrect) cls = 'border-red-500 bg-red-50';
                return (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={revealed}
                      onClick={() => setMcChoice(i)}
                      className={`w-full rounded border px-3 py-2 text-left text-sm ${cls}`}
                    >
                      {opt}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={mcChoice === null}
                onClick={() => setStage('translate')}
                className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {stage === 'translate' && (
          <div>
            <div className="text-sm font-medium text-slate-500">Translate</div>
            <p className="mt-2 text-lg">{quiz.translation.prompt}</p>
            <textarea
              value={translateAnswer}
              onChange={(e) => setTranslateAnswer(e.target.value)}
              rows={3}
              placeholder="your translation"
              className="mt-4 w-full rounded border border-slate-300 px-3 py-2"
              disabled={translateRevealed}
            />
            {translateRevealed && (
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-medium">Reference: </span>
                {quiz.translation.answer}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {!translateRevealed ? (
                <button
                  type="button"
                  onClick={() => setTranslateRevealed(true)}
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  Reveal
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStage('rate')}
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        )}

        {stage === 'rate' && (
          <div>
            <div className="text-sm font-medium text-slate-500">How well did you know this word?</div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  disabled={submitting}
                  onClick={() => rate(q.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-left text-sm hover:border-slate-500 disabled:opacity-50"
                >
                  <div className="font-medium">{q.label}</div>
                  <div className="text-xs text-slate-500">{q.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === 'done' && nextReview && (
          <div>
            <div className="text-sm font-medium text-slate-500">Saved</div>
            <p className="mt-2 text-lg">
              Next review on{' '}
              <span className="font-semibold">
                {new Date(nextReview).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              .
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/dashboard"
                className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
