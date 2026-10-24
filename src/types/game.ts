export type GameKey = 'BBTAN' | 'CCTAN' | 'DDTAN' | 'EETAN' | 'FFTAN' | 'GGTAN';

export interface GameMetadata {
  key: GameKey;
  number: string;
  shortTitle: string;
  fullTitle: string;
  tagline: string;
  modeTag: string;
  accentColor: string;
  isTurnBased: boolean;
  themeClasses: {
    border: string;
    text: string;
    bg: string;
    badge: string;
    btn: string;
    glow: string;
  };
  summary: string;
  controls: string;
  mechanics: string;
  physics: string;
  tips: string;
  gravityText: string;
  hasSpeedToggle?: boolean;
  hasRecall?: boolean;
}

export interface GameTelemetry {
  score: number;
  best: number;
  extraLeft: string;
  entitiesCount: number;
  gravityText: string;
}

export interface GameEngine {
  hasSpeedToggle?: boolean;
  hasRecall?: boolean;
  toggleSpeed?: () => void;
  recallBalls?: () => void;
  onPointerMove?: (x: number, y: number) => void;
  onPointerDown?: (x: number, y: number) => void;
  onPointerUp?: (x: number, y: number) => void;
  onNudge?: (dir: -1 | 1) => void;
  onActionButton?: () => void;
  update: () => void;
  draw: () => void;
  getTelemetry?: () => Partial<GameTelemetry>;
  destroy?: () => void;
}

