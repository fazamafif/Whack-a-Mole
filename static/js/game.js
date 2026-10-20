/**
 * Whack-a-Mole Deluxe - Game Logic
 * Vanilla JavaScript & Web Audio API
 */

// DOM Elements
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');
const highScoreDisplay = document.getElementById('high-score');
const holes = document.querySelectorAll('.hole');
const moles = document.querySelectorAll('.mole');
const startBtn = document.getElementById('start-btn');
const soundBtn = document.getElementById('sound-btn');
const soundIcon = document.getElementById('sound-icon');
const resetHighScoreBtn = document.getElementById('reset-highscore-btn');
const gameBoard = document.getElementById('game-board');

// Modal Elements
const gameOverModal = document.getElementById('game-over-modal');
const finalScoreDisplay = document.getElementById('final-score');
const totalHitsDisplay = document.getElementById('total-hits');
const newRecordBadge = document.getElementById('new-record-badge');
const restartBtn = document.getElementById('restart-btn');

// Game State
let score = 0;
let timeLeft = 30;
let totalHits = 0;
let isPlaying = false;
let lastHole = null;
let timerId = null;
let moleTimeoutId = null;
let soundEnabled = true;

// Load High Score from localStorage
let highScore = parseInt(localStorage.getItem('whackMole_highScore'), 10) || 0;
highScoreDisplay.textContent = highScore;

/* ========================================================
   WEB AUDIO API SOUND GENERATOR
   ======================================================== */
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Suara Mole Muncul
function playPopSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {
    console.error('Audio error:', e);
  }
}

// Suara Pukul Tikus Biasa (+10)
function playHitNormalSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {}
}

// Suara Pukul Tikus Emas (+25)
function playHitGoldenSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    [784, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);

      gain.gain.setValueAtTime(0.25, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.18);
    });
  } catch (e) {}
}

// Suara Ledakan Bom (-15)
function playHitBombSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {}
}

// Suara Game Over
function playGameOverSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const notes = [440, 392, 349, 293];

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.14);

      gain.gain.setValueAtTime(0.3, now + index * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.14 + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.14);
      osc.stop(now + index * 0.14 + 0.2);
    });
  } catch (e) {}
}

/* ========================================================
   GAMEPLAY HELPER FUNCTIONS
   ======================================================== */

// Hitung durasi kemunculan mole (lebih lambat & ramah pemain)
function getPeepDuration() {
  // Durasi dasar: 1400 - 2000 ms (1.4 s/d 2 detik)
  // Berkurang secara bertahap dan halus seiring bertambahnya skor
  const speedBonus = Math.min(Math.max(score, 0) * 2.5, 450);
  const minTime = Math.max(1400 - speedBonus, 850);
  const maxTime = Math.max(2000 - speedBonus, 1200);
  return Math.round(Math.random() * (maxTime - minTime) + minTime);
}

// Pilih lubang acak (tidak sama dengan lubang sebelumnya)
function getRandomHole() {
  const index = Math.floor(Math.random() * holes.length);
  const selectedHole = holes[index];
  if (selectedHole === lastHole) {
    return getRandomHole();
  }
  lastHole = selectedHole;
  return selectedHole;
}

// Tentukan tipe mole yang muncul secara acak
function getRandomMoleType() {
  const rand = Math.random();
  if (rand < 0.65) {
    return 'normal'; // 65% Normal Mole
  } else if (rand < 0.85) {
    return 'golden'; // 20% Golden Mole
  } else {
    return 'bomb';   // 15% Bom
  }
}

// Tampilkan efek angka mengambang (+10, +25, -15)
function showFloatingScore(text, colorClass, event) {
  const floating = document.createElement('div');
  floating.className = `floating-score ${colorClass}`;
  floating.textContent = text;

  const rect = gameBoard.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  floating.style.left = `${x}px`;
  floating.style.top = `${y}px`;

  gameBoard.appendChild(floating);

  setTimeout(() => {
    floating.remove();
  }, 750);
}

// Getar layar ketika memukul bom
function triggerScreenShake() {
  gameBoard.classList.remove('shake-screen');
  void gameBoard.offsetWidth; // Force reflow
  gameBoard.classList.add('shake-screen');
  setTimeout(() => {
    gameBoard.classList.remove('shake-screen');
  }, 400);
}

/* ========================================================
   MOLE SPAWNING & HIT HANDLING
   ======================================================== */

