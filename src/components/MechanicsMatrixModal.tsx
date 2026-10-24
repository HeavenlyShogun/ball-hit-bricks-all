import React, { useEffect } from 'react';
import { GameKey, GAMES_CATALOG } from '../types/game';
import { Sound } from '../utils/sound';
import { X, Play } from 'lucide-react';

interface MechanicsMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGame: (key: GameKey) => void;
}

export const MechanicsMatrixModal: React.FC<MechanicsMatrixModalProps> = ({
  isOpen,
  onClose,
  onSelectGame,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const games: GameKey[] = ['BBTAN', 'CCTAN', 'DDTAN', 'EETAN', 'FFTAN', 'GGTAN'];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#101628] border border-slate-700 rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-400 mono">
              111% CORE PHYSICS ARCHITECTURE · 機制對照矩陣
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              TAN 系列六大代表作機制與物理拆解矩陣
            </h2>
            <p className="text-xs text-slate-400">
              橫向對比六款作品在「輸入操作」、「推進機制」與「2D 幾何碰撞/重力」的創新變體
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="關閉 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Table Content */}
        <div className="overflow-x-auto overflow-y-auto my-4 flex-1">
          <table className="w-full text-left border-collapse text-xs min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/80 sticky top-0">
                <th className="p-3 font-bold">作品編號</th>
                <th className="p-3 font-bold">核心定位</th>
                <th className="p-3 font-bold">操作方式</th>
                <th className="p-3 font-bold">推進機制</th>
                <th className="p-3 font-bold">物理特性 & 重力</th>
                <th className="p-3 font-bold text-center">立即啟動</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-200">
              {games.map(key => {
                const meta = GAMES_CATALOG[key];
                return (
                  <tr key={key} className="hover:bg-slate-900/50 transition">
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 mono">
                        <span className={`font-black ${meta.themeClasses.text}`}>
                          {meta.number}
                        </span>
                        <span className="text-slate-600">·</span>
                        <strong className={`font-black ${meta.themeClasses.text}`}>
                          {meta.shortTitle}
                        </strong>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-100">{meta.tagline}</td>
                    <td className="p-3 text-slate-300">{meta.controls}</td>
                    <td className="p-3 text-slate-300">{meta.mechanics}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-300">
                      <div>{meta.physics}</div>
                      <div className="text-cyan-400 font-semibold mt-0.5">{meta.gravityText}</div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          Sound.init();
                          onClose();
                          onSelectGame(key);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 mx-auto transition shadow ${meta.themeClasses.btn}`}
                      >
                        <Play className="w-3 h-3" />
                        <span>遊玩</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
          <span className="text-slate-400 hidden sm:inline">
            💡 提示：點擊頂部導覽列可隨時在遊戲間無縫切換，或按 Esc 關閉此視窗。
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition ml-auto"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};
