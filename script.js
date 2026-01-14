// ========================================
// Global State
// ========================================
let storyData = null;
let currentScene = null;
let currentTextIndex = 0;

let isTyping = false;
let autoMode = false;
let skipMode = false;

let audioEnabled = false;
const SOUND_DISABLED = false;

// SECRET / TRUE END prompt
let inTrueEnd = false;
let isSecretEndPrompt = false;
let isSecretEndPromptQueued = false;
const TRUE_END_MARKER = '【TRUE END';
const END_MARKER = '【END】';

// Logs / read markers
let textLog = [];
let readScenes = new Set();

// Player name
let playerName = '主人公';

// SECRET flags
let flags = {
  coop: false,
  pinch: false,
  needMoreInfo: false,
  suspectMiyuki: false,
  didNotGetAlternativeNormal: true
};

// Settings
let settings = {
  bgmVolume: 70,
  seVolume: 80,
  muteBgm: false,
  muteSe: false,
  debugMode: false
};

// ========================================
// WebAudio (generated placeholder audio)
// ========================================
let audioContext = null;
let bgmGainNode = null;
let seGainNode = null;
let currentBgm = null;

// Keep references so we can stop them
let bgmNodes = [];
let seNodes = [];

// ========================================
// Init
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  loadFlags();

  await loadStoryData();
  setupEventListeners();

  showTapOverlay();
});

// ========================================
// Load story.json
// ========================================
async function loadStoryData() {
  try {
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
    const storyUrl = new URL(`${basePath}story.json`, window.location.origin);
    const response = await fetch(storyUrl.toString(), { cache: 'no-store' });
    storyData = await response.json();
    console.log('Story data loaded:', storyData);
  } catch (error) {
    console.error('Failed to load story data:', error);
    alert('ストーリーデータの読み込みに失敗しました');
  }
}

// ========================================
// Event listeners
// ========================================
function setupEventListeners() {
  // Header
  document.getElementById('menuBtn')?.addEventListener('click', showMenu);
  document.getElementById('settingsBtn')?.addEventListener('click', showSettings);

  // Tap text area -> next
  document.getElementById('textArea')?.addEventListener('click', handleTextAreaClick);

  // Controls
  document.getElementById('logBtn')?.addEventListener('click', showLog);
  document.getElementById('autoBtn')?.addEventListener('click', toggleAuto);
  document.getElementById('skipBtn')?.addEventListener('click', toggleSkip);

  // Menu panel
  document.getElementById('saveBtn')?.addEventListener('click', saveGame);
  document.getElementById('loadBtn')?.addEventListener('click', loadGame);
  document.getElementById('changeNameBtn')?.addEventListener('click', showNameInput);
  document.getElementById('restartBtn')?.addEventListener('click', restartGame);
  document.getElementById('closeMenuBtn')?.addEventListener('click', hideMenu);

  // Name input
  document.getElementById('confirmNameBtn')?.addEventListener('click', confirmPlayerName);

  // Settings
  document.getElementById('bgmVolume')?.addEventListener('input', updateBgmVolume);
  document.getElementById('seVolume')?.addEventListener('input', updateSeVolume);
  document.getElementById('muteBgm')?.addEventListener('change', toggleMuteBgm);
  document.getElementById('muteSe')?.addEventListener('change', toggleMuteSe);
  document.getElementById('debugMode')?.addEventListener('change', toggleDebugMode);
  document.getElementById('closeSettingsBtn')?.addEventListener('click', hideSettings);

  // Log
  document.getElementById('closeLogBtn')?.addEventListener('click', hideLog);
}

// ========================================
// Tap-to-start overlay
// ========================================
function showTapOverlay() {
  const overlay = document.getElementById('tapToStart');
  if (!overlay) return;

  overlay.addEventListener('click', async () => {
    overlay.classList.add('hidden');

    // Stop any leftover audio just in case
    stopAllAudio();

    // Enable audio (iOS needs user gesture)
    await enableAudio();

    // Load player name
    loadPlayerName();

    if (!localStorage.getItem('soundNovelPlayerName')) {
      showNameInputPanel();
    } else {
      document.getElementById('gameContainer')?.classList.remove('hidden');
      startGame();
    }
  }, { once: true });
}