function peep() {
  if (!isPlaying) return;

  const hole = getRandomHole();
  const mole = hole.querySelector('.mole');
  const type = getRandomMoleType();
  const duration = getPeepDuration();

  // Reset kelas & atribut mole
  mole.className = 'mole';
  mole.dataset.clicked = 'false';
  mole.dataset.type = type;

  if (type === 'normal') {
    mole.classList.add('mole-normal');
  } else if (type === 'golden') {
    mole.classList.add('mole-golden');
  } else if (type === 'bomb') {
    mole.classList.add('mole-bomb');
  }

  // Munculkan mole
  hole.classList.add('up');
  playPopSound();

  // Durasi mole bertahan di luar lubang
  moleTimeoutId = setTimeout(() => {
    hole.classList.remove('up');
    if (isPlaying) {
      // Jeda santai sebelum tikus berikutnya muncul
      setTimeout(() => {
        if (isPlaying) peep();
      }, 350);
    }
  }, duration);
}

function handleMoleClick(e) {
  if (!isPlaying) return;

  const mole = e.currentTarget;
  if (mole.dataset.clicked === 'true') return; // Cegah spam klik pada kemunculan yang sama

  mole.dataset.clicked = 'true';
  const type = mole.dataset.type;
  const hole = mole.parentElement;

  // Batalkan timer kemunculan saat ini agar tidak tumpang tindih
  clearTimeout(moleTimeoutId);

  // Efek visual terpukul
  mole.classList.add('whacked');

  if (type === 'normal') {
    score += 10;
    totalHits++;
    playHitNormalSound();
    showFloatingScore('+10', 'text-emerald-400', e);
  } else if (type === 'golden') {
    score += 25;
    totalHits++;
    playHitGoldenSound();
    showFloatingScore('+25', 'text-yellow-300', e);
  } else if (type === 'bomb') {
    score = Math.max(0, score - 15);
    playHitBombSound();
    showFloatingScore('-15', 'text-rose-400', e);
    triggerScreenShake();
  }

  scoreDisplay.textContent = score;

  // Masukkan kembali mole setelah jeda animasi terpukul
  setTimeout(() => {
    hole.classList.remove('up');
    mole.classList.remove('whacked');
    if (isPlaying) {
      // Jeda sejenak sebelum memunculkan tikus berikutnya
      setTimeout(() => {
        if (isPlaying) peep();
      }, 350);
    }
  }, 220);
}

/* ========================================================
   GAME LOOP & CONTROLS
   ======================================================== */

function startGame() {
  // Inisialisasi Audio Context saat interaksi pengguna
  getAudioContext();

  // Reset variabel
  score = 0;
  timeLeft = 30;
  totalHits = 0;
  isPlaying = true;
  lastHole = null;

  scoreDisplay.textContent = score;
  timerDisplay.textContent = timeLeft;

  // Reset semua lubang
  holes.forEach(hole => {
    hole.classList.remove('up');
    const mole = hole.querySelector('.mole');
    mole.className = 'mole';
    mole.dataset.clicked = 'false';
  });

  // UI state
  startBtn.disabled = true;
  startBtn.classList.add('opacity-50', 'cursor-not-allowed');
  gameOverModal.classList.add('hidden');

  // Bersihkan interval jika ada
  clearInterval(timerId);
  clearTimeout(moleTimeoutId);

  // Mulai loop tikus
  peep();

  // Countdown Timer
  timerId = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;

    // Perubahan warna teks saat waktu menipis (< 10 dtk)
    if (timeLeft <= 5) {
      timerDisplay.classList.add('animate-pulse');
    }

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function endGame() {
  isPlaying = false;
  clearInterval(timerId);
  clearTimeout(moleTimeoutId);

  // Sembunyikan semua mole
  holes.forEach(h => h.classList.remove('up'));
  timerDisplay.classList.remove('animate-pulse');

  // Cek High Score
  let isNewRecord = false;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('whackMole_highScore', highScore);
    highScoreDisplay.textContent = highScore;
    isNewRecord = true;
  }

  // Tampilkan Modal Game Over
  finalScoreDisplay.textContent = score;
  totalHitsDisplay.textContent = totalHits;

  if (isNewRecord && score > 0) {
    newRecordBadge.classList.remove('hidden');
  } else {
    newRecordBadge.classList.add('hidden');
  }

  playGameOverSound();
  gameOverModal.classList.remove('hidden');

  // Reset tombol Mulai
  startBtn.disabled = false;
  startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

// Toggle Suara
function toggleSound() {
  soundEnabled = !soundEnabled;
  soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
  soundBtn.title = soundEnabled ? 'Matikan Suara' : 'Nyalakan Suara';
}

// Reset High Score
function resetHighScore() {
  if (confirm('Yakin ingin mereset High Score?')) {
    highScore = 0;
    localStorage.removeItem('whackMole_highScore');
    highScoreDisplay.textContent = '0';
  }
}

/* ========================================================
   EVENT LISTENERS
   ======================================================== */

// Event listener klik pada setiap mole
moles.forEach(mole => {
  mole.addEventListener('pointerdown', handleMoleClick);
});

// Event listener kontrol tombol
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
soundBtn.addEventListener('click', toggleSound);
resetHighScoreBtn.addEventListener('click', resetHighScore);
