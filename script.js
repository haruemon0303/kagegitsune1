// ========================================
// グローバル変数
// ========================================
let storyData = null;
let currentScene = null;
let currentTextIndex = 0;
let isTyping = false;
let autoMode = false;
let skipMode = false;
let audioEnabled = false;

// BGM/SE管理
let bgmAudio = null;
let currentBgm = null;

// 履歴とログ
let textLog = [];
let readScenes = new Set();

// プレイヤー名
let playerName = '主人公';

// 設定
let settings = {
    bgmVolume: 70,
    seVolume: 80,
    muteBgm: false,
    muteSe: false
};

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 設定をロード
    loadSettings();

    // ストーリーデータをロード
    await loadStoryData();

    // イベントリスナーを設定
    setupEventListeners();

    // 初回タップオーバーレイを表示
    showTapOverlay();
});

// ========================================
// ストーリーデータのロード
// ========================================
async function loadStoryData() {
    try {
        const response = await fetch('story.json');
        storyData = await response.json();
        console.log('Story data loaded:', storyData);
    } catch (error) {
        console.error('Failed to load story data:', error);
        alert('ストーリーデータの読み込みに失敗しました');
    }
}

// ========================================
// イベントリスナーの設定
// ========================================
function setupEventListeners() {
    // ヘッダーボタン
    document.getElementById('menuBtn').addEventListener('click', showMenu);
    document.getElementById('settingsBtn').addEventListener('click', showSettings);

    // テキストエリアをタップで次へ
    document.getElementById('textArea').addEventListener('click', handleTextAreaClick);

    // テキストボックスコントロール
    document.getElementById('logBtn').addEventListener('click', showLog);
    document.getElementById('autoBtn').addEventListener('click', toggleAuto);
    document.getElementById('skipBtn').addEventListener('click', toggleSkip);

    // メニューパネル
    document.getElementById('saveBtn').addEventListener('click', saveGame);
    document.getElementById('loadBtn').addEventListener('click', loadGame);
    document.getElementById('changeNameBtn').addEventListener('click', showNameInput);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('closeMenuBtn').addEventListener('click', hideMenu);

    // 名前入力
    document.getElementById('confirmNameBtn').addEventListener('click', confirmPlayerName);

    // 設定パネル
    document.getElementById('bgmVolume').addEventListener('input', updateBgmVolume);
    document.getElementById('seVolume').addEventListener('input', updateSeVolume);
    document.getElementById('muteBgm').addEventListener('change', toggleMuteBgm);
    document.getElementById('muteSe').addEventListener('change', toggleMuteSe);
    document.getElementById('closeSettingsBtn').addEventListener('click', hideSettings);

    // ログパネル
    document.getElementById('closeLogBtn').addEventListener('click', hideLog);
}

// ========================================
// 初回タップオーバーレイ
// ========================================
function showTapOverlay() {
    const overlay = document.getElementById('tapToStart');
    overlay.addEventListener('click', () => {
        overlay.classList.add('hidden');
        enableAudio();

        // プレイヤー名をロード
        loadPlayerName();

        // 名前が保存されていない場合は入力パネルを表示
        if (!localStorage.getItem('soundNovelPlayerName')) {
            showNameInputPanel();
        } else {
            document.getElementById('gameContainer').classList.remove('hidden');
            startGame();
        }
    });
}

function enableAudio() {
    audioEnabled = true;
    // iOS対策：ユーザー操作後に音声を有効化
    const dummyAudio = new Audio();
    dummyAudio.play().catch(() => {});
}

// ========================================
// ゲーム開始
// ========================================
function startGame() {
    if (!storyData) {
        console.error('Story data not loaded');
        return;
    }

    // 最初のシーンを開始
    loadScene(storyData.startScene || 'opening');
}

// ========================================
// シーンのロード
// ========================================
function loadScene(sceneId) {
    const scene = storyData.scenes[sceneId];
    if (!scene) {
        console.error('Scene not found:', sceneId);
        return;
    }

    currentScene = scene;
    currentScene.id = sceneId;
    currentTextIndex = 0;

    // 既読フラグを設定
    readScenes.add(sceneId);

    // 背景を設定
    setBackground(scene.background);

    // シルエットを設定
    setSilhouette(scene.silhouette);

    // BGMを再生
    if (scene.bgm) {
        playBgm(scene.bgm);
    }

    // 選択肢エリアを非表示
    hideChoices();

    // テキスト表示を開始
    showNextText();
}

