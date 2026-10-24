# 111%「TAN 系列」6合1 街機合輯 — 程式碼架構深度體檢與修改優化 Prompt 指南

本文件針對目前的 `tan-arcade-collection` 專案進行完整的程式碼架構審查、React 生命週期與 Canvas 物理引擎診斷，並針對 **BBTAN、CCTAN、DDTAN、EETAN、FFTAN、GGTAN** 六款核心代表作提供**可直接複製貼上（Copy-Paste Ready）給 AI 開發助手 / AI Studio 的修改與優化 Prompt**。

## 一、目前專案架構總覽與模組拆解

目前專案採用 **React 19 + TypeScript + Tailwind CSS v4 + HTML5 Canvas + Web Audio API** 的純前端單頁式架構（SPA），將主頁面大廳與六款獨立物理引擎透過統一介面（`GameEngine`）進行整合。

| 模組路徑 | 職責定位 | 目前實作狀態評估 |
| :--- | :--- | :--- |
| `src/App.tsx` | 頂層路由與全域狀態管理（URL Hash 同步、總分統計、音效開關、機制比較表 Modal） | 架構清晰，但 `handleResetScores` 使用 `window.confirm` 在 iframe 沙盒環境會被阻擋失效。 |
| `src/types/game.ts` | 定義 `GameKey`、`GameMetadata`、`GameTelemetry`、`GameEngine` 介面與 `GAMES_CATALOG` 靜態資料庫 | 型別定義良好，但 `GameEngine` 缺乏鍵盤連續移動介面（`onKeyChange`）與資源釋放處理。 |
| `src/components/ArcadeCabinet.tsx` | 街機框體容器、Canvas 掛載、`requestAnimationFrame` 迴圈驅動、指標/鍵盤事件轉發與遙測面板 | **存在 P0 級致命生命週期 Bug**（暫停與結算畫面會瞬間觸發重開局）與 60FPS `setState` 效能瓶頸。 |
| `src/components/LobbyView.tsx` | 6合1 主大廳、隨機遊玩入口、積分統計看板与六大遊戲介紹卡片 | 視覺層次佳，支援一鍵跳轉各遊戲，但缺少各遊戲獨立遊玩次數或關卡進度標籤。 |
| `src/components/Navbar.tsx` | 頂部導覽列、遊戲快速切換膠囊按鈕（Pills）、音效開關與機制矩陣入口 | 切換流暢，但在窄螢幕行動裝置上快速切換列可強化自動捲動定位。 |
| `src/components/MechanicsMatrixModal.tsx` | 六款作品的操作、推進機制與物理特性橫向對照表 | 完整對應 111% 六大作品拆解，建議補充快捷鍵 `Esc` 關閉支援。 |
| `src/utils/graphics.ts` | 粒子系統（`createParticleSystem`）、血量色相映射（`hpColor`）與圓形對矩形碰撞（`resolveCircleRect`） | **物理碰撞存在角落反彈誤判**，且每幀使用 `Array.splice` 產生多餘垃圾回收（GC）壓力。 |
| `src/utils/sound.ts` | 零外部音檔依賴的 Web Audio 合成音效器（`SoundManager`） | 輕量實用，但 `localStorage` 讀取未包裹 `try/catch`，在無痕或嚴格沙盒下可能拋錯。 |
| `src/games/bbtan.ts` ~ `ggtan.ts` | 六款 TAN 代表作的獨立狀態機、物理更新（`update`）與 Canvas 繪製（`draw`） | 六款皆可運行，但各有影響核心樂趣的機制落差（詳見第三節逐款診斷）。 |
| `public/assets/aistudio/*.html` | 舊版 AI Studio 匯出的 7 個單一 HTML 檔案（每個約 118KB，共 ~830KB） | **完全未使用的冗餘資產**，與 `src/` 的 React 架構重複，建議清理。 |

## 二、核心架構與系統級問題診斷（依嚴重度排序）

### 1. 【P0 致命 Bug】`ArcadeCabinet.tsx` 的 `useCallback` 依賴導致「暫停」與「Game Over」瞬間重置遊戲

在 `src/components/ArcadeCabinet.tsx` 第 69–141 行中：

