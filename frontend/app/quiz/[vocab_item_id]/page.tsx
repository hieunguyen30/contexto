'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { generateQuiz, getPronunciation, submitReview, type QuizData } from '@/lib/api';
import { useAppData } from '@/components/AppData';
import { BackLink, ErrorNote, LoadingCard, ProgressBar, errorMessage } from '@/components/ui';
import { CheckIcon, FlameIcon, PlayIcon, XIcon } from '@/components/icons';

type Stage = 'fill' | 'mc' | 'translate' | 'rate' | 'done';
const STAGES: Stage[] = ['fill', 'mc', 'translate', 'rate'];
const STAGE_TITLE: Record<Stage, string> = {
  fill: 'Fill in the blank',
  mc: 'Multiple choice',
  translate: 'Translate',
  rate: 'How well did you know it?',
  done: 'Saved',
};

const QUALITY_OPTIONS = [
  { value: 0, label: 'Again', hint: 'Blackout', cls: 'hover:border-danger hover:bg-danger/10' },
  { value: 3, label: 'Hard', hint: 'Recalled with difficulty', cls: 'hover:border-flame hover:bg-flame/10' },
  { value: 4, label: 'Good', hint: 'Recalled correctly', cls: 'hover:border-primary hover:bg-primary/10' },
  { value: 5, label: 'Easy', hint: 'Perfect', cls: 'hover:border-mint hover:bg-mint/10' },
];

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export default function QuizPage() {
  const { vocab_item_id } = useParams<{ vocab_item_id: string }>();
  const { due, stats, refresh } = useAppData();
  const startedAt = useRef(Date.now());
  const [word, setWord] = useState('');
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speakError, setSpeakError] = useState<string | null>(null);

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
      } catch (e) {
        setError(errorMessage(e, 'Could not load quiz'));
      } finally {
        setLoading(false);
      }
    })();
  }, [vocab_item_id]);

  const speak = async () => {
    if (!vocab_item_id) return;
    setSpeakError(null);
    try {
      const url = URL.createObjectURL(await getPronunciation(vocab_item_id));
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      setSpeakError('Pronunciation is not available for this word.');
    }
  };

  const rate = async (quality: number) => {
    if (!vocab_item_id) return;
    setSubmitting(true);
    try {
      const res = await submitReview(vocab_item_id, quality, Date.now() - startedAt.current);
      setNextReview(res.next_review_date);
      setStage('done');
      void refresh(); // streak, daily goal and due list update right away
    } catch (e) {
      setError(errorMessage(e, 'Review failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <BackLink href="/dashboard">Feed</BackLink>
        <LoadingCard />
        <p className="mt-3 text-center text-sm text-muted">Writing your quiz…</p>
      </>
    );
  }
  if (error) return <><BackLink href="/dashboard">Feed</BackLink><ErrorNote>{error}</ErrorNote></>;
  if (!quiz) return null;

  const stageIndex = STAGES.indexOf(stage === 'done' ? 'rate' : stage);
  const nextDue = due.find((d) => d._id !== vocab_item_id);
  const goal = stats?.daily_goal ?? 10;
  const doneToday = stats?.reviewed_today ?? 0;

  return (
    <>
      <BackLink href="/dashboard">Feed</BackLink>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary">Quiz</div>
          <h1 className="mt-1 flex items-center gap-3 font-serif text-4xl font-bold tracking-tight">
            {word}
            <button type="button" onClick={() => void speak()} aria-label="Play pronunciation" className="btn btn-soft !rounded-full !px-3 !py-1.5 !font-sans !text-xs">
              <PlayIcon width={12} height={12} /> Listen
            </button>
          </h1>
          {speakError && <p className="mt-1 text-xs text-muted">{speakError}</p>}
        </div>
      </div>

      <div className="mb-5 flex gap-2" aria-label={`Step ${Math.min(stageIndex + 1, 4)} of 4`}>
        {STAGES.map((s, i) => (
          <div key={s} className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
            <div
              className={`h-full rounded-full bg-primary transition-all duration-500 ${
                stage === 'done' || i < stageIndex ? 'w-full' : i === stageIndex ? 'w-1/2' : 'w-0'
              }`}
            />
          </div>
        ))}
      </div>

      <section key={stage} className="card animate-pop-in p-6 sm:p-8">
        <div className="text-sm font-bold text-muted">{STAGE_TITLE[stage]}</div>

        {stage === 'fill' && (
          <div>
            <p className="mt-3 font-serif text-2xl leading-relaxed">{quiz.fill_in_blank.sentence}</p>
            <input
              type="text"
              value={fillAnswer}
              onChange={(e) => setFillAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && fillResult === null && fillAnswer.trim())
                  setFillResult(normalize(fillAnswer) === normalize(quiz.fill_in_blank.answer));
              }}
              placeholder="Type the missing word"
              className="input mt-5 font-serif text-lg"
              disabled={fillResult !== null}
              autoFocus
            />
            {fillResult !== null && (
              <p className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold animate-pop-in ${fillResult ? 'bg-mint/15 text-mint-ink' : 'bg-danger/10 text-danger'}`}>
                {fillResult ? <CheckIcon width={18} height={18} /> : <XIcon width={18} height={18} />}
                {fillResult ? 'Correct!' : <>Answer: <span className="font-serif text-base">{quiz.fill_in_blank.answer}</span></>}
              </p>
            )}
            <div className="mt-6 flex justify-end">
              {fillResult === null ? (
                <button type="button" disabled={!fillAnswer.trim()} onClick={() => setFillResult(normalize(fillAnswer) === normalize(quiz.fill_in_blank.answer))} className="btn btn-primary">
                  Check
                </button>
              ) : (
                <button type="button" onClick={() => setStage('mc')} className="btn btn-primary">
                  Next →
                </button>
              )}
            </div>
          </div>
        )}

        {stage === 'mc' && (
          <div>
            <p className="mt-3 font-serif text-2xl leading-relaxed">{quiz.multiple_choice.question}</p>
            <ul className="mt-5 space-y-2.5">
              {quiz.multiple_choice.options.map((opt, i) => {
                const chosen = mcChoice === i;
                const isCorrect = i === quiz.multiple_choice.answer_index;
                const revealed = mcChoice !== null;
                let cls = 'border-line hover:border-primary/50 hover:bg-raised';
                if (revealed && isCorrect) cls = 'border-mint bg-mint/10';
                else if (revealed && chosen) cls = 'border-danger bg-danger/10';
                else if (revealed) cls = 'border-line opacity-60';
                return (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={revealed}
                      onClick={() => setMcChoice(i)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition active:scale-[.99] ${cls}`}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-raised text-xs font-bold">{'ABCD'[i]}</span>
                      <span className="font-serif text-lg">{opt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex justify-end">
              <button type="button" disabled={mcChoice === null} onClick={() => setStage('translate')} className="btn btn-primary">
                Next →
              </button>
            </div>
          </div>
        )}

        {stage === 'translate' && (
          <div>
            <p className="mt-3 font-serif text-2xl leading-relaxed">{quiz.translation.prompt}</p>
            <textarea
              value={translateAnswer}
              onChange={(e) => setTranslateAnswer(e.target.value)}
              rows={3}
              placeholder="Your translation"
              className="input mt-5 resize-none font-serif text-lg"
              disabled={translateRevealed}
            />
            {translateRevealed && (
              <div className="mt-4 animate-pop-in rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-widest text-primary">Reference</div>
                <p className="mt-1 font-serif text-lg">{quiz.translation.answer}</p>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              {!translateRevealed ? (
                <button type="button" onClick={() => setTranslateRevealed(true)} className="btn btn-primary">Reveal</button>
              ) : (
                <button type="button" onClick={() => setStage('rate')} className="btn btn-primary">Next →</button>
              )}
            </div>
          </div>
        )}

        {stage === 'rate' && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUALITY_OPTIONS.map((q) => (
              <button
                key={q.value}
                type="button"
                disabled={submitting}
                onClick={() => rate(q.value)}
                className={`rounded-xl border-2 border-line px-3 py-4 text-left transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 ${q.cls}`}
              >
                <div className="font-bold">{q.label}</div>
                <div className="mt-0.5 text-xs text-muted">{q.hint}</div>
              </button>
            ))}
          </div>
        )}

        {stage === 'done' && nextReview && (
          <div>
            <p className="mt-3 text-xl">
              Next review on{' '}
              <span className="font-extrabold text-primary">
                {new Date(nextReview).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </p>

            <div className="mt-5 rounded-xl bg-raised p-4">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <FlameIcon width={16} height={16} className="text-flame" /> Daily goal
                </span>
                <span className={doneToday >= goal ? 'text-mint-ink' : 'text-muted'}>
                  {Math.min(doneToday, goal)}/{goal}
                </span>
              </div>
              <ProgressBar value={doneToday} max={goal} tone={doneToday >= goal ? 'mint' : 'primary'} label="Daily goal" />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {nextDue && (
                <Link href={`/quiz/${nextDue._id}`} className="btn btn-primary">
                  Next word: <span className="font-serif">{nextDue.word}</span> →
                </Link>
              )}
              <Link href="/dashboard" className="btn btn-ghost">Back to feed</Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