async function enableAudio() {
  if (SOUND_DISABLED) {
    audioEnabled = false;
    return;
  }

  initAudioContext();

  // If WebAudio available, resume for iOS
  if (audioContext) {
    try {
      await audioContext.resume();
      audioEnabled = true;
    } catch (e) {
      console.warn('AudioContext resume failed:', e);
      audioEnabled = false;
    }
  } else {
    // Fallback: allow “no audio context” state
    audioEnabled = true;
  }
}

// ========================================
// Start game
// ========================================
function startGame() {
  if (!storyData) {
    console.error('Story data not loaded');
    return;
  }

  // Reset scene state
  document.getElementById('textArea').innerHTML = '';
  hideChoices();

  loadScene(storyData.startScene || 'opening');
}

// ========================================
// Load scene
// ========================================
function loadScene(sceneId) {
  // Do NOT kill everything; stop only BGM so SE can still play normally
  stopBgmOnly();

  const scene = storyData?.scenes?.[sceneId];
  if (!scene) {
    console.error('Scene not found:', sceneId);
    return;
  }

  currentScene = scene;
  currentScene.id = sceneId;
  currentTextIndex = 0;

  readScenes.add(sceneId);

  setBackground(scene.background);
  setSilhouette(scene.silhouette);

  if (scene.bgm) playBgm(scene.bgm);

  hideChoices();
  updateDebugDisplay();
  showNextText();
}

// ========================================
// Background / silhouette
// ========================================
function setBackground(bgId) {
  const bgElement = document.getElementById('background');
  if (!bgElement) return;

  if (bgId && storyData?.backgrounds?.[bgId]) {
    bgElement.style.backgroundImage = `url(${storyData.backgrounds[bgId]})`;
  } else {
    bgElement.style.backgroundImage = '';
  }
}

function setSilhouette(silId) {
  const silElement = document.getElementById('silhouette');
  if (!silElement) return;

  if (silId && storyData?.silhouettes?.[silId]) {
    silElement.style.backgroundImage = `url(${storyData.silhouettes[silId]})`;
    silElement.classList.add('show');
  } else {
    silElement.classList.remove('show');
    silElement.style.backgroundImage = '';
  }
}

// ========================================
// Text progression
// ========================================
function showNextText() {
  if (!currentScene) return;

  // If prompt is showing, do nothing
  if (isSecretEndPrompt) return;

  if (currentTextIndex >= currentScene.text.length) {
    if (currentScene.choices && currentScene.choices.length > 0) {
      showChoices();
    } else if (currentScene.next) {
      setTimeout(() => loadScene(currentScene.next), 800);
    }
    return;
  }

  const textData = currentScene.text[currentTextIndex];

  if (textData.effect) executeEffect(textData.effect);
  if (textData.se) playSe(textData.se);

  displayText(textData);

  currentTextIndex++;
}

function displayText(textData) {
  const textArea = document.getElementById('textArea');
  if (!textArea) return;

  const lineDiv = document.createElement('div');
  lineDiv.className = `text-line text-${textData.type || 'narration'}`;
  textArea.appendChild(lineDiv);

  const replacedText = replacePlayerName(textData.text);
  addToLog({ ...textData, text: replacedText });

  isTyping = true;
  const text = replacedText || '';
  let charIndex = 0;

  const typeInterval = setInterval(() => {
    if (charIndex < text.length) {
      lineDiv.textContent += text[charIndex++];
      textArea.scrollTop = textArea.scrollHeight;
      return;
    }

    clearInterval(typeInterval);
    isTyping = false;

    // TRUE/SECRET detection
    if (textData.type === 'system') {
      if (text.includes(TRUE_END_MARKER)) {
        inTrueEnd = true;
      }

      if (text.includes(END_MARKER)) {
        if (inTrueEnd && checkSecretEndConditions()) {
          if (!isSecretEndPrompt && !isSecretEndPromptQueued) {
            isSecretEndPromptQueued = true;
            setTimeout(() => showSecretEndPrompt(), 800);
          }
          // Do not advance automatically right after END
          return;
        }
        // Close any TRUE-END guard after END
        inTrueEnd = false;
      }
    }

    // Auto
    if (autoMode) {
      setTimeout(() => {
        if (autoMode) showNextText();
      }, 1200);
    }

    // Skip (only read scenes)
    if (skipMode && readScenes.has(currentScene.id)) {
      setTimeout(() => {
        if (skipMode) showNextText();
      }, 80);
    }
  }, 40);

  textArea.scrollTop = textArea.scrollHeight;
}