```tsx
const startEngine = useCallback(() => {
  // ...
  fxRef.current.clear();
  setIsPaused(false);
  setGameOverInfo(null);
  setScore(1);
  // ...
  const loop = () => {
    if (engineRef.current && !isPaused && !gameOverInfo?.isOver) {
      engineRef.current.update();
      engineRef.current.draw();
      // ...
    }
    animFrameRef.current = requestAnimationFrame(loop);
  };
  animFrameRef.current = requestAnimationFrame(loop);
}, [gameKey, handleGameOver, isPaused, gameOverInfo?.isOver]);

useEffect(() => {
  startEngine();
  return () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };
}, [gameKey, startEngine]);
```

* **問題成因**：`startEngine` 的依賴陣列包含了 `isPaused` 與 `gameOverInfo?.isOver`，而下方的 `useEffect` 監聽了 `[gameKey, startEngine]`。
* **嚴重後果**：
  1. 當玩家按下「暫停（P 鍵或按鈕）」使 `isPaused` 變為 `true` 時，`startEngine` 函式參照改變，立即觸發 `useEffect` 重新執行 `startEngine()`，在函式開頭把 `isPaused` 重設回 `false` 並**直接清空當前進度重新開局**！
  2. 當遊戲失敗觸發 `handleGameOver` 使 `gameOverInfo.isOver` 變為 `true` 時，同樣立即觸發 `startEngine()`，把 `gameOverInfo` 重設為 `null` 並**直接重開新局**，導致玩家永遠看不到 Game Over 結算畫面！
* **修復方案**：使用 `isPausedRef` 與 `isGameOverRef`（`useRef`）供 `loop` 內部讀取，將 `isPaused` 與 `gameOverInfo?.isOver` 從 `startEngine` 的 `useCallback` 依賴陣列中移除，確保只有切換 `gameKey` 或手動點擊「重新開始」時才會重置引擎。

### 2. 【P1 效能與跨更新率問題】60FPS React 全組件重繪與高更新率螢幕（120Hz/144Hz）倍速暴衝

* **每幀觸發 React 重繪**：`loop()` 在每一個 `requestAnimationFrame`（每秒 60~144 次）都執行 `setTelemetry(engineRef.current.getTelemetry())`。由於 `getTelemetry()` 每次都回傳全新的物件參照，導致整個 `ArcadeCabinet` 組件每秒強制重繪 60 次以上。應改為每 6~10 幀（約 100ms~150ms）節流更新一次遙測 UI，或僅在數值變動時更新。
* **缺乏固定時間步長（Fixed Timestep / Delta-Time）**：六款遊戲的物理速度（如 `GRAVITY = 0.22`、`spd = 6.4`、`scrollSpeed = 1.15`）皆假設螢幕固定為 60FPS。在 120Hz（iPad Pro / iPhone Pro / 電競螢幕）或 144Hz 螢幕上，遊戲速度會變成 **2 倍至 2.4 倍快**，導致 `CCTAN`、`EETAN`、`FFTAN`、`GGTAN` 難度失控。應在 `loop(timestamp)` 中實作 `accumulator` 固定步長（`FIXED_DT = 1000 / 60`），確保所有裝置物理手感完全一致。
* **Retina 高解析度模糊**：`<canvas width={420} height={560}>` 未根據 `window.devicePixelRatio` 縮放畫布緩衝區，在行動裝置與高解析度螢幕上文字與幾何邊緣呈現模糊鋸齒。

### 3. 【P1 操作與物理碰撞缺陷】鍵盤方向鍵缺失、觸控微調按鈕寫死與角落碰撞誤判

* **鍵盤方向鍵（`◀`/`▶`、`A`/`D`）未實作**：`GAMES_CATALOG` 說明文字寫道支援鍵盤 `◀ / ▶ (A/D)` 控制，但 `ArcadeCabinet.tsx` 的 `handleKeyDown` 僅處理了 `Space`、`P`、`R`，完全沒有處理左右方向鍵與 `A`/`D` 鍵。
* **下方觸控微調按鈕邏輯寫死**：`ArcadeCabinet.tsx` 第 331–368 行的「◀ 左微調 / 瞄準」與「右微調 / 瞄準 ▶」按鈕點擊時僅執行 `onPointerMove(canvas.width * 0.25, canvas.height * 0.35)`，將準星瞬間跳到固定死點，再次點擊完全不會繼續微調角度或移動角色。應在 `GameEngine` 新增 `onNudge(dir: -1 | 1)` 方法，支援按住或點擊時遞增/遞減角度或水平座標。
* **`resolveCircleRect` 角落碰撞法線誤判與穿透**：`src/utils/graphics.ts` 的 `resolveCircleRect` 僅比較 `overlapLeft / Right / Top / Bottom` 四個軸向重疊量，未計算球心對矩形最近點 `(closestX, closestY)` 的法線向量 `(dx, dy)`。當彈珠斜向撞擊磚塊四個角落時，常發生反彈方向錯誤（例如從側面撞角卻向上反彈）；且 `BBTAN` 與 `DDTAN` 在 `3X` 加速時單步移動距離較大，應加入次步進（Sub-stepping）或精確法線反射。

