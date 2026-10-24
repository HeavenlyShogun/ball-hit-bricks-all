import React, { useState, useEffect, useCallback } from 'react';
import { GameKey } from './types/game';
import { loadScores, saveScores, getTotalScore, ScoreData } from './utils/storage';
import { Sound } from './utils/sound';
import { Navbar } from './components/Navbar';
import { LobbyView } from './components/LobbyView';
import { ArcadeCabinet } from './components/ArcadeCabinet';
import { MechanicsMatrixModal } from './components/MechanicsMatrixModal';

export default function App() {
  const [activeGame, setActiveGame] = useState<GameKey | null>(null);
  const [scores, setScores] = useState<ScoreData>(loadScores());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(Sound.enabled);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const refreshScores = useCallback(() => {
    setScores(loadScores());
  }, []);

  // Listen to hash for direct linking
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash.replace('#', '').toUpperCase() as GameKey;
      if (['BBTAN', 'CCTAN', 'DDTAN', 'EETAN', 'FFTAN', 'GGTAN'].includes(hash)) {
        setActiveGame(hash);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleSelectGame = (key: GameKey) => {
    Sound.init();
    setActiveGame(key);
    window.location.hash = key;
    refreshScores();
  };

  const handleGoHome = () => {
    setActiveGame(null);
    window.location.hash = '';
    refreshScores();
  };

  const handleToggleSound = () => {
    Sound.enabled = !Sound.enabled;
    setSoundEnabled(Sound.enabled);
  };

  const handleResetScores = () => {
    const empty: ScoreData = {
      BBTAN: 0,
      CCTAN: 0,
      DDTAN: 0,
      EETAN: 0,
      FFTAN: 0,
      GGTAN: 0,
    };
    saveScores(empty);
    setScores(empty);
    Sound.powerup();
  };

  const totalScore = getTotalScore(scores);

  return (
    <div className="min-h-screen flex flex-col bg-[#070913] text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Universal Navbar */}
      <Navbar
        activeGame={activeGame}
        onSelectGame={handleSelectGame}
        onGoHome={handleGoHome}
        onOpenModal={() => setIsModalOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        totalScore={totalScore}
      />

      {/* Main Page Area */}
      <main className="flex-1 w-full px-3 sm:px-6 py-4 flex flex-col">
        {activeGame ? (
          <ArcadeCabinet
            key={activeGame}
            gameKey={activeGame}
            onSelectGame={handleSelectGame}
            onGoHome={handleGoHome}
            onOpenMechanicsModal={() => setIsModalOpen(true)}
          />
        ) : (
          <LobbyView
            scores={scores}
            totalScore={totalScore}
            onSelectGame={handleSelectGame}
            onResetScores={handleResetScores}
            onOpenModal={() => setIsModalOpen(true)}
          />
        )}
      </main>

      {/* Mechanics Comparison Matrix Modal */}
      <MechanicsMatrixModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectGame={handleSelectGame}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#060812] py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>111% TAN 系列經典玩法復刻與物理特性拆解 (6-in-1 Arcade Hub)</span>
          <span className="mono text-[11px] text-slate-400">
            60Hz 固定步長 Canvas 物理引擎 · Web Audio 合成音效
          </span>
        </div>
      </footer>
    </div>
  );
}