function handleTextAreaClick() {
  if (isTyping) return;              // (You can implement “show full line” if you want)
  if (isChoicesVisible()) return;    // prevent accidental advancing while choices are visible
  if (isSecretEndPrompt) return;     // prompt must be clicked

  showNextText();
}

// ========================================
// Choices
// ========================================
function showChoices() {
  const choicesArea = document.getElementById('choicesArea');
  if (!choicesArea) return;

  choicesArea.innerHTML = '';
  choicesArea.classList.remove('hidden');

  isSecretEndPrompt = false;
  isSecretEndPromptQueued = false;

  currentScene.choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.className = 'choice-btn';
    button.textContent = replacePlayerName(choice.label);
    button.style.animationDelay = `${index * 0.08}s`;
    button.addEventListener('click', () => selectChoice(choice));
    choicesArea.appendChild(button);
  });
}

function hideChoices() {
  const choicesArea = document.getElementById('choicesArea');
  if (!choicesArea) return;

  choicesArea.classList.add('hidden');
  choicesArea.innerHTML = '';

  isSecretEndPrompt = false;
  isSecretEndPromptQueued = false;
}

function selectChoice(choice) {
  hideChoices();

  trackChoiceFlags(currentScene.id, choice.nextScene, choice.label);

  const textArea = document.getElementById('textArea');
  if (textArea) textArea.innerHTML = '';

  if (choice.nextScene) {
    loadScene(choice.nextScene);
  }
}

function isChoicesVisible() {
  const choicesArea = document.getElementById('choicesArea');
  return choicesArea && !choicesArea.classList.contains('hidden');
}

// SECRET prompt after TRUE END closing line
function showSecretEndPrompt() {
  const choicesArea = document.getElementById('choicesArea');
  if (!choicesArea) return;

  choicesArea.innerHTML = '';
  choicesArea.classList.remove('hidden');

  isSecretEndPrompt = true;
  isSecretEndPromptQueued = false;

  // Pause auto/skip
  if (autoMode) {
    autoMode = false;
    document.getElementById('autoBtn')?.classList.remove('active');
  }
  if (skipMode) {
    skipMode = false;
    document.getElementById('skipBtn')?.classList.remove('active');
  }

  const secretButton = document.createElement('button');
  secretButton.className = 'choice-btn';
  secretButton.textContent = '真相へ進む';
  secretButton.addEventListener('click', () => {
    inTrueEnd = false;
    isSecretEndPrompt = false;

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
    isSecretEndPrompt = false;

    hideChoices();
    restartGame();
  });
  choicesArea.appendChild(titleButton);
}

// ========================================
// SECRET flags tracking
// ========================================
function trackChoiceFlags(sceneId, nextScene, label) {
  if (sceneId === 'chapter2_scene5' && nextScene === 'route_a_scene6') {
    setFlag('coop', true);
  }
  if (sceneId === 'route_a_scene7' && nextScene === 'route_a2_continuation') {
    setFlag('pinch', true);
  }
  if (sceneId === 'route_a2_continuation' && label && label.includes('まだ判断できない')) {
    setFlag('needMoreInfo', true);
  }
  if (sceneId === 'chapter3_scene8' && nextScene === 'route_b_scene1') {
    setFlag('suspectMiyuki', true);
  }
  if (nextScene === 'chapter3_scene9_alternative') {
    setFlag('didNotGetAlternativeNormal', false);
  }
}

function checkSecretEndConditions() {
  return flags.coop &&
    flags.pinch &&
    flags.needMoreInfo &&
    flags.suspectMiyuki &&
    flags.didNotGetAlternativeNormal;
}

// ========================================
// Effects
// ========================================
function executeEffect(effect) {
  const stage = document.querySelector('.stage');
  const flash = document.getElementById('flash');
  const noise = document.getElementById('noise');

  switch (effect) {
    case 'flash':
      flash?.classList.add('flash');
      setTimeout(() => flash?.classList.remove('flash'), 400);
      break;
    case 'shake':
      stage?.classList.add('shake');
      setTimeout(() => stage?.classList.remove('shake'), 400);
      break;
    case 'noise':
      noise?.classList.add('noise');
      setTimeout(() => noise?.classList.remove('noise'), 1400);
      break;
  }
}