## 三、六款 TAN 代表作機制與物理還原度逐款診斷

| 遊戲代號 | 目前實作的主要缺陷與手感問題 | 111% 原作核心機制優化目標 |
| :--- | :--- | :--- |
| **1. BBTAN** | 1. **雷射道具（`━`/`┃`）被第一顆球碰到就立刻消失**（`items.splice(j, 1)`），失去整串彈珠連續觸發雷射清場的核心爽感。<br>2. 滑鼠未按住僅滑過畫布就會改變瞄準線，放開即射擊，缺乏「按住拖曳拉出瞄準線 → 往下拉回底部取消射擊」的防呆設計。<br>3. 瞄準線僅畫出直線，未預覽第一次牆壁反射角。 | 1. 雷射道具改為「當回合觸發標記（`triggeredThisTurn`）」，每顆經過的彈珠皆可觸發一次橫/縱向雷射傷害，直到回合結束（`endTurn`）才移除。<br>2. 實作按住拖曳瞄準（支援正向瞄準與反向彈弓拉弓兩種手感相容），拖曳至發射線下方顯示「取消射擊」提示。<br>3. 瞄準虛線加入單次牆壁反射路徑預覽。 |
| **2. CCTAN** | 1. 子彈設有 `bounces: 2` 限制，撞擊兩次即憑空消失，無法在密集方塊群中產生連鎖彈射。<br>2. 每次擊中方塊給予 `en.dist += 4` 擊退，在高射速下會把方塊一路推回畫面外。<br>3. 僅能靠滑鼠座標轉向，缺乏單鍵/方向鍵旋轉砲台操作。 | 1. 移除人為 `bounces` 上限（或提高至 8 次以上），讓彈珠在無外牆的 360° 場域中自由在方塊間幾何反彈，直到飛出畫面邊緣自然消失。<br>2. 將擊退幅度調降為微幅震動（`+1.2px`）並加上擊退上限，維持四面八方逼近的生存壓迫感。<br>3. 支援拖曳、方向鍵旋轉與點擊切換旋轉方向。 |
| **3. DDTAN** | 1. 開局預設 `launchVy = -1.5`（朝上），若玩家未移動滑鼠直接按空白鍵，彈珠會直接往天花板打。<br>2. 拋物線預覽在碰到左右牆壁時未做座標夾限（Clamp），導致預覽虛線與實際彈珠軌跡不一致。<br>3. 彈珠落到底部直接消失，若下方磚塊有缺口，整串球會瞬間漏光；且 `+1` 道具隨回合上升超過警戒線後未清理。 | 1. 預設發射向量改為斜上方拋物線，並同步 `draw()` 預覽與 `update()` 的重力與牆壁彈性碰撞公式（`Restitution = 0.88`）使預覽 100% 精準。<br>2. 底部加入一次彈性地板反彈（或緩衝彈跳墊），讓球在底部與磚塊群之間產生重力彈跳連擊。<br>3. 清理超過 `DANGER_Y` 的過期道具。 |
| **4. EETAN** | 1. `rowTimer >= CELL` 時重設為 `0` 而非 `rowTimer -= CELL`，隨捲軸加速會產生磚塊列間距誤差。<br>2. 角色碰撞判定將「側面擦撞」與「正面撞擊」混為一談，左右滑動切換跑道擦到旁邊磚塊側邊就立刻 Game Over，手感過於嚴苛。 | 1. 修正波次生成計時器為 `rowTimer -= CELL`，並使磚塊位置緊密對齊網格。<br>2. 區分「水平側面阻擋（限制 X 軸位移但不死）」與「正面迎頭撞擊（磚塊底邊壓中戰機才 Game Over）」，大幅提升跑酷閃避與鑽縫隙的操作流暢度。 |
| **5. FFTAN** | 1. 開局第一幀球就直接飛出，玩家來不及準備接球。<br>2. 當場上剩餘磚塊 `<= 3` 時立即強制下壓生成新波次，若此時球正在上方飛行，會直接被新生成的磚塊卡死在內部。 | 1. 新增開局與漏球後的 `READY` 黏球準備狀態（球跟隨底部反彈板移動，點擊或按空白鍵發射）。<br>2. 波次推進改為平滑過渡，並推開或重置位於新磚塊生成區內的彈珠，避免卡球 Bug；新增穿透火球或雷射板等經典 Arkanoid 變化。 |
| **6. GGTAN** | 1. **`firePulse()` 完全沒有發射冷卻與能量消耗**！玩家只要連點滑鼠或按住空白鍵，每秒可射出數十發子彈暴力洗掉外圈護盾，完全失去「抓準時機穿透縫隙」的節奏核心。<br>2. 破關進入下一階段（`buildStage`）時未清空場上殘留子彈，舊子彈會直接打中下一關核心。 | 1. 加入發射冷卻（Cooldown）與「節奏穿透獎勵機制」：子彈穿過旋轉缺口直擊核心時觸發 `PERFECT GAP!`，恢復大量能量並疊加連擊倍率（Combo Multiplier）；若誤擊外層旋轉護盾則扣除微量能量並重置連擊。<br>2. 新增第 3 層高階幾何護盾（隨關卡解鎖）與雙層缺口同相位高亮提示，並在切換關卡時清空場上殘留彈幕。 |

