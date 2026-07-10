import crypto from 'crypto';
import fs from 'fs';
import { createRequire } from 'module';
import db from '../config/database.js';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; magA += a[i]*a[i]; magB += b[i]*b[i]; }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

export function chunkText(text, size = 800) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(' '));
  }
  return chunks;
}

export async function generateEmbedding(text, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text }] } })
    }
  );
  if (!response.ok) throw new Error(`Embedding API error: ${response.status}`);
  const data = await response.json();
  return data.embedding.values;
}

export function recordStudySession(subjectId, { cards = 0, quizzes = 0, minutes = 0 } = {}) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = db.prepare('SELECT * FROM study_sessions WHERE subjectId = ? AND date = ?').get(subjectId, today);
    if (existing) {
      db.prepare('UPDATE study_sessions SET cardsReviewed = cardsReviewed + ?, quizzesTaken = quizzesTaken + ?, durationMinutes = durationMinutes + ? WHERE id = ?')
        .run(cards, quizzes, minutes, existing.id);
    } else {
      db.prepare('INSERT INTO study_sessions (id, subjectId, date, durationMinutes, cardsReviewed, quizzesTaken, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), subjectId, today, minutes, cards, quizzes, Date.now());
    }
  } catch(e) { /* non-blocking */ }
}

export async function extractTextFromFile(filePath, mimetype) {
  if (mimetype === 'application/pdf') {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const uint8 = new Uint8Array(dataBuffer);
      const parser = new pdf.PDFParse({ data: uint8 });
      await parser.load();
      const result = await parser.getText();
      return (result && result.text) ? result.text : '';
    } catch (err) {
      console.error('PDF parsing error:', err);
      throw new Error('Failed to parse PDF. Ensure it contains text.');
    }
  } else {
    // UTF-8 fallback for txt, md, etc.
    return fs.readFileSync(filePath, 'utf-8');
  }
}

export function getNextDate(baseDateStr, unit, interval) {
  let date = baseDateStr ? new Date(baseDateStr) : new Date();
  if (isNaN(date.getTime())) date = new Date();
  if (unit === 'day') date.setDate(date.getDate() + interval);
  else if (unit === 'week') date.setDate(date.getDate() + interval * 7);
  else if (unit === 'month') date.setMonth(date.getMonth() + interval);
  else if (unit === 'year') date.setFullYear(date.getFullYear() + interval);
  return date.toISOString().split('T')[0];
}