// ========================================
// Audio (WebAudio generated)
// ========================================
function initAudioContext() {
  if (audioContext) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext = new AudioContextClass();

  bgmGainNode = audioContext.createGain();
  seGainNode = audioContext.createGain();

  bgmGainNode.gain.value = settings.muteBgm ? 0 : settings.bgmVolume / 100;
  seGainNode.gain.value = settings.muteSe ? 0 : settings.seVolume / 100;

  bgmGainNode.connect(audioContext.destination);
  seGainNode.connect(audioContext.destination);
}

function stopWebAudioNodes(nodes) {
  nodes.forEach(node => {
    try { node.stop(); } catch (_) {}
    try { node.disconnect?.(); } catch (_) {}
  });
}

function stopBgmOnly() {
  stopWebAudioNodes(bgmNodes);
  bgmNodes = [];
  currentBgm = null;
}

function stopAllAudio() {
  stopBgmOnly();
  stopWebAudioNodes(seNodes);
  seNodes = [];
}

function playBgm(bgmId) {
  if (SOUND_DISABLED) return;
  if (!audioEnabled) return;

  // Prevent unnecessary restarts
  if (bgmId === currentBgm) return;
  currentBgm = bgmId;

  initAudioContext();
  if (!audioContext || !bgmGainNode) return;

  // Stop previous
  stopBgmOnly();

  const nodes = createBgmNodes(bgmId);
  if (!nodes.length) return;

  bgmNodes = nodes;
  bgmNodes.forEach(node => {
    // OscillatorNode / AudioBufferSourceNode both have start()
    node.start();
  });
}

function playSe(seId) {
  if (SOUND_DISABLED) return;
  if (!audioEnabled) return;
  if (settings.muteSe) return;

  // Optional: require mapping exists
  if (!seId || !storyData?.se?.[seId]) return;

  initAudioContext();
  if (!audioContext || !seGainNode) return;

  const nodes = createSeNodes(seId);
  if (!nodes.length) return;

  // start/stop each node
  nodes.forEach(node => {
    const startTime = node.startAt ?? audioContext.currentTime;
    const stopTime = node.stopAt ?? (audioContext.currentTime + (node.duration ?? 0.3));

    // Start
    node.start(startTime);

    // Stop safely
    try { node.stop(stopTime); } catch (_) {}
  });

  // Keep references for stopAllAudio()
  seNodes.push(...nodes);
}

// --- Generated BGM/SE “palette” (low harshness) ---
function createNoiseBuffer(durationSeconds = 2, level = 0.25) {
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, Math.floor(durationSeconds * sampleRate), sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * level;
  }
  return buffer;
}

function createBgmNodes(bgmId) {
  switch (bgmId) {
    case 'wind':
      return [createWindBgmNode(0.045)];
    case 'tense':
    case 'silence':
      return createDroneNodes(110, 0.028);
    case 'mysterious':
      return createDroneNodes(90, 0.034);
    case 'sad':
      return createDroneNodes(70, 0.026);
    default:
      return createDroneNodes(80, 0.028);
  }
}

function createSeNodes(seId) {
  switch (seId) {
    case 'wiper':
      return [createSwipeSeNode()];
    case 'gust':
      return [createGustSeNode()];
    case 'door_close':
      return [createKnockSeNode()];
    case 'footsteps_snow':
      return [createFootstepsSeNode()];
    case 'scream':
      return [createScreamSeNode()];
    case 'heartbeat':
      return createHeartbeatSeNodes();
    case 'struggle':
      return [createStruggleSeNode()];
    default:
      return [];
  }
}

function createWindBgmNode(volume = 0.05) {
  const source = audioContext.createBufferSource();
  source.buffer = createNoiseBuffer(4, 0.22);
  source.loop = true;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 380;
  filter.Q.value = 0.7;

  const gain = audioContext.createGain();
  gain.gain.value = volume;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(bgmGainNode);

  source.duration = 0;
  return source;
}