## 四、其他工程細節與相容性問題

1. **沙盒環境 `window.confirm` 禁用問題**：`src/App.tsx` 第 55 行 `if (window.confirm('確定要清空所有 6 款 TAN 遊戲的最高紀錄嗎？'))` 在 iframe 沙盒環境會被瀏覽器攔截並回傳 `false`，導致「重置紀錄」按鈕完全失效。應改為按鈕二次點擊確認（「點擊確認重置」）或自訂 Modal。
2. **初始分數顯示不一致**：`ArcadeCabinet.tsx` 將 `score` 初始 state 設為 `1`，導致 `CCTAN`、`EETAN`、`FFTAN`、`GGTAN` 開局還沒得分時右上角就顯示 `SCORE: 1`。應根據遊戲類型初始化（回合制 `BBTAN`/`DDTAN` 為 `1`，積分制其餘四款為 `0`）。
3. **冗餘檔案與套件清理**：
   * 刪除 `public/assets/aistudio/` 目錄下的 7 個舊版 HTML 檔案與說明檔（節省約 830KB）。
   * 移除 `package.json` 中未使用的 `express`、`dotenv`、`@google/genai` 等後端依賴。

## 五、可直接複製使用的 AI 修改優化 Prompt（All-in-One 完整重構版）

你可以直接複製下方區塊的完整文字，貼給 AI 開發助手（如 Google AI Studio、Cursor、Claude Code 或 Windsurf）一次完成所有架構修復與六款遊戲的物理手感升級：