// ========================================
// 背景の設定
// ========================================
function setBackground(bgId) {
    const bgElement = document.getElementById('background');
    if (bgId && storyData.backgrounds[bgId]) {
        bgElement.style.backgroundImage = `url(${storyData.backgrounds[bgId]})`;
    } else {
        bgElement.style.backgroundImage = '';
    }
}

// ========================================
// シルエットの設定
// ========================================
function setSilhouette(silId) {
    const silElement = document.getElementById('silhouette');
    if (silId && storyData.silhouettes && storyData.silhouettes[silId]) {
        silElement.style.backgroundImage = `url(${storyData.silhouettes[silId]})`;
        silElement.classList.add('show');
    } else {
        silElement.classList.remove('show');
        silElement.style.backgroundImage = '';
    }
}

// ========================================
// テキスト表示
// ========================================
function showNextText() {
    if (currentTextIndex >= currentScene.text.length) {
        // すべてのテキストを表示し終えた
        if (currentScene.choices && currentScene.choices.length > 0) {
            // 選択肢を表示
            showChoices();
        } else if (currentScene.next) {
            // 次のシーンへ自動遷移
            setTimeout(() => loadScene(currentScene.next), 1000);
        }
        return;
    }

    const textData = currentScene.text[currentTextIndex];

    // 演出を実行
    if (textData.effect) {
        executeEffect(textData.effect);
    }

    // SEを再生
    if (textData.se) {
        playSe(textData.se);
    }

    // テキストを表示
    displayText(textData);

    currentTextIndex++;
}

// ========================================
// テキスト表示（タイプライター風）
// ========================================
function displayText(textData) {
    const textArea = document.getElementById('textArea');
    const lineDiv = document.createElement('div');
    lineDiv.className = `text-line text-${textData.type || 'narration'}`;
    textArea.appendChild(lineDiv);

    // ログに追加（置換後のテキストで）
    const replacedText = replacePlayerName(textData.text);
    addToLog({ ...textData, text: replacedText });

    // タイプライター表示
    isTyping = true;
    const text = replacedText;
    let charIndex = 0;

    const typeInterval = setInterval(() => {
        if (charIndex < text.length) {
            lineDiv.textContent += text[charIndex];
            charIndex++;

            // タイプ中もスクロール追従
            textArea.scrollTop = textArea.scrollHeight;
        } else {
            clearInterval(typeInterval);
            isTyping = false;

            // オートモード時は自動で次へ
            if (autoMode) {
                setTimeout(() => {
                    if (autoMode) showNextText();
                }, 1500);
            }

            // スキップモード時は即座に次へ
            if (skipMode && readScenes.has(currentScene.id)) {
                setTimeout(() => {
                    if (skipMode) showNextText();
                }, 100);
            }
        }
    }, 50);

    // スクロールを最下部へ
    textArea.scrollTop = textArea.scrollHeight;
}

// ========================================
// テキストエリアクリック処理
// ========================================
function handleTextAreaClick() {
    if (isTyping) {
        // タイピング中ならスキップ（全文表示）
        return;
    }

    // 次のテキストへ
    showNextText();
}

// ========================================
// 選択肢の表示
// ========================================
function showChoices() {
    const choicesArea = document.getElementById('choicesArea');
    choicesArea.innerHTML = '';
    choicesArea.classList.remove('hidden');

    currentScene.choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.className = 'choice-btn';
        button.textContent = replacePlayerName(choice.label);
        button.style.animationDelay = `${index * 0.1}s`;
        button.addEventListener('click', () => selectChoice(choice));
        choicesArea.appendChild(button);
    });
}

function hideChoices() {
    const choicesArea = document.getElementById('choicesArea');
    choicesArea.classList.add('hidden');
    choicesArea.innerHTML = '';
}

