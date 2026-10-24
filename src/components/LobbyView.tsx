import React, { useState, useEffect } from 'react';
import { GameKey, GAMES_CATALOG } from '../types/game';
import { ScoreData } from '../utils/storage';
import { Sound } from '../utils/sound';
import { Trophy, Dices, ArrowRight, RefreshCw, Table2 } from 'lucide-react';

interface LobbyViewProps {
  scores: ScoreData;
  totalScore: number;
  onSelectGame: (key: GameKey) => void;
  onResetScores: () => void;
  onOpenModal: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  scores,
  totalScore,
  onSelectGame,
  onResetScores,
  onOpenModal,
}) => {
  const gamesList: GameKey[] = ['BBTAN', 'CCTAN', 'DDTAN', 'EETAN', 'FFTAN', 'GGTAN'];
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    if (!confirmingReset) return;
    const timer = setTimeout(() => {
      setConfirmingReset(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [confirmingReset]);

  const handleRandomPlay = () => {
    Sound.powerup();
    const randomKey = gamesList[Math.floor(Math.random() * gamesList.length)];
    onSelectGame(randomKey);
  };

  const handleResetClick = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setConfirmingReset(false);
    onResetScores();
  };

  return (
    <section className="space-y-6 max-w-6xl w-full mx-auto py-2">
      {/* HERO BANNER */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#111936] via-[#1a1438] to-[#12233b] border border-slate-800 p-5 sm:p-7 overflow-hidden neon-glow-cyan">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5 max-w-2xl">
            <div className="text-xs font-bold tracking-wider uppercase text-cyan-300 mono">
              111% ARCADE ARCHIVE · 6-IN-1 PHYSICS COLLECTION
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
              111% TAN 街機宇宙 — 體驗 6 種截然不同的物理彈射手感
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              從無重力純幾何反射的 <span className="text-cyan-300 font-bold">BBTAN</span>、360°
              放射生存的 <span className="text-rose-300 font-bold">CCTAN</span>、拋物線重力彈跳的{' '}
              <span className="text-amber-300 font-bold">DDTAN</span>、跑酷連射的{' '}
              <span className="text-emerald-300 font-bold">EETAN</span>、經典動量反彈板的{' '}
              <span className="text-purple-300 font-bold">FFTAN</span> 到旋轉幾何缺口節奏的{' '}
              <span className="text-pink-300 font-bold">GGTAN</span>
              。每款皆實作獨立的 60Hz 固定步長物理引擎與合成音效。
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                onClick={handleRandomPlay}
                className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all"
              >
                <Dices className="w-4 h-4" />
                <span>隨機挑選一款遊玩</span>
              </button>

              <button
                onClick={onOpenModal}
                className="px-4 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Table2 className="w-4 h-4 text-fuchsia-400" />
                <span>查看 6 大核心機制對照表</span>
              </button>
            </div>
          </div>

          {/* Leaderboard stats box */}
          <div className="flex flex-row md:flex-col items-center md:items-stretch justify-between gap-3 shrink-0 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl">
            <div className="text-left">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>6 款遊戲最高紀錄總和</span>
              </div>
              <div className="text-3xl font-black mono text-cyan-400 mt-0.5">
                {totalScore.toLocaleString()}
              </div>
            </div>

            <div className="md:border-t md:border-slate-800/80 md:pt-2.5 flex items-center justify-between gap-3">
              <button
                onClick={handleResetClick}
                className={`text-[11px] px-3 py-1.5 rounded-lg border transition flex items-center gap-1 font-semibold ${
                  confirmingReset
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400'
                    : 'bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-400 border-slate-700'
                }`}
                title="清空本地所有最高分紀錄"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{confirmingReset ? '確定清空？(點擊確認)' : '重置紀錄'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6 GAME CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {gamesList.map(key => {
          const meta = GAMES_CATALOG[key];
          const best = scores[key] || 0;

          return (
            <article
              key={key}
              className={`rounded-2xl bg-[#101628] border ${meta.themeClasses.border} p-5 flex flex-col justify-between relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl`}
            >
              <div className="space-y-3">
                {/* Clean unboxed kicker metadata line */}
                <div className="flex items-center justify-between text-xs mono">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-black ${meta.themeClasses.text}`}>{meta.number}</span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-300 font-bold">{meta.modeTag}</span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span>BEST</span>
                    <strong className={meta.themeClasses.text}>{best}</strong>
                  </div>
                </div>

                {/* Title & Tagline */}
                <div>
                  <h2 className="text-lg font-black text-white">{meta.fullTitle}</h2>
                  <p className={`text-xs font-semibold mt-0.5 ${meta.themeClasses.text}`}>
                    {meta.tagline}
                  </p>
                </div>

                {/* Breakdown details */}
                <ul className="text-xs text-slate-300 space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <li>
                    <strong className="text-slate-100">🎮 操作：</strong>
                    <span>{meta.controls}</span>
                  </li>
                  <li>
                    <strong className="text-slate-100">⚙️ 機制：</strong>
                    <span>{meta.mechanics}</span>
                  </li>
                  <li>
                    <strong className="text-slate-100">📐 物理：</strong>
                    <span>{meta.physics}</span>
                  </li>
                </ul>
              </div>

              {/* Card Footer / Action */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 mono">{meta.gravityText}</span>

                <button
                  type="button"
                  onClick={() => {
                    Sound.init();
                    onSelectGame(key);
                  }}
                  className={`px-4 py-2 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center gap-1 ${meta.themeClasses.btn}`}
                >
                  <span>立即遊玩</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
