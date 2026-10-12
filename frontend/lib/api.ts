import axios from 'axios';
import { getFirebaseAuth, firebaseConfigured } from './firebase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({ baseURL: API_URL });

// Attach the Firebase ID token (refreshed automatically by the SDK when it nears expiry).
api.interceptors.request.use(async (config) => {
  if (!firebaseConfigured) return config;
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type SourceType = 'youtube' | 'pdf' | 'article';

export type IngestStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface ContentItem {
  status?: IngestStatus;
  error?: string | null;
  chunk_count?: number;
  _id: string;
  title: string;
  source_url?: string;
  source_type: SourceType;
  language: string;
  created_at: string;
}

export interface VocabItem {
  _id: string;
  user_id: string;
  content_id: string;
  word: string;
  definition: string;
  example_sentence?: string;
  translation?: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string;
  created_at: string;
}

export interface QuizData {
  fill_in_blank: { sentence: string; answer: string };
  multiple_choice: { question: string; options: string[]; answer_index: number };
  translation: { prompt: string; answer: string };
}

export async function getLibrary(): Promise<ContentItem[]> {
  const { data } = await api.get('/api/content/library');
  return data.items;
}

export async function getContent(id: string): Promise<ContentItem> {
  const { data } = await api.get(`/api/content/${id}`);
  return data;
}

export async function ingestContent(input: {
  url: string;
  source_type: SourceType;
  target_language: string;
}): Promise<{ content_id: string; status: IngestStatus }> {
  const { data } = await api.post('/api/content/ingest', input);
  return data;
}

export interface IngestStatusResponse {
  content_id: string;
  status: IngestStatus;
  error: string | null;
  chunk_count: number;
  title: string;
}

export async function getContentStatus(id: string): Promise<IngestStatusResponse> {
  const { data } = await api.get(`/api/content/${id}/status`);
  return data;
}

export async function getVocabForContent(content_id: string): Promise<VocabItem[]> {
  const { data } = await api.get('/api/vocab', { params: { content_id } });
  return data.items;
}

export async function getDueVocab(): Promise<VocabItem[]> {
  const { data } = await api.get('/api/vocab/due');
  return data.items;
}

export async function extractVocab(
  content_id: string,
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
): Promise<{ vocab: VocabItem[] }> {
  const { data } = await api.post('/api/vocab/extract', { content_id, difficulty_level });
  return data;
}

export async function generateQuiz(
  vocab_item_id: string
): Promise<{ vocab_item_id: string; word: string; quiz: QuizData }> {
  const { data } = await api.post('/api/vocab/quiz/generate', { vocab_item_id });
  return data;
}

export async function submitReview(
  vocab_item_id: string,
  quality: number,
  response_time_ms?: number
): Promise<{ vocab_item: VocabItem; next_review_date: string }> {
  const { data } = await api.post('/api/vocab/review', { vocab_item_id, quality, response_time_ms });
  return data;
}

// Fetches pronunciation audio (needs the auth header, so it can't be a plain <audio src>).
export async function getPronunciation(vocab_item_id: string): Promise<Blob> {
  const { data } = await api.get(`/api/vocab/${vocab_item_id}/pronunciation`, { responseType: 'blob' });
  return data;
}

export async function chat(
  content_id: string,
  message: string,
  target_language: string
): Promise<{ answer: string }> {
  const { data } = await api.post('/api/chat', { content_id, message, target_language });
  return data;
}
