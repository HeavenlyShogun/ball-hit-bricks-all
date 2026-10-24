import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameKey, GAMES_CATALOG, GameEngine, GameTelemetry } from '../types/game';
import { createParticleSystem } from '../utils/graphics';
import { Sound } from '../utils/sound';
import { updateBestScore, loadScores } from '../utils/storage';
import { initBBTAN } from '../games/bbtan';
import { initCCTAN } from '../games/cctan';
import { initDDTAN } from '../games/ddtan';
import { initEETAN } from '../games/eetan';
import { initFFTAN } from '../games/fftan';
import { initGGTAN } from '../games/ggtan';
import {
  RotateCcw,
  Play,
  Pause,
  Zap,
  ArrowDownToLine,
  ArrowLeft,
  Trophy,
  Info,
  Activity,
  Gamepad2,
} from 'lucide-react';

interface ArcadeCabinetProps {
  gameKey: GameKey;
  onSelectGame: (key: GameKey) => void;
  onGoHome: () => void;
  onOpenMechanicsModal: () => void;
}

const LOGICAL_W = 420;
const LOGICAL_H = 560;
const FIXED_DT = 1000 / 60;

export const ArcadeCabinet: React.FC<ArcadeCabinetProps> = ({
  gameKey,
  onSelectGame,
  onGoHome,
  onOpenMechanicsModal,
}) => {
  const meta = GAMES_CATALOG[gameKey];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const fxRef = useRef<ReturnType<typeof createParticleSystem>>(createParticleSystem());
  const animFrameRef = useRef<number | null>(null);

  const isPausedRef = useRef<boolean>(false);
  const isGameOverRef = useRef<boolean>(false);
  const heldNudgeRef = useRef<-1 | 0 | 1>(0);

  const [score, setScore] = useState<number>(meta.isTurnBased ? 1 : 0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [gameOverInfo, setGameOverInfo] = useState<{
    isOver: boolean;
    score: number;
    reason: string;
    isNewBest: boolean;
  } | null>(null);
  const [telemetry, setTelemetry] = useState<Partial<GameTelemetry>>({});

  // Sync state with refs so the RAF loop always reads fresh pause/gameover flags without recreating startEngine
  const updatePauseState = useCallback((paused: boolean) => {
    isPausedRef.current = paused;
    setIsPaused(paused);
  }, []);

  // Refresh best score on mount / game change
  useEffect(() => {
    const scores = loadScores();
    setBestScore(scores[gameKey] || 0);
  }, [gameKey]);

  // Handle Game Over
  const handleGameOver = useCallback(
    (finalScore: number, reason: string) => {
      if (isGameOverRef.current) return;
      isGameOverRef.current = true;
      Sound.gameOver();
      const { updated, currentBest } = updateBestScore(gameKey, finalScore);
      setBestScore(currentBest);
      setGameOverInfo({
        isOver: true,
        score: Math.floor(finalScore),
        reason,
        isNewBest: updated,
      });
    },
    [gameKey]
  );

  // Initialize and run fixed-timestep 60Hz game loop
  const startEngine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Configure Retina high-DPI buffer while keeping logical 420x560 coordinate system
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = LOGICAL_W * dpr;
    canvas.height = LOGICAL_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    fxRef.current.clear();
    isPausedRef.current = false;
    isGameOverRef.current = false;
    heldNudgeRef.current = 0;
    setIsPaused(false);
    setGameOverInfo(null);
    const initialScore = GAMES_CATALOG[gameKey].isTurnBased ? 1 : 0;
    setScore(initialScore);

    const callbacks = {
      onScoreUpdate: (newScore: number) => {
        const floored = Math.floor(newScore);
        setScore(floored);
        const { currentBest } = updateBestScore(gameKey, floored);
        setBestScore(currentBest);
      },
      onGameOver: handleGameOver,
    };

    let engine: GameEngine;
    switch (gameKey) {
      case 'BBTAN':
        engine = initBBTAN(ctx, LOGICAL_W, LOGICAL_H, fxRef.current, callbacks);
        break;
      case 'CCTAN':
        engine = initCCTAN(ctx, LOGICAL_W, LOGICAL_H, fxRef.current, callbacks);
        break;
      case 'DDTAN':
        engine = initDDTAN(ctx, LOGICAL_W, LOGICAL_H, fxRef.current, callbacks);
        break;
      case 'EETAN':
        engine = initEETAN(ctx, LOGICAL_W, LOGICAL_H, fxRef.current, callbacks);
        break;
      case 'FFTAN':
        engine = initFFTAN(ctx, LOGICAL_W, LOGICAL_H, fxRef.current, callbacks);
        break;
      case 'GGTAN':
        engine = initGGTAN(ctx, LOGICAL_W, LOGICAL_H, fxRef.current, callbacks);
        break;
    }

    engineRef.current = engine;
    if (engine.getTelemetry) {
      setTelemetry(engine.getTelemetry());
    }

    let lastTime = performance.now();
    let accumulator = 0;
    let frameTick = 0;

    const loop = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastTime));
      lastTime = now;

      if (engineRef.current) {
        const active = !isPausedRef.current && !isGameOverRef.current;

        if (active) {
          accumulator += dt;
          let steps = 0;
          while (accumulator >= FIXED_DT && steps < 4) {
            if (heldNudgeRef.current !== 0 && engineRef.current.onNudge) {
              engineRef.current.onNudge(heldNudgeRef.current);
            }
            engineRef.current.update();
            accumulator -= FIXED_DT;
            steps++;
            if (isGameOverRef.current) break;
          }

          engineRef.current.draw();
          fxRef.current.updateAndDraw(ctx, steps > 0);

          frameTick++;
          if (frameTick % 6 === 0 && engineRef.current.getTelemetry) {
            setTelemetry(engineRef.current.getTelemetry());
          }
        } else {
          // Keep drawing current frozen state when paused or on Game Over screen
          accumulator = 0;
          engineRef.current.draw();
          fxRef.current.updateAndDraw(ctx, false);
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [gameKey, handleGameOver]);

  useEffect(() => {
    startEngine();
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [startEngine]);

  // Canvas pointer event translations (mapped to logical 420x560)
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_W,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_H,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    Sound.init();
    if (isPausedRef.current || isGameOverRef.current || !engineRef.current) return;
    const { x, y } = getCanvasCoords(e);
    if (engineRef.current.onPointerDown) engineRef.current.onPointerDown(x, y);
    if (engineRef.current.onPointerMove) engineRef.current.onPointerMove(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPausedRef.current || isGameOverRef.current || !engineRef.current) return;
    const { x, y } = getCanvasCoords(e);
    if (engineRef.current.onPointerMove) engineRef.current.onPointerMove(x, y);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPausedRef.current || isGameOverRef.current || !engineRef.current) return;
    const { x, y } = getCanvasCoords(e);
    if (engineRef.current.onPointerUp) engineRef.current.onPointerUp(x, y);
  };

  // Keyboard controls (Arrows, A/D, Space, P, R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') {
        if (!isGameOverRef.current) {
          updatePauseState(!isPausedRef.current);
        }
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        Sound.init();
        startEngine();
        return;
      }

      if (isPausedRef.current || isGameOverRef.current || !engineRef.current) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        heldNudgeRef.current = -1;
        if (engineRef.current.onNudge) engineRef.current.onNudge(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        heldNudgeRef.current = 1;
        if (engineRef.current.onNudge) engineRef.current.onNudge(1);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        Sound.init();
        if (engineRef.current.onActionButton) engineRef.current.onActionButton();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') &&
        heldNudgeRef.current === -1
      ) {
        heldNudgeRef.current = 0;
      } else if (
        (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') &&
        heldNudgeRef.current === 1
      ) {
        heldNudgeRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startEngine, updatePauseState]);

  const otherGames: GameKey[] = (
    ['BBTAN', 'CCTAN', 'DDTAN', 'EETAN', 'FFTAN', 'GGTAN'] as GameKey[]
  ).filter(k => k !== gameKey);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-5 items-center lg:items-start justify-center max-w-6xl w-full mx-auto py-2">
      {/* LEFT: ARCADE CABINET FRAME */}
      <div className="w-full max-w-[440px] flex flex-col bg-[#0c1122] border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl relative">
        {/* Top Game Header inside cabinet */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/90">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onGoHome}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>大廳</span>
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-black mono ${meta.themeClasses.text}`}>
                  {meta.number} ·
                </span>
                <h2 className={`text-base font-black tracking-tight ${meta.themeClasses.text}`}>
                  {meta.shortTitle}
                </h2>
              </div>
              <p className="text-[10px] text-slate-400">{meta.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                {meta.isTurnBased ? 'TURN' : 'SCORE'}
              </div>
              <div className="text-lg font-black mono text-white leading-none">{score}</div>
            </div>
            <div className="text-right border-l border-slate-800 pl-2.5">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">BEST</div>
              <div className="text-lg font-black mono text-amber-300 leading-none">{bestScore}</div>
            </div>
          </div>
        </div>

        {/* Secondary Status & Control Bar */}
        <div className="flex items-center justify-between text-xs mb-2 px-1">
          <div className={`font-bold mono ${meta.themeClasses.text}`}>
            {telemetry.extraLeft || `MODE: ${meta.modeTag}`}
          </div>

          <div className="flex items-center gap-1.5">
            {meta.hasSpeedToggle && (
              <button
                onClick={() => {
                  Sound.init();
                  if (engineRef.current?.toggleSpeed) {
                    engineRef.current.toggleSpeed();
                    if (engineRef.current.getTelemetry) {
                      setTelemetry(engineRef.current.getTelemetry());
                    }
                  }
                }}
                className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold mono transition flex items-center gap-1"
                title="切換彈珠飛行速度 (1X / 2X / 3X)"
              >
                <Zap className="w-3 h-3" />
                <span>加速</span>
              </button>
            )}

            {meta.hasRecall && (
              <button
                onClick={() => {
                  Sound.init();
                  if (engineRef.current?.recallBalls) engineRef.current.recallBalls();
                }}
                className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition flex items-center gap-1"
                title="一鍵收回所有彈珠並結束本回合"
              >
                <ArrowDownToLine className="w-3 h-3" />
                <span>收球</span>
              </button>
            )}

            <button
              onClick={() => {
                if (!gameOverInfo?.isOver) {
                  updatePauseState(!isPaused);
                }
              }}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition"
              title="暫停 / 繼續 (P)"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => {
                Sound.init();
                startEngine();
              }}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition"
              title="重新開局 (R)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas Display Viewport */}
        <div className="relative w-full aspect-[3/4] max-h-[580px] bg-[#070a14] rounded-xl overflow-hidden border border-slate-800 shadow-inner mx-auto">
          <canvas
            ref={canvasRef}
            width={LOGICAL_W}
            height={LOGICAL_H}
            className="w-full h-full cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {/* Pause Overlay */}
          {isPaused && !gameOverInfo?.isOver && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2 mono">
                PAUSED · 遊戲暫停
              </div>
              <h3 className="text-2xl font-black text-white mb-1">{meta.shortTitle} 已暫停</h3>
              <p className="text-xs text-slate-300 mb-5 max-w-xs">
                隨時點擊繼續回到當前戰局，或切換體驗其他 TAN 系列代表作。
              </p>
              <div className="flex flex-wrap gap-2.5 justify-center">
                <button
                  onClick={() => updatePauseState(false)}
                  className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs transition"
                >
                  繼續遊戲
                </button>
                <button
                  onClick={startEngine}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                >
                  重新開始
                </button>
                <button
                  onClick={onGoHome}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                >
                  返回大廳
                </button>
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameOverInfo?.isOver && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in">
              <div className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-2 flex items-center gap-2 mono">
                <span>GAME OVER</span>
                {gameOverInfo.isNewBest && (
                  <span className="text-amber-300 font-black">★ NEW RECORD ★</span>
                )}
              </div>

              <h3 className="text-2xl font-black text-white mb-1">{meta.shortTitle} 挑戰結束</h3>
              <p className="text-xs text-rose-300/90 mb-4 max-w-xs">{gameOverInfo.reason}</p>

              <div className="flex gap-6 bg-slate-900/90 border border-slate-800 rounded-xl px-5 py-3 mb-5">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">本次成績</div>
                  <div className="text-2xl font-black mono text-white">{gameOverInfo.score}</div>
                </div>
                <div className="border-l border-slate-800 pl-6">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span>最高紀錄</span>
                  </div>
                  <div className="text-2xl font-black mono text-amber-300">{bestScore}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 justify-center">
                <button
                  onClick={() => {
                    Sound.init();
                    startEngine();
                  }}
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition shadow-lg ${meta.themeClasses.btn}`}
                >
                  再玩一局 ↻
                </button>
                <button
                  onClick={onGoHome}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                >
                  返回主大廳
                </button>
              </div>
            </div>
          )}
        </div>

        {/* On-screen touch & continuous nudge auxiliary controls */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onPointerDown={() => {
              Sound.init();
              heldNudgeRef.current = -1;
              if (engineRef.current?.onNudge) engineRef.current.onNudge(-1);
            }}
            onPointerUp={() => {
              heldNudgeRef.current = 0;
            }}
            onPointerLeave={() => {
              heldNudgeRef.current = 0;
            }}
            className="py-2.5 rounded-xl bg-slate-800/90 active:bg-cyan-500/30 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition"
          >
            ◀ 左移 / 逆時針
          </button>
          <button
            type="button"
            onClick={() => {
              Sound.init();
              if (
                !isPausedRef.current &&
                !isGameOverRef.current &&
                engineRef.current?.onActionButton
              ) {
                engineRef.current.onActionButton();
              }
            }}
            className={`py-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1 transition ${meta.themeClasses.badge}`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>發射 / 動作</span>
          </button>
          <button
            type="button"
            onPointerDown={() => {
              Sound.init();
              heldNudgeRef.current = 1;
              if (engineRef.current?.onNudge) engineRef.current.onNudge(1);
            }}
            onPointerUp={() => {
              heldNudgeRef.current = 0;
            }}
            onPointerLeave={() => {
              heldNudgeRef.current = 0;
            }}
            className="py-2.5 rounded-xl bg-slate-800/90 active:bg-cyan-500/30 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition"
          >
            右移 / 順時針 ▶
          </button>
        </div>
      </div>

      {/* RIGHT: MECHANICS BREAKDOWN & TELEMETRY COMPANION PANEL */}
      <aside className="w-full max-w-[440px] lg:max-w-md flex flex-col justify-between bg-[#101628] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${meta.themeClasses.text} flex items-center gap-1.5`}
            >
              <Info className="w-3.5 h-3.5" /> 當前遊戲機制拆解
            </span>
            <span className="text-[11px] text-slate-400 mono">{meta.modeTag}</span>
          </div>

          {/* Title & Summary */}
          <div>
            <h3 className="text-lg font-black text-white">{meta.fullTitle}</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{meta.summary}</p>
          </div>

          {/* Detailed breakdown card */}
          <div className="space-y-2.5 bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/90 text-xs">
            <div>
              <span className="text-slate-400 font-semibold block">🎮 操作方式：</span>
              <p className="text-slate-200 mt-0.5 leading-relaxed">{meta.controls}</p>
            </div>
            <div className="border-t border-slate-800/80 pt-2">
              <span className="text-slate-400 font-semibold block">⚙️ 核心機制：</span>
              <p className="text-slate-200 mt-0.5 leading-relaxed">{meta.mechanics}</p>
            </div>
            <div className="border-t border-slate-800/80 pt-2">
              <span className="text-slate-400 font-semibold block">📐 物理特性：</span>
              <p className="text-slate-200 mt-0.5 leading-relaxed">{meta.physics}</p>
            </div>
            <div className="border-t border-slate-800/80 pt-2">
              <span className="text-amber-400 font-semibold block">💡 通關技巧：</span>
              <p className="text-amber-200/90 mt-0.5 leading-relaxed">{meta.tips}</p>
            </div>
          </div>

          {/* Real-time Physics Telemetry Box */}
          <div className="bg-[#090d1a] rounded-xl p-3 border border-slate-800/90 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                即時物理引擎參數 (60Hz FIXED TIMESTEP)
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] mono pt-1">
              <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px]">GRAVITY (重力加速度)</span>
                <span className={`font-bold ${meta.themeClasses.text}`}>
                  {telemetry.gravityText || meta.gravityText}
                </span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px]">ACTIVE ENTITIES (實體數)</span>
                <span className="text-amber-300 font-bold">
                  {telemetry.entitiesCount !== undefined ? telemetry.entitiesCount : 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Switch to Other TAN Games */}
        <div className="pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400">
              快速切換其他 TAN 系列作品：
            </span>
            <button
              onClick={onOpenMechanicsModal}
              className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 underline font-semibold"
            >
              檢視完整比較表
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {otherGames.map(key => {
              const otherMeta = GAMES_CATALOG[key];
              return (
                <button
                  key={key}
                  onClick={() => {
                    Sound.init();
                    onSelectGame(key);
                  }}
                  className="py-1.5 px-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs font-bold mono text-center transition flex flex-col items-center justify-center gap-0.5 border border-slate-700/60"
                  title={otherMeta.fullTitle}
                >
                  <span className={`text-[10px] font-black ${otherMeta.themeClasses.text}`}>
                    {otherMeta.number}
                  </span>
                  <span className="text-[11px] text-slate-200">{key}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
};