function createDroneNodes(frequency, volume) {
  const osc = audioContext.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = frequency;

  // Gentle vibrato
  const lfo = audioContext.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.12;

  const lfoGain = audioContext.createGain();
  lfoGain.gain.value = 2.2;

  const gain = audioContext.createGain();
  gain.gain.value = volume;

  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  osc.connect(gain);
  gain.connect(bgmGainNode);

  osc.duration = 0;
  lfo.duration = 0;

  return [osc, lfo];
}

function createSwipeSeNode() {
  const source = audioContext.createBufferSource();
  source.buffer = createNoiseBuffer(0.18, 0.20);

  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 280;
  filter.Q.value = 0.9;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.10, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(seGainNode);

  source.duration = 0.18;
  return source;
}

function createGustSeNode() {
  const source = audioContext.createBufferSource();
  source.buffer = createNoiseBuffer(0.55, 0.25);

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.12, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0008, audioContext.currentTime + 0.55);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(seGainNode);

  source.duration = 0.55;
  return source;
}

function createKnockSeNode() {
  const osc = audioContext.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 130;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.12, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0008, audioContext.currentTime + 0.22);

  osc.connect(gain);
  gain.connect(seGainNode);

  osc.duration = 0.22;
  return osc;
}

function createFootstepsSeNode() {
  const source = audioContext.createBufferSource();
  source.buffer = createNoiseBuffer(0.26, 0.20);

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.09, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0008, audioContext.currentTime + 0.26);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(seGainNode);

  source.duration = 0.26;
  return source;
}

function createScreamSeNode() {
  // Keep this less harsh to avoid “peep”
  const source = audioContext.createBufferSource();
  source.buffer = createNoiseBuffer(0.32, 0.22);

  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 650; // (was 900) lower to avoid piercing highs
  filter.Q.value = 0.7;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.12, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0008, audioContext.currentTime + 0.32);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(seGainNode);

  source.duration = 0.32;
  return source;
}

function createHeartbeatSeNodes() {
  const nodes = [];
  const baseTime = audioContext.currentTime;

  [0, 0.24].forEach(offset => {
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 78;

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.11, baseTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.0008, baseTime + offset + 0.18);

    osc.connect(gain);
    gain.connect(seGainNode);

    osc.duration = 0.22;
    osc.startAt = baseTime + offset;
    osc.stopAt = baseTime + offset + 0.22;

    nodes.push(osc);
  });

  return nodes;
}

function createStruggleSeNode() {
  const source = audioContext.createBufferSource();
  source.buffer = createNoiseBuffer(0.30, 0.22);

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.11, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0008, audioContext.currentTime + 0.30);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(seGainNode);

  source.duration = 0.30;
  return source;
}

// ========================================
// Menu / Settings / Log / Save-Load
// ========================================
function showMenu() {
  document.getElementById('menuPanel')?.classList.remove('hidden');
}
function hideMenu() {
  document.getElementById('menuPanel')?.classList.add('hidden');
}

function showSettings() {
  // reflect current values
  document.getElementById('bgmVolume').value = settings.bgmVolume;
  document.getElementById('bgmVolumeValue').textContent = settings.bgmVolume;
  document.getElementById('seVolume').value = settings.seVolume;
  document.getElementById('seVolumeValue').textContent = settings.seVolume;
  document.getElementById('muteBgm').checked = settings.muteBgm;
  document.getElementById('muteSe').checked = settings.muteSe;
  document.getElementById('debugMode').checked = !!settings.debugMode;

  document.getElementById('settingsPanel')?.classList.remove('hidden');
}

function hideSettings() {
  document.getElementById('settingsPanel')?.classList.add('hidden');
  saveSettings();
}

function updateBgmVolume(e) {
  settings.bgmVolume = parseInt(e.target.value, 10);
  document.getElementById('bgmVolumeValue').textContent = settings.bgmVolume;

  if (bgmGainNode && !settings.muteBgm) {
    bgmGainNode.gain.value = settings.bgmVolume / 100;
  }
}
function updateSeVolume(e) {
  settings.seVolume = parseInt(e.target.value, 10);
  document.getElementById('seVolumeValue').textContent = settings.seVolume;

  if (seGainNode && !settings.muteSe) {
    seGainNode.gain.value = settings.seVolume / 100;
  }
}
function toggleMuteBgm(e) {
  settings.muteBgm = !!e.target.checked;
  if (bgmGainNode) bgmGainNode.gain.value = settings.muteBgm ? 0 : settings.bgmVolume / 100;
}
function toggleMuteSe(e) {
  settings.muteSe = !!e.target.checked;
  if (seGainNode) seGainNode.gain.value = settings.muteSe ? 0 : settings.seVolume / 100;
}
function toggleDebugMode(e) {
  settings.debugMode = !!e.target.checked;
  saveSettings();
  updateDebugDisplay();
}