> **【任務目標】**
> 請幫我全面重構並優化目前的「111% TAN 系列 6合1 街機合輯」React + TypeScript + Canvas 專案，修復現有的 React 生命週期致命 Bug、升级 2D 物理碰撞與固定時間步長（Fixed Timestep），並深度還原 BBTAN、CCTAN、DDTAN、EETAN、FFTAN、GGTAN 六款遊戲的核心機制與操作手感。
>
> **【一、修復核心架構、效能與沙盒相容性 (`src/components/ArcadeCabinet.tsx`, `src/App.tsx`, `src/utils/sound.ts`)】**
> 1. **修復暫停與 Game Over 瞬間重開局的致命 Bug (`ArcadeCabinet.tsx`)**：
>    - 目前 `startEngine` 的 `useCallback` 依賴陣列包含了 `isPaused` 與 `gameOverInfo?.isOver`，導致按下暫停或觸發 Game Over 時會改變 `startEngine` 參照並觸發 `useEffect` 重新執行 `startEngine()`，把遊戲直接重置。
>    - 請改用 `isPausedRef = useRef(false)` 與 `isGameOverRef = useRef(false)` 同步狀態供 `requestAnimationFrame` 迴圈內部判斷，並將 `isPaused` 與 `gameOverInfo?.isOver` 從 `startEngine` 的 `useCallback` 依賴陣列移除，確保只有切換 `gameKey` 或手動點擊「重新開始」時才重新初始化遊戲。
> 2. **實作固定時間步長 (Fixed Timestep 60Hz) 與遙測節流 (`ArcadeCabinet.tsx`)**：
>    - 在 `requestAnimationFrame` 迴圈中使用時間累加器（`FIXED_DT = 1000 / 60`，單幀最大步數上限為 4），避免在 120Hz/144Hz 螢幕上遊戲速度翻倍。
>    - 當遊戲處於暫停或 Game Over 時，仍保持繪製當前畫面但跳過 `engine.update()`。
>    - 將 `setTelemetry(engineRef.current.getTelemetry())` 改為每 6 幀（約 100ms）更新一次，避免每幀觸發 React 全組件重繪。
> 3. **支援 Retina 高解析度 Canvas (`ArcadeCabinet.tsx`)**：
>    - 邏輯尺寸維持 `W = 420, H = 560`，但根據 `window.devicePixelRatio`（上限 2）設定 `canvas.width = 420 * dpr`、`canvas.height = 560 * dpr`，並在取得 Context 後呼叫 `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`，確保文字與幾何線條在手機與高解析度螢幕上清晰銳利。
> 4. **完善鍵盤方向鍵與螢幕微調控制 (`src/types/game.ts`, `ArcadeCabinet.tsx`)**：
>    - 在 `GameEngine` 介面新增 `onNudge?: (dir: -1 | 1) => void` 與 `onPointerDown?: (x: number, y: number) => void`。
>    - 在 `ArcadeCabinet.tsx` 監聽鍵盤 `ArrowLeft` / `KeyA`（呼叫 `onNudge(-1)`）與 `ArrowRight` / `KeyD`（呼叫 `onNudge(1)`），並讓畫面下方的「◀ 左微調 / 瞄準」與「右微調 / 瞄準 ▶」按鈕呼叫 `onNudge(-1)` 與 `onNudge(1)`，支援點擊與長按連續微調，取代原本寫死的 `0.25 * W` 座標。
> 5. **修正初始分數顯示與沙盒禁用 API (`ArcadeCabinet.tsx`, `App.tsx`, `sound.ts`)**：
>    - `ArcadeCabinet.tsx` 初始化分數時，回合制遊戲（`BBTAN`、`DDTAN`）初始為 `1`，其餘積分制遊戲（`CCTAN`、`EETAN`、`FFTAN`、`GGTAN`）初始為 `0`。
>    - 移除 `App.tsx` 中的 `window.confirm`，在 `LobbyView.tsx` 的「重置紀錄」按鈕改用「二次點擊確認（3 秒內再次點擊確認清空）」的內嵌互動。
>    - 在 `src/utils/sound.ts` 的 `localStorage.getItem` / `setItem` 外層加上 `try / catch` 保護。
>
> **【二、升級物理碰撞引擎 (`src/utils/graphics.ts`)】**
> 1. **精確圓對矩形法線碰撞 (`resolveCircleRect`)**：
>    - 計算球心 `(ball.x, ball.y)` 到矩形 `[rx, ry, rw, rh]` 最近點 `(closestX, closestY)` 的向量 `dx = ball.x - closestX`、`dy = ball.y - closestY`。
>    - 若球心位於矩形外部且撞擊角落，根據 `|dx|` 與 `|dy|` 的比例或入射法線精確反轉對應速度分量並將球推出重疊區外，解決斜角撞擊磚塊時的反彈方向誤判。
>
> **【三、六款 TAN 遊戲核心機制深度優化 (`src/games/*.ts`)】**
> 1. **BBTAN (`src/games/bbtan.ts`)**：
>    - **雷射道具持續觸發**：`Item` 新增 `triggeredThisTurn?: boolean`。當彈珠穿過 `LASER_H`（橫向雷射）或 `LASER_V`（縱向雷射）時，每一顆經過的彈珠都能觸發一次整排/整列傷害（為避免單顆球在同一幀重複觸發，可用 `Set<Ball>` 記錄已觸發過該道具的彈珠），直到 `endTurn()` 時才將當回合被觸發過的雷射道具從場上移除！
>    - **拖曳瞄準與反射預覽**：支援按住拖曳瞄準（相容正向直指與反向拉弓），在 `AIMING` 狀態繪製包含第一次牆壁反射的瞄準虛線；若指標拉到 `FLOOR_Y - 8` 以下，顯示紅色「放開取消射擊」提示，放開時不發射。
> 2. **CCTAN (`src/games/cctan.ts`)**：
>    - **真正無外牆自由幾何彈射**：將子彈的 `bounces` 提高至 `8`，讓彈珠在四周逼近的方塊群之間產生豐富的連鎖幾何反彈，直到飛出畫面邊界（`< -20` 或 `> W + 20`）才自然消失。
>    - **平衡擊退與操作**：將擊中方塊的擊退距離由 `en.dist += 4` 調降為 `en.dist = Math.min(280, en.dist + 1.2)`，避免把敵人推到畫面外；實作 `onNudge(dir)` 讓方向鍵與微調按鈕可順暢旋轉中央砲台。
> 3. **DDTAN (`src/games/ddtan.ts`)**：
>    - **修正拋物線預覽與預設仰角**：調整預設 `launchVx = 3.2, launchVy = 1.8`，並讓 `draw()` 中的拋物線預覽迴圈與 `update()` 的重力（`GRAVITY = 0.22`）及左右牆壁碰撞夾限（`PAD_X + 6` ~ `W - PAD_X - 6`，`svx *= -0.92`）完全一致。
>    - **底部單次彈性反彈與道具清理**：每顆重力彈珠新增 `floorBounces: 1` 屬性，當落至底部邊界 `H - 24` 時可像彈簧般向上彈起一次（`vy = -Math.abs(vy) * 0.78`），第二次落底才消失，大幅提升重力連擊爽感；並在 `endTurn()` 清理 `y <= DANGER_Y` 的過期道具。
> 4. **EETAN (`src/games/eetan.ts`)**：
>    - **修正捲軸計時與跑酷側面碰撞**：將 `if (rowTimer >= CELL) { rowTimer = 0; ... }` 修正為 `rowTimer -= CELL`。
>    - **改善跑酷閃避手感**：當玩家水平移動撞到障礙方塊的左右側面時，僅將 `playerX` 阻擋在方塊外側而不直接判定死亡；只有當方塊底部下壓撞擊到戰機本體時才觸發 Game Over。實作 `onNudge(dir)` 支援鍵盤與按鈕左右切換跑道。
> 5. **FFTAN (`src/games/fftan.ts`)**：
>    - **開局黏球發射機制**：開局時第一顆球處於 `attached: true` 狀態，跟隨底部反彈板（Paddle）移動，並顯示預計發射方向；玩家點擊畫面、放開拖曳或按空白鍵時才正式發射。
>    - **安全波次推進**：當場上磚塊清空（`bricks.length === 0`）或進入下一波時，確保新生成的頂部磚塊不會直接蓋在正在上方飛行的球上（若球位於新磚塊區則將球安全下移並朝下反射）。實作 `onNudge(dir)` 控制反彈板左右移動。
> 6. **GGTAN (`src/games/ggtan.ts`)**：
>    - **發射冷卻與節奏連擊（Rhythm Combo）系統**：新增發射冷卻 `fireCooldown`（約 16 幀，場上最多同時存在 2 發脈衝彈），防止無限連點洗分。
>    - **穿透獎勵與誤擊懲罰**：當脈衝彈不碰外層護盾直接穿過旋轉縫隙命中中央核心時，累加 `combo` 倍率（傷害與得分隨 Combo 提升，並浮現 `PERFECT GAP xN!` 特效与恢復能量）；若撞擊外層旋轉幾何塊則重置 `combo = 0` 並扣除微量護盾能量（`-1.5`）。
>    - **雙層同相位視覺提示與過關清理**：當內外兩層旋轉環的缺口在瞄準線方向重合時，瞄準線呈現金色高亮提示最佳發射時機；在 `coreHp <= 0` 進入下一關時清空 `shots = []` 避免殘留子彈誤傷新關卡核心。
>
> **【四、清理冗餘檔案】**
> - 請移除未使用的 `public/assets/aistudio/` 舊版靜態 HTML 檔案，並確保 `npm run build` 與 `tsc --noEmit` 零錯誤通過。