export const GAMES_CATALOG: Record<GameKey, GameMetadata> = {
  BBTAN: {
    key: 'BBTAN',
    number: '01',
    shortTitle: 'BBTAN',
    fullTitle: 'BBTAN — 經典打磚塊變體',
    tagline: '回合制 · 2D 平面幾何純反射',
    modeTag: '回合制反射',
    accentColor: '#38bdf8',
    isTurnBased: true,
    themeClasses: {
      border: 'border-cyan-500/40 hover:border-cyan-400',
      text: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      btn: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-500/30',
      glow: 'neon-glow-cyan',
    },
    summary: '開局配備 2 顆彈珠與 7 排緩衝空間，拖曳拉出含第一次牆面反射預覽的瞄準線並放開射擊。',
    controls: '按住拖曳瞄準（拉至底部紅線以下可取消射擊）或用 ◀/▶ 微調角度 → 放開或按空白鍵發射。',
    mechanics: '每回合保底生成 1 顆 (+1) 加球；場上現存方塊下移時每 3 回合強化 +1 HP；雷射道具（━ / ┃）當回合內每顆經過的彈珠皆可觸發一次清場。',
    physics: '2D 平面幾何反彈，無重力 (g = 0)，依賴三面牆壁與方塊表面的入射角 = 反射角純反射定律。',
    tips: '利用牆面一次反射預覽將彈珠打入磚塊上方，讓整串彈珠連續刷過雷射道具造成海量輸出！',
    gravityText: '0.00 px/f² (無重力)',
    hasSpeedToggle: true,
    hasRecall: true,
  },
  CCTAN: {
    key: 'CCTAN',
    number: '02',
    shortTitle: 'CCTAN',
    fullTitle: 'CCTAN — 360 度防守射擊',
    tagline: '即時生存制 · 360° 中央旋轉砲台',
    modeTag: '360° 即時生存',
    accentColor: '#f43f5e',
    isTurnBased: false,
    themeClasses: {
      border: 'border-rose-500/40 hover:border-rose-400',
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      btn: 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30',
      glow: 'neon-glow-rose',
    },
    summary: '主角固定於畫面正中央，方塊從四面八方 360 度逼近，一旦任何方塊觸碰中央核心即 Game Over。',
    controls: '滑鼠/觸控拖曳或按 ◀/▶ (A/D) 旋轉中央砲台；每 12 秒可按空白鍵或動作鈕啟動 3 秒戰術 3-Way 超載散射。',
    mechanics: '即時生存制。彈珠具備 6 次連鎖幾何反彈上限；擊破場上 3X 能量球可不受冷卻限制直接啟動 5 秒三向散射。',
    physics: '放射狀彈射，無外圍牆壁，彈珠在方塊群間自由幾何反彈並產生 1.2px 微幅擊退，離開邊界即消失。',
    tips: '優先鎖定距離核心最近的方塊，並在多方向同時逼近時啟動空白鍵戰術 3-Way 超載解圍！',
    gravityText: '0.00 px/f² (無外牆放射)',
  },
  DDTAN: {
    key: 'DDTAN',
    number: '03',
    shortTitle: 'DDTAN',
    fullTitle: 'DDTAN — 重力拋物線彈射',
    tagline: '回合制 · Gravity 垂直重力加速度系統',
    modeTag: '重力拋物線',
    accentColor: '#f59e0b',
    isTurnBased: true,
    themeClasses: {
      border: 'border-amber-500/40 hover:border-amber-400',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      btn: 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-500/30',
      glow: 'neon-glow-amber',
    },
    summary: '發射器位於頂部，拖曳拉出受重力彎曲的拋物線軌跡進行彈射，利用重力與底部單次彈性反彈連擊下方磚塊。',
    controls: '按住拖曳調整初速度與發射仰角（即時預覽含牆壁夾限反彈的精準拋物線軌跡），放開或按空白鍵拋射。',
    mechanics: '每回合保底生成 1 顆 (+1) 重力球；每顆彈珠落至底部琥珀色防線時享有 1 次向上彈性反彈機會（floorBounces = 1）。',
    physics: '引入垂直重力加速度 (vy += 0.22) 與碰撞能量恢復係數 (Restitution = 0.86)，支援底部彈簧二次連擊。',
    tips: '將球拋入磚塊間的夾縫，即使穿過缺口落底也會被底部琥珀色緩衝線彈回磚塊群下方繼續連擊！',
    gravityText: '+0.22 px/f² (垂直重力)',
    hasSpeedToggle: true,
    hasRecall: true,
  },
  EETAN: {
    key: 'EETAN',
    number: '04',
    shortTitle: 'EETAN',
    fullTitle: 'EETAN — 跑酷與連續射擊',
    tagline: '即時跑酷制 · 左右滑動閃避 + 自動垂直連射',
    modeTag: '跑酷連射',
    accentColor: '#10b981',
    isTurnBased: false,
    themeClasses: {
      border: 'border-emerald-500/40 hover:border-emerald-400',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      btn: 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-emerald-500/30',
      glow: 'neon-glow-emerald',
    },
    summary: '結合水平跑酷閃避與不間斷向上射擊！左右滑動角色躲避高血量障礙並擊碎薄皮方塊開闢安全通道。',
    controls: '左右滑動螢幕或按 ◀/▶ (A/D) 切換跑道；按空白鍵或動作鈕可發動扇形散彈衝擊（45 幀冷卻）。',
    mechanics: '每波 100% 保底 1 條全空跑道與 1 條 45% 血量的薄皮跑道；側面擦撞僅阻擋位移不死亡，拾取 SPD（最高 Lv.6）與 +1（最高 5 道）強化火力。',
    physics: '垂直捲軸等速下壓 + 水平側面阻擋分離碰撞與高頻直線/扇形彈幕。',
    tips: '對準全空跑道或薄皮跑道前進，貼近障礙側面滑動時不會死亡，可放心鑽入空隙拾取道具！',
    gravityText: '捲軸下壓 (Runner)',
  },
  FFTAN: {
    key: 'FFTAN',
    number: '05',
    shortTitle: 'FFTAN',
    fullTitle: 'FFTAN — 傳統打磚塊進化 (Arkanoid)',
    tagline: '即時接球制 · 拖曳底部反彈板接球',
    modeTag: '反彈板接球',
    accentColor: '#a855f7',
    isTurnBased: false,
    themeClasses: {
      border: 'border-purple-500/40 hover:border-purple-400',
      text: 'text-purple-400',
      bg: 'bg-purple-500/10',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      btn: 'bg-purple-400 hover:bg-purple-300 text-slate-950 shadow-purple-500/30',
      glow: 'neon-glow-purple',
    },
    summary: '回歸經典 Arkanoid 打磚塊體驗！配備開局黏球瞄準、每波 1 次底部能量護盾救球與動態波次推進。',
    controls: '開局移動反彈板瞄準，點擊或按空白鍵發射；單球飛行中按空白鍵可分裂雙球，左右移動反彈板接球。',
    mechanics: '每波附帶 1 次底部能量護盾（漏接最後一顆球時自動彈回）；當剩餘磚塊 <= 2 或每滿 16 秒平滑下移 1 排新磚塊。',
    physics: '反彈板擊球點動態角動量反射算法（板緣大角度斜射、板心垂直反射）+ 防卡球安全下推保護。',
    tips: '底部藍色虛線代表能量護盾就緒，即使漏接也能救回一命；每推進新波次都會自動重新充能護盾！',
    gravityText: '0.00 px/f² (動量反射板)',
  },
  GGTAN: {
    key: 'GGTAN',
    number: '06',
    shortTitle: 'GGTAN',
    fullTitle: 'GGTAN — 旋轉幾何障礙節奏',
    tagline: '節奏穿透制 · 抓準時機穿透旋轉幾何縫隙',
    modeTag: '旋轉幾何節奏',
    accentColor: '#ec4899',
    isTurnBased: false,
    themeClasses: {
      border: 'border-pink-500/40 hover:border-pink-400',
      text: 'text-pink-400',
      bg: 'bg-pink-500/10',
      badge: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
      btn: 'bg-pink-400 hover:bg-pink-300 text-slate-950 shadow-pink-500/30',
      glow: 'neon-glow-pink',
    },
    summary: '多重旋轉幾何護盾環繞中央核心！當瞄準線變為亮金色代表雙環缺口對齊，抓準節奏穿透縫隙直擊核心。',
    controls: '移動指標或按 ◀/▶ 微調發射仰角，看準金色對齊時機點擊或按空白鍵發射（16 幀冷卻，每次發射耗能 1.2%）。',
    mechanics: '不碰外圈護盾直擊核心觸發 PERFECT GAP 連擊（傷害提升、得分 50×Combo、回能 +9%）；誤擊外層幾何塊則重置 Combo 並懲罰扣能 -3.8%。',
    physics: '極座標多重角速度反向旋轉 (ω1, -ω2) + 即時雙環同相位缺口射線檢測。',
    tips: '切勿無腦連點撞擊護盾（每次撞盾會扣 3.8% 能量）！等待瞄準線亮起金色光芒時一發穿心即可瞬間疊高連擊與能量！',
    gravityText: '極座標旋轉 (ω ≠ 0)',
  },
};
