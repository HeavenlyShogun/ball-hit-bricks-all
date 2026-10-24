import { GameKey } from '../types/game';

const STORAGE_KEY = 'tan_series_scores_v2';

export interface ScoreData {
  BBTAN: number;
  CCTAN: number;
  DDTAN: number;
  EETAN: number;
  FFTAN: number;
  GGTAN: number;
}

const DEFAULT_SCORES: ScoreData = {
  BBTAN: 0,
  CCTAN: 0,
  DDTAN: 0,
  EETAN: 0,
  FFTAN: 0,
  GGTAN: 0,
};

export function loadScores(): ScoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SCORES,
        ...parsed,
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SCORES };
}

export function saveScores(scores: ScoreData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // ignore
  }
}

export function updateBestScore(game: GameKey, newScore: number): { updated: boolean; currentBest: number } {
  const current = loadScores();
  const val = Math.floor(newScore);
  if (val > (current[game] || 0)) {
    current[game] = val;
    saveScores(current);
    return { updated: true, currentBest: val };
  }
  return { updated: false, currentBest: current[game] || 0 };
}

export function getTotalScore(scores: ScoreData): number {
  return Object.values(scores).reduce((a, b) => a + b, 0);
}