## 六、分階段模組化修改 Prompt（適合逐步微調驗證）

若你希望分步驟逐一驗證修改效果，可依序複製以下三個獨立階段的 Prompt：

### 階段一 Prompt：修復 React 遊戲迴圈 Bug 與高解析度/高更新率支援

> 請修改 `src/components/ArcadeCabinet.tsx` 與 `src/App.tsx`：
> 1. 解決 `ArcadeCabinet.tsx` 中按下暫停（`isPaused`）或觸發 Game Over（`gameOverInfo.isOver`）會導致 `startEngine` 重新建立並觸發 `useEffect` 重置遊戲的致命 Bug。請改用 `useRef` 儲存 `isPaused` 與 `isGameOver` 供 `requestAnimationFrame` 迴圈讀取，並從 `startEngine` 的依賴陣列移除這兩個狀態。
> 2. 在 `requestAnimationFrame` 迴圈加入 `FIXED_DT = 1000 / 60` 的時間累加器（Accumulator），確保在 60Hz、120Hz、144Hz 螢幕上物理更新頻率完全一致；並將 `setTelemetry` 節流為每 6 幀更新一次。
> 3. 為 `<canvas>` 加入 `devicePixelRatio` 高解析度支援（邏輯寬高維持 `420x560`）。
> 4. 在 `GameEngine` 新增 `onNudge?: (dir: -1 | 1) => void`，接通鍵盤 `ArrowLeft`/`ArrowRight`/`A`/`D` 與畫面下方左右微調按鈕。

