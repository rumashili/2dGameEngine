import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  // --- 初期状態のセットアップ ---
  const [scripts, setScripts] = useState([
    {
      id: 'script-1',
      name: 'main',
      content: `// プレイヤーの座標
let x = 400;
let y = 300;

// 毎フレーム呼ばれるアップデート関数
Engine.setUpdate((dt) => {
  // 背景をクリア
  Engine.clear('#1e293b');

  // 入力処理（矢印キーで移動）
  const speed = 300 * dt;
  if (Engine.Input.getKey('ArrowRight')) x += speed;
  if (Engine.Input.getKey('ArrowLeft')) x -= speed;
  if (Engine.Input.getKey('ArrowUp')) y -= speed;
  if (Engine.Input.getKey('ArrowDown')) y += speed;

  // テキストを描画（絵文字も使えるよ！）
  Engine.drawText('🚀', x - 25, y + 15, 50);
  Engine.drawText('Arrow keys to move', 20, 40, 24, '#94a3b8');
  
  // コスチュームを読み込んだらこうやって使えるよ
  // Engine.draw('player', x, y, 64, 64);
  
  // マウスクリックで音を鳴らす例
  if (Engine.Input.getMouse().isDown) {
    // Engine.play('jump');
    Engine.drawText('Click!', Engine.Input.getMouse().x, Engine.Input.getMouse().y - 20, 20, '#facc15');
  }
});`
    }
  ]);
  const [costumes, setCostumes] = useState([]);
  const [sounds, setSounds] = useState([]);
  
  const [activeFile, setActiveFile] = useState({ type: 'script', id: 'script-1' });
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  // --- 参照用 ---
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const uploadTypeRef = useRef('costume'); // 'costume' | 'sound'
  const animFrameRef = useRef(null);
  const engineContextRef = useRef(null); // 実行中のエンジンコンテキスト

  // --- FontAwesomeの読み込み ---
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // --- ログ出力の補助関数 ---
  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg: String(msg), type }]);
  };

  // --- ファイルアップロード処理 ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const name = file.name.split('.')[0]; // 拡張子を抜いた名前
    const id = Date.now().toString();

    if (uploadTypeRef.current === 'costume') {
      setCostumes(prev => [...prev, { id, name, src: url }]);
    } else {
      setSounds(prev => [...prev, { id, name, src: url }]);
    }
    e.target.value = ''; // リセット
  };

  const triggerUpload = (type) => {
    uploadTypeRef.current = type;
    fileInputRef.current.accept = type === 'costume' ? 'image/*' : 'audio/*';
    fileInputRef.current.click();
  };

  // --- エディタの入力制御（Tabキーでインデント） ---
  const handleEditorKeyDown = (e, fileId) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newText = val.substring(0, start) + "  " + val.substring(end);
      
      handleEditorChange(fileId, newText);
      
      // カーソル位置を戻す
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleEditorChange = (fileId, newContent) => {
    setScripts(prev => prev.map(s => s.id === fileId ? { ...s, content: newContent } : s));
  };

  // --- ゲームエンジンの実行・停止 ---
  const stopGame = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (engineContextRef.current) {
      window.removeEventListener('keydown', engineContextRef.current.handlers.keydown);
      window.removeEventListener('keyup', engineContextRef.current.handlers.keyup);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.removeEventListener('mousedown', engineContextRef.current.handlers.mousedown);
        canvas.removeEventListener('mouseup', engineContextRef.current.handlers.mouseup);
        canvas.removeEventListener('mousemove', engineContextRef.current.handlers.mousemove);
      }
    }
    setIsRunning(false);
  };

  const startGame = async () => {
    stopGame();
    setLogs([]);
    addLog('ゲームをロード中...');

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // リソースのプリロード
    const loadedImages = {};
    for (const c of costumes) {
      const img = new Image();
      img.src = c.src;
      await new Promise(r => img.onload = r);
      loadedImages[c.name] = img;
    }

    const loadedSounds = {};
    for (const s of sounds) {
      loadedSounds[s.name] = new Audio(s.src);
    }

    // 入力状態
    const keys = {};
    const mouse = { x: 0, y: 0, isDown: false };

    const keydownHandler = (e) => { keys[e.code] = true; };
    const keyupHandler = (e) => { keys[e.code] = false; };
    const mousedownHandler = (e) => { mouse.isDown = true; };
    const mouseupHandler = (e) => { mouse.isDown = false; };
    const mousemoveHandler = (e) => {
      const rect = canvas.getBoundingClientRect();
      // キャンバスの実際の解像度(800x600)と表示サイズの比率を計算
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mouse.x = (e.clientX - rect.left) * scaleX;
      mouse.y = (e.clientY - rect.top) * scaleY;
    };

    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keyup', keyupHandler);
    canvas.addEventListener('mousedown', mousedownHandler);
    canvas.addEventListener('mouseup', mouseupHandler);
    canvas.addEventListener('mousemove', mousemoveHandler);

    engineContextRef.current = {
      handlers: { keydown: keydownHandler, keyup: keyupHandler, mousedown: mousedownHandler, mouseup: mouseupHandler, mousemove: mousemoveHandler }
    };

    let userUpdate = null;

    // --- API定義 ---
    const Engine = {
      clear: (color = '#000') => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      },
      draw: (name, x, y, width, height, angle = 0) => {
        const img = loadedImages[name];
        if (!img) return;
        ctx.save();
        ctx.translate(x, y); // 中央基準ではなく指定座標に描画
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
      },
      drawText: (text, x, y, size = 20, color = '#fff') => {
        ctx.fillStyle = color;
        ctx.font = `${size}px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;
        ctx.fillText(text, x, y);
      },
      play: (name, volume = 1.0, loop = false) => {
        const bgm = loadedSounds[name];
        if (!bgm) return;
        const soundClone = bgm.cloneNode();
        soundClone.volume = volume;
        soundClone.loop = loop;
        soundClone.play().catch(e => addLog(`Sound Error: ${e.message}`, 'error'));
      },
      setUpdate: (fn) => { userUpdate = fn; },
      Input: {
        getKey: (code) => !!keys[code],
        getMouse: () => ({ ...mouse })
      },
      log: (msg) => addLog(msg)
    };

    // ユーザーコードの結合と評価
    const fullCode = scripts.map(s => s.content).join('\n\n');
    try {
      // ユーザーコードに Engine を渡して実行
      const initFunc = new Function('Engine', fullCode);
      initFunc(Engine);
      addLog('起動完了！', 'success');
      setIsRunning(true);
    } catch (e) {
      addLog(`コンパイルエラー: ${e.message}`, 'error');
      return;
    }

    // メインループ
    let lastTime = performance.now();
    const loop = (time) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (userUpdate) {
        try {
          userUpdate(dt);
        } catch (e) {
          addLog(`実行時エラー: ${e.message}`, 'error');
          stopGame();
          return;
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  // --- 描画ユーティリティ ---
  const activeScript = scripts.find(s => s.id === activeFile.id);
  const activeCostume = costumes.find(c => c.id === activeFile.id);
  const activeSound = sounds.find(s => s.id === activeFile.id);

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-200 font-sans overflow-hidden">
      {/* 隠しファイル入力 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileUpload} 
      />

      {/* --- 左ペイン：ツリー --- */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700 flex items-center gap-2 text-emerald-400 font-bold text-lg">
          <i className="fas fa-gamepad"></i> <span>2D Engine</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {/* スクリプト */}
          <div className="mb-4">
            <div className="flex justify-between items-center text-xs text-slate-400 uppercase font-bold px-2 mb-2">
              <span>Scripts</span>
              <button 
                onClick={() => setScripts([...scripts, { id: Date.now().toString(), name: `script_${scripts.length + 1}`, content: '' }])}
                className="hover:text-white transition-colors"><i className="fas fa-plus"></i></button>
            </div>
            {scripts.map(s => (
              <div 
                key={s.id} 
                onClick={() => setActiveFile({ type: 'script', id: s.id })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${activeFile.id === s.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-700/50 text-slate-300'}`}
              >
                <i className="fab fa-js text-yellow-400 w-4"></i>
                <span className="truncate flex-1 text-sm">{s.name}.js</span>
              </div>
            ))}
          </div>

          {/* コスチューム */}
          <div className="mb-4">
            <div className="flex justify-between items-center text-xs text-slate-400 uppercase font-bold px-2 mb-2">
              <span>Costumes</span>
              <button onClick={() => triggerUpload('costume')} className="hover:text-white transition-colors"><i className="fas fa-plus"></i></button>
            </div>
            {costumes.map(c => (
              <div 
                key={c.id} 
                onClick={() => setActiveFile({ type: 'costume', id: c.id })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${activeFile.id === c.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-700/50 text-slate-300'}`}
              >
                <i className="fas fa-image text-purple-400 w-4"></i>
                <span className="truncate flex-1 text-sm">{c.name}</span>
              </div>
            ))}
          </div>

          {/* サウンド */}
          <div className="mb-4">
            <div className="flex justify-between items-center text-xs text-slate-400 uppercase font-bold px-2 mb-2">
              <span>Sounds</span>
              <button onClick={() => triggerUpload('sound')} className="hover:text-white transition-colors"><i className="fas fa-plus"></i></button>
            </div>
            {sounds.map(s => (
              <div 
                key={s.id} 
                onClick={() => setActiveFile({ type: 'sound', id: s.id })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${activeFile.id === s.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-700/50 text-slate-300'}`}
              >
                <i className="fas fa-music text-pink-400 w-4"></i>
                <span className="truncate flex-1 text-sm">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- 中央ペイン：コードエディタ --- */}
      <div className="flex-1 flex flex-col bg-[#1e1e1e]">
        <div className="h-12 bg-[#252526] border-b border-[#3c3c3c] flex items-center px-4 text-sm font-medium">
          {activeFile.type === 'script' && <><i className="fab fa-js text-yellow-400 mr-2"></i> {activeScript?.name}.js</>}
          {activeFile.type === 'costume' && <><i className="fas fa-image text-purple-400 mr-2"></i> {activeCostume?.name}</>}
          {activeFile.type === 'sound' && <><i className="fas fa-music text-pink-400 mr-2"></i> {activeSound?.name}</>}
        </div>
        
        <div className="flex-1 relative">
          {activeFile.type === 'script' && activeScript && (
            <textarea
              value={activeScript.content}
              onChange={(e) => handleEditorChange(activeScript.id, e.target.value)}
              onKeyDown={(e) => handleEditorKeyDown(e, activeScript.id)}
              spellCheck="false"
              className="absolute inset-0 w-full h-full bg-transparent text-[#d4d4d4] p-4 font-mono text-[15px] leading-relaxed resize-none focus:outline-none placeholder-slate-600"
              placeholder="// ここにコードを書いてね..."
            />
          )}
          {activeFile.type === 'costume' && activeCostume && (
            <div className="flex items-center justify-center w-full h-full bg-slate-900/50">
              <img src={activeCostume.src} alt={activeCostume.name} className="max-w-xs max-h-xs object-contain border-2 border-dashed border-slate-600 p-2 rounded" />
            </div>
          )}
          {activeFile.type === 'sound' && activeSound && (
            <div className="flex items-center justify-center w-full h-full bg-slate-900/50">
              <audio controls src={activeSound.src} className="w-64" />
            </div>
          )}
        </div>
      </div>

      {/* --- 右ペイン：プレビュー＆コンソール --- */}
      <div className="w-[450px] bg-slate-950 flex flex-col border-l border-slate-800">
        <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <span className="font-bold text-sm text-slate-300">Preview</span>
          <div className="flex gap-2">
            {!isRunning ? (
              <button onClick={startGame} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors">
                <i className="fas fa-play"></i> Run
              </button>
            ) : (
              <button onClick={stopGame} className="bg-rose-500 hover:bg-rose-400 text-white px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-colors">
                <i className="fas fa-stop"></i> Stop
              </button>
            )}
          </div>
        </div>
        
        {/* キャンバスエリア（アスペクト比固定 4:3 の 800x600 キャンバス） */}
        <div className="p-4 flex-1 flex flex-col">
          <div className="w-full aspect-[4/3] bg-black rounded shadow-lg overflow-hidden border border-slate-800 relative">
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={600} 
              className="w-full h-full block"
            />
          </div>

          {/* ログコンソール */}
          <div className="mt-4 flex-1 bg-slate-900 rounded border border-slate-800 flex flex-col overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-800 text-xs font-bold text-slate-400 flex items-center gap-2">
              <i className="fas fa-terminal"></i> Console
            </div>
            <div className="flex-1 p-2 overflow-y-auto text-xs font-mono space-y-1">
              {logs.length === 0 && <div className="text-slate-600">No logs yet...</div>}
              {logs.map((log, i) => (
                <div key={i} className={`
                  ${log.type === 'error' ? 'text-rose-400' : ''}
                  ${log.type === 'success' ? 'text-emerald-400' : ''}
                  ${log.type === 'info' ? 'text-slate-300' : ''}
                `}>
                  <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  {log.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