function saveSettings() {
  localStorage.setItem('soundNovelSettings', JSON.stringify(settings));
}
function loadSettings() {
  const settingsStr = localStorage.getItem('soundNovelSettings');
  if (settingsStr) {
    try { settings = JSON.parse(settingsStr); } catch (_) {}
  }
}

function addToLog(textData) {
  textLog.push({ type: textData.type || 'narration', text: textData.text || '' });
}

function showLog() {
  const logContent = document.getElementById('logContent');
  if (!logContent) return;

  logContent.innerHTML = '';
  textLog.forEach(entry => {
    const entryDiv = document.createElement('div');
    entryDiv.className = `log-entry text-${entry.type}`;
    entryDiv.textContent = entry.text;
    logContent.appendChild(entryDiv);
  });

  document.getElementById('logPanel')?.classList.remove('hidden');
  logContent.scrollTop = logContent.scrollHeight;
}
function hideLog() {
  document.getElementById('logPanel')?.classList.add('hidden');
}

// Save/Load
function saveGame() {
  const saveData = {
    sceneId: currentScene?.id,
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

    textLog = [];
    document.getElementById('textArea').innerHTML = '';

    currentTextIndex = 0;
    hideMenu();
    loadScene(saveData.sceneId);
    alert('ロードしました');
  } catch (error) {
    console.error('Load failed:', error);
    alert('ロードに失敗しました');
  }
}

function restartGame() {
  if (!confirm('最初からやり直しますか？')) return;

  stopAllAudio();

  textLog = [];
  readScenes = new Set();
  currentTextIndex = 0;
  autoMode = false;
  skipMode = false;

  document.getElementById('textArea').innerHTML = '';
  document.getElementById('autoBtn')?.classList.remove('active');
  document.getElementById('skipBtn')?.classList.remove('active');

  hideMenu();
  startGame();
}

// Auto/Skip
function toggleAuto() {
  autoMode = !autoMode;
  document.getElementById('autoBtn')?.classList.toggle('active', autoMode);

  if (autoMode) {
    skipMode = false;
    document.getElementById('skipBtn')?.classList.remove('active');
    if (!isTyping) setTimeout(() => autoMode && showNextText(), 1200);
  }
}
function toggleSkip() {
  skipMode = !skipMode;
  document.getElementById('skipBtn')?.classList.toggle('active', skipMode);

  if (skipMode) {
    autoMode = false;
    document.getElementById('autoBtn')?.classList.remove('active');
    if (!isTyping && readScenes.has(currentScene.id)) {
      setTimeout(() => skipMode && showNextText(), 80);
    }
  }
}

// Debug
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

// Player name
function savePlayerName() {
  localStorage.setItem('soundNovelPlayerName', playerName);
}
function loadPlayerName() {
  const savedName = localStorage.getItem('soundNovelPlayerName');
  if (savedName) playerName = savedName;
}
function showNameInputPanel() {
  const panel = document.getElementById('nameInputPanel');
  const input = document.getElementById('playerNameInput');
  if (!panel || !input) return;
  input.value = playerName;
  panel.classList.remove('hidden');
}
function hideNameInputPanel() {
  document.getElementById('nameInputPanel')?.classList.add('hidden');
}
function confirmPlayerName() {
  const input = document.getElementById('playerNameInput');
  const name = (input?.value || '').trim();

  if (!name) return alert('名前を入力してください');
  if (name.length > 8) return alert('名前は8文字以内で入力してください');

  playerName = name;
  savePlayerName();
  hideNameInputPanel();

  const container = document.getElementById('gameContainer');
  if (container?.classList.contains('hidden')) {
    container.classList.remove('hidden');
    startGame();
  }
}
function showNameInput() {
  hideMenu();
  showNameInputPanel();
}
function replacePlayerName(text) {
  if (!text) return text;
  return text.replace(/主人公名/g, playerName);
}

// Flags persistence
function saveFlags()