### 階段二 Prompt：修正 BBTAN、CCTAN、DDTAN 三款彈射物理機制

> 請優化 `src/utils/graphics.ts` 及 `src/games/bbtan.ts`、`src/games/cctan.ts`、`src/games/ddtan.ts`：
> 1. 在 `graphics.ts` 的 `resolveCircleRect` 中改用最近點法線向量處理圓與矩形角落碰撞，避免斜角反彈方向錯誤。
> 2. 在 `bbtan.ts` 中，讓橫向/縱向雷射道具（`LASER_H`、`LASER_V`）在當回合內不會被第一顆球撞碎消失，而是讓當回合每一顆經過的彈珠都能觸發一次雷射清場，直到 `endTurn()` 才移除已觸發的雷射道具；並加入瞄準線單次牆壁反射預覽與拉至底部取消射擊機制。
> 3. 在 `cctan.ts` 中，將彈珠反彈次數上限提高至 8 次，讓彈珠能在無外牆的 360° 場域內於方塊間連鎖反彈直到飛出畫面邊界；並將方塊擊退距離調降為 `1.2px`，加上 `onNudge` 旋轉支援。
> 4. 在 `ddtan.ts` 中，同步拋物線預覽與實際牆壁碰撞的座標夾限，為每顆重力彈珠加入 1 次底部地板彈性反彈（`floorBounces = 1`），並在回合結束時清理超過 `DANGER_Y` 的道具。

### 階段三 Prompt：修正 EETAN、FFTAN、GGTAN 三款即時/節奏遊戲手感

> 請優化 `src/games/eetan.ts`、`src/games/fftan.ts`、`src/games/ggtan.ts`：
> 1. 在 `eetan.ts` 中，修正 `rowTimer -= CELL` 避免波次間距偏移；將玩家與方塊的碰撞區分為「側面阻擋（僅限制水平移動不死亡）」與「正面迎頭撞擊（Game Over）」，並實作 `onNudge` 跑道微調。
> 2. 在 `fftan.ts` 中，新增開局黏球準備狀態（球跟隨反彈板移動，點擊或按空白鍵發射）；修正波次推進邏輯，當 `bricks.length === 0` 時再生成新波次並確保不會把飛行中的球卡在磚塊內部。
> 3. 在 `ggtan.ts` 中，加入 16 幀發射冷卻防止無限連點洗分；新增節奏穿透 Combo 系統（不碰外層護盾直擊核心可疊加 Combo 倍率與恢復大量能量，誤擊外層護盾則重置 Combo），並在進入下一關 `buildStage` 時清空場上殘留子彈。