function selectChoice(choice) {
    hideChoices();

    // テキストエリアをクリア
    document.getElementById('textArea').innerHTML = '';

    // 次のシーンへ
    if (choice.nextScene) {
        loadScene(choice.nextScene);
    }
}

// ========================================
// 演出の実行
// ========================================
function executeEffect(effect) {
    const stage = document.querySelector('.stage');
    const flash = document.getElementById('flash');
    const noise = document.getElementById('noise');

    switch (effect) {
        case 'flash':
            flash.classList.add('flash');
            setTimeout(() => flash.classList.remove('flash'), 500);
            break;
        case 'shake':
            stage.classList.add('shake');
            setTimeout(() => stage.classList.remove('shake'), 500);
            break;
        case 'noise':
            noise.classList.add('noise');
            setTimeout(() => noise.classList.remove('noise'), 2000);
            break;
    }
}

// ========================================
// BGM管理
// ========================================
function playBgm(bgmId) {
    if (bgmId === currentBgm) return;

    // 既存のBGMを停止
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio = null;
    }

    if (!bgmId || !storyData.bgm[bgmId]) return;

    currentBgm = bgmId;
    bgmAudio = new Audio(storyData.bgm[bgmId]);
    bgmAudio.loop = true;
    bgmAudio.volume = settings.muteBgm ? 0 : settings.bgmVolume / 100;

    if (audioEnabled) {
        bgmAudio.play().catch(err => console.log('BGM play failed:', err));
    }
}

function playSe(seId) {
    if (!seId || !storyData.se[seId]) return;
    if (settings.muteSe) return;

    const se = new Audio(storyData.se[seId]);
    se.volume = settings.seVolume / 100;

    if (audioEnabled) {
        se.play().catch(err => console.log('SE play failed:', err));
    }
}

// ========================================
// ログ管理
// ========================================
function addToLog(textData) {
    textLog.push({
        type: textData.type || 'narration',
        text: textData.text
    });
}

function showLog() {
    const logContent = document.getElementById('logContent');
    logContent.innerHTML = '';

    textLog.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.className = `log-entry text-${entry.type}`;
        entryDiv.textContent = entry.text;
        logContent.appendChild(entryDiv);
    });

    document.getElementById('logPanel').classList.remove('hidden');

    // スクロールを最下部へ
    logContent.scrollTop = logContent.scrollHeight;
}

function hideLog() {
    document.getElementById('logPanel').classList.add('hidden');
}

// ========================================
// オート・スキップ
// ========================================
function toggleAuto() {
    autoMode = !autoMode;
    const btn = document.getElementById('autoBtn');
    btn.classList.toggle('active', autoMode);

    if (autoMode) {
        skipMode = false;
        document.getElementById('skipBtn').classList.remove('active');

        if (!isTyping) {
            setTimeout(() => {
                if (autoMode) showNextText();
            }, 1500);
        }
    }
}

function toggleSkip() {
    skipMode = !skipMode;
    const btn = document.getElementById('skipBtn');
    btn.classList.toggle('active', skipMode);

    if (skipMode) {
        autoMode = false;
        document.getElementById('autoBtn').classList.remove('active');

        // 既読シーンのみスキップ
        if (!isTyping && readScenes.has(currentScene.id)) {
            setTimeout(() => {
                if (skipMode) showNextText();
            }, 100);
        }
    }
}

// ========================================
// メニュー
// ========================================
function showMenu() {
    document.getElementById('menuPanel').classList.remove('hidden');
}

function hideMenu() {
    document.getElementById('menuPanel').classList.add('hidden');
}

// ========================================
// 設定
// ========================================
function showSettings() {
    // 現在の設定値をUIに反映
    document.getElementById('bgmVolume').value = settings.bgmVolume;
    document.getElementById('bgmVolumeValue').textContent = settings.bgmVolume;
    document.getElementById('seVolume').value = settings.seVolume;
    document.getElementById('seVolumeValue').textContent = settings.seVolume;
    document.getElementById('muteBgm').checked = settings.muteBgm;
    document.getElementById('muteSe').checked = settings.muteSe;

    document.getElementById('settingsPanel').classList.remove('hidden');
}

