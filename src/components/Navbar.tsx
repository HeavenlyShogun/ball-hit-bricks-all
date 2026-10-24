import React from 'react';
import { GameKey, GAMES_CATALOG } from '../types/game';
import { Sound } from '../utils/sound';
import { Volume2, VolumeX, Table2, Home } from 'lucide-react';

interface NavbarProps {
  activeGame: GameKey | null;
  onSelectGame: (key: GameKey) => void;
  onGoHome: () => void;
  onOpenModal: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  totalScore: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeGame,
  onSelectGame,
  onGoHome,
  onOpenModal,
  soundEnabled,
  onToggleSound,
}) => {
  const gamesList: GameKey[] = ['BBTAN', 'CCTAN', 'DDTAN', 'EETAN', 'FFTAN', 'GGTAN'];

  return (
    <header className="sticky top-0 z-30 bg-[#0b0f1f]/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        {/* Brand / Logo */}
        <button
          onClick={onGoHome}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
          title="返回 111% TAN 大廳"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-amber-400 p-[2px] shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#070913] rounded-[10px] flex items-center justify-center font-black text-xs tracking-tighter mono text-white group-hover:bg-transparent group-hover:text-slate-950 transition-colors">
              111%
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-tight text-base sm:text-lg bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                TAN SERIES ARCADE
              </span>
              <span className="hidden sm:inline text-xs text-slate-500 mono">· 6-in-1 復刻合輯</span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              BBTAN · CCTAN · DDTAN · EETAN · FFTAN · GGTAN 物理機制拆解
            </p>
          </div>
        </button>

        {/* Quick Game Switcher Segmented Controls */}
        <nav
          aria-label="遊戲快速切換"
          className="flex items-center gap-1 overflow-x-auto max-w-full p-1 bg-slate-900/90 border border-slate-800 rounded-xl"
        >
          <button
            onClick={onGoHome}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              activeGame === null
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden md:inline">主大廳</span>
          </button>

          {gamesList.map(key => {
            const meta = GAMES_CATALOG[key];
            const isSelected = activeGame === key;
            return (
              <button
                key={key}
                onClick={() => {
                  Sound.init();
                  onSelectGame(key);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold mono transition whitespace-nowrap ${
                  isSelected
                    ? `${meta.themeClasses.btn} shadow-sm`
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {key}
              </button>
            );
          })}
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
            title={soundEnabled ? '音效開啟 (點擊靜音)' : '音效靜音 (點擊開啟)'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden md:inline">{soundEnabled ? '音效開啟' : '靜音中'}</span>
          </button>

          {/* Mechanics Modal Trigger */}
          <button
            onClick={onOpenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/40 text-xs font-semibold text-fuchsia-300 transition"
          >
            <Table2 className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>機制比較表</span>
          </button>
        </div>
      </div>
    </header>
  );
};
