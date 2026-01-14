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
let inTrueEnd = false;
let isSecretEndPrompt = false;
let isSecretEndPromptQueued = false;
const SOUND_DISABLED = true;
const TRUE_END_MARKER = '【TRUE END';
const END_MARKER = '【END】';

// BGM/SE管理
let bgmAudio = null;
let currentBgm = null;

// 履歴とログ
let textLog = [];
let readScenes = new Set();

// プレイヤー名
let playerName = '主人公';

// フラグ管理（SECRET END条件）
let flags = {
    coop: false,
    pinch: false,
    needMoreInfo: false,
    suspectMiyuki: false,
    didNotGetAlternativeNormal: true
};

// 設定
let settings = {
    bgmVolume: 70,
    seVolume: 80,
    muteBgm: false,
    muteSe: false,
    debugMode: false
};

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 設定をロード
    loadSettings();

    // フラグをロード
    loadFlags();

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
        const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
        const storyUrl = new URL(`${basePath}story.json`, window.location.origin);
        const response = await fetch(storyUrl.toString());
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
    document.getElementById('debugMode').addEventListener('change', toggleDebugMode);
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
        stopAllAudio();
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
    stopAllAudio();
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

    // デバッグ表示を更新
    updateDebugDisplay();

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

            if (textData.type === 'system') {
                if (text.includes(TRUE_END_MARKER)) {
                    inTrueEnd = true;
                }

                if (text.includes(END_MARKER)) {
                    if (inTrueEnd && checkSecretEndConditions()) {
                        if (!isSecretEndPrompt && !isSecretEndPromptQueued) {
                            isSecretEndPromptQueued = true;
                            setTimeout(() => {
                                showSecretEndPrompt();
                            }, 800);
                        }
                        return;
                    }

                    inTrueEnd = false;
                }
            }

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

    if (isChoicesVisible()) {
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
    isSecretEndPrompt = false;
    isSecretEndPromptQueued = false;

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
    isSecretEndPrompt = false;
    isSecretEndPromptQueued = false;
}

function selectChoice(choice) {
    hideChoices();

    // フラグ管理（SECRET END条件）
    trackChoiceFlags(currentScene.id, choice.nextScene, choice.label);

    // テキストエリアをクリア
    document.getElementById('textArea').innerHTML = '';

    // 次のシーンへ
    if (choice.nextScene) {
        loadScene(choice.nextScene);
    }
}

function isChoicesVisible() {
    return !document.getElementById('choicesArea').classList.contains('hidden');
}

function showSecretEndPrompt() {
    const choicesArea = document.getElementById('choicesArea');
    choicesArea.innerHTML = '';
    choicesArea.classList.remove('hidden');
    isSecretEndPrompt = true;
    isSecretEndPromptQueued = false;

    if (autoMode) {
        autoMode = false;
        document.getElementById('autoBtn').classList.remove('active');
    }

    if (skipMode) {
        skipMode = false;
        document.getElementById('skipBtn').classList.remove('active');
    }

    const secretButton = document.createElement('button');
    secretButton.className = 'choice-btn';
    secretButton.textContent = '真相へ進む';
    secretButton.addEventListener('click', () => {
        inTrueEnd = false;
        document.getElementById('textArea').innerHTML = '';
        hideChoices();
        loadScene('secret_end_scene');
    });
    choicesArea.appendChild(secretButton);

    const titleButton = document.createElement('button');
    titleButton.className = 'choice-btn';
    titleButton.textContent = 'タイトルへ戻る';
    titleButton.addEventListener('click', () => {
        inTrueEnd = false;
        hideChoices();
        restartGame();
    });
    choicesArea.appendChild(titleButton);
}

// ========================================
// フラグ追跡（SECRET END条件）
// ========================================
function trackChoiceFlags(sceneId, nextScene, label) {
    // chapter2_scene5で「もちろんだ、一緒に調べよう」を選択
    if (sceneId === 'chapter2_scene5' && nextScene === 'route_a_scene6') {
        setFlag('coop', true);
    }

    // route_a_scene7で「挟み撃ち」を選択
    if (sceneId === 'route_a_scene7' && nextScene === 'route_a2_continuation') {
        setFlag('pinch', true);
    }

    // route_a2_continuationで「まだ判断できない、もっと情報が必要だ」を選択
    if (sceneId === 'route_a2_continuation' && label && label.includes('まだ判断できない')) {
        setFlag('needMoreInfo', true);
    }

    // chapter3_scene8で「あなた、何か隠していませんか？」を選択
    if (sceneId === 'chapter3_scene8' && nextScene === 'route_b_scene1') {
        setFlag('suspectMiyuki', true);
    }

    // chapter3_scene9_alternativeに入ったらフラグをfalseに
    if (nextScene === 'chapter3_scene9_alternative') {
        setFlag('didNotGetAlternativeNormal', false);
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
    if (SOUND_DISABLED) return;
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
    if (SOUND_DISABLED) return;
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

function toggleDebugMode(e) {
    settings.debugMode = e.target.checked;
    saveSettings();
    updateDebugDisplay();
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

    stopAllAudio();

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

    // デバッグモードのチェックボックス状態を更新
    const debugCheckbox = document.getElementById('debugMode');
    if (debugCheckbox) {
        debugCheckbox.checked = settings.debugMode || false;
    }
}

// ========================================
// デバッグ表示
// ========================================
function updateDebugDisplay() {
    const debugInfo = document.getElementById('debugInfo');
    if (!debugInfo) return;

    if (settings.debugMode && currentScene) {
        const flagsStr = `coop:${flags.coop?'✓':'✗'} pinch:${flags.pinch?'✓':'✗'} info:${flags.needMoreInfo?'✓':'✗'} suspect:${flags.suspectMiyuki?'✓':'✗'} noAlt:${flags.didNotGetAlternativeNormal?'✓':'✗'}`;
        debugInfo.textContent = `DEBUG: scene=${currentScene.id} | ${flagsStr}`;
        debugInfo.classList.remove('hidden');
    } else {
        debugInfo.classList.add('hidden');
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

// ========================================
// フラグの保存・読み込み
// ========================================
function saveFlags() {
    localStorage.setItem('soundNovelFlags', JSON.stringify(flags));
}

function loadFlags() {
    const savedFlags = localStorage.getItem('soundNovelFlags');
    if (savedFlags) {
        try {
            flags = JSON.parse(savedFlags);
        } catch (error) {
            console.error('Failed to load flags:', error);
        }
    }
}

function setFlag(flagName, value) {
    flags[flagName] = value;
    saveFlags();
    updateDebugDisplay();
}

function checkSecretEndConditions() {
    return flags.coop &&
           flags.pinch &&
           flags.needMoreInfo &&
           flags.suspectMiyuki &&
           flags.didNotGetAlternativeNormal;
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

function stopAllAudio() {
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
        bgmAudio = null;
    }

    currentBgm = null;

    document.querySelectorAll('audio').forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
}