function hideSettings() {
    document.getElementById('settingsPanel').classList.add('hidden');
    saveSettings();
}

function updateBgmVolume(e) {
    settings.bgmVolume = parseInt(e.target.value);
    document.getElementById('bgmVolumeValue').textContent = settings.bgmVolume;

    if (bgmAudio && !settings.muteBgm) {
        bgmAudio.volume = settings.bgmVolume / 100;
    }
}

function updateSeVolume(e) {
    settings.seVolume = parseInt(e.target.value);
    document.getElementById('seVolumeValue').textContent = settings.seVolume;
}

function toggleMuteBgm(e) {
    settings.muteBgm = e.target.checked;

    if (bgmAudio) {
        bgmAudio.volume = settings.muteBgm ? 0 : settings.bgmVolume / 100;
    }
}

function toggleMuteSe(e) {
    settings.muteSe = e.target.checked;
}

// ========================================
// セーブ・ロード
// ========================================
function saveGame() {
    const saveData = {
        sceneId: currentScene.id,
        textIndex: currentTextIndex,
        readScenes: Array.from(readScenes),
        timestamp: new Date().toISOString()
    };

    localStorage.setItem('soundNovelSave', JSON.stringify(saveData));
    alert('セーブしました');
    hideMenu();
}

function loadGame() {
    const saveDataStr = localStorage.getItem('soundNovelSave');
    if (!saveDataStr) {
        alert('セーブデータがありません');
        return;
    }

    try {
        const saveData = JSON.parse(saveDataStr);
        readScenes = new Set(saveData.readScenes || []);

        // テキストログをクリア
        textLog = [];
        document.getElementById('textArea').innerHTML = '';

        // シーンをロード
        currentTextIndex = 0;  // 最初から表示
        loadScene(saveData.sceneId);

        hideMenu();
        alert('ロードしました');
    } catch (error) {
        console.error('Load failed:', error);
        alert('ロードに失敗しました');
    }
}

function restartGame() {
    if (!confirm('最初からやり直しますか？')) return;

    // すべてのデータをクリア
    textLog = [];
    readScenes = new Set();
    currentTextIndex = 0;
    autoMode = false;
    skipMode = false;

    document.getElementById('textArea').innerHTML = '';
    document.getElementById('autoBtn').classList.remove('active');
    document.getElementById('skipBtn').classList.remove('active');

    hideMenu();
    startGame();
}

// ========================================
// 設定の保存・読み込み
// ========================================
function saveSettings() {
    localStorage.setItem('soundNovelSettings', JSON.stringify(settings));
}

function loadSettings() {
    const settingsStr = localStorage.getItem('soundNovelSettings');
    if (settingsStr) {
        try {
            settings = JSON.parse(settingsStr);
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
}

// ========================================
// プレイヤー名の保存・読み込み
// ========================================
function savePlayerName() {
    localStorage.setItem('soundNovelPlayerName', playerName);
}

function loadPlayerName() {
    const savedName = localStorage.getItem('soundNovelPlayerName');
    if (savedName) {
        playerName = savedName;
    }
}

function showNameInputPanel() {
    const panel = document.getElementById('nameInputPanel');
    const input = document.getElementById('playerNameInput');
    input.value = playerName;
    panel.classList.remove('hidden');
}

function hideNameInputPanel() {
    document.getElementById('nameInputPanel').classList.add('hidden');
}

function confirmPlayerName() {
    const input = document.getElementById('playerNameInput');
    const name = input.value.trim();

    if (!name) {
        alert('名前を入力してください');
        return;
    }

    if (name.length > 8) {
        alert('名前は8文字以内で入力してください');
        return;
    }

    playerName = name;
    savePlayerName();
    hideNameInputPanel();

    // ゲームコンテナを表示してゲーム開始
    if (document.getElementById('gameContainer').classList.contains('hidden')) {
        document.getElementById('gameContainer').classList.remove('hidden');
        startGame();
    }
}

function showNameInput() {
    hideMenu();
    showNameInputPanel();
}

// テキストの置換処理
function replacePlayerName(text) {
    if (!text) return text;
    return text.replace(/主人公名/g, playerName);
}
