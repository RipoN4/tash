/**
 * Tash Counter - Clean Minimal Game Engine (English + Banglish)
 * Ram Ram (2-Team) & Call Bridge (4-Player: A, B, C, D)
 */

const GameState = {
  active: false,
  mode: 'ramram', // 'ramram' or 'callbridge'
  target: 100,    // 100 or 60
  view: 'digital', // 'digital' or 'paper'
  soundEnabled: true,
  wakeLockActive: false,
  wakeLockSentinel: null,

  // Ram Ram
  ramram: {
    teamA: 'Team A',
    teamB: 'Team B',
    caller: null, // null by default, user must select each round
    call: null, // null by default, user must select each round
    rounds: [], // { id, caller, call, outcome, ptsA, ptsB, note }
    isGameOver: false,
    winner: null
  },

  // Call Bridge: A, B, C, D
  callbridge: {
    players: ['A', 'B', 'C', 'D'],
    rounds: [], // { id, pits: [p1, p2, p3, p4] }
    isGameOver: false,
    winnerIdx: null
  }
};

// ==========================================================================
// BOOT & STORAGE
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadSavedGame();
  bindEvents();
  renderApp();
});

function loadSavedGame() {
  try {
    const raw = localStorage.getItem('tash_minimal_state');
    if (raw) {
      const parsed = JSON.parse(raw);
      delete parsed.wakeLockSentinel;
      delete parsed.wakeLockActive;
      Object.assign(GameState, parsed);
    }
    // Always start with no caller and no call selected for the active round
    GameState.ramram.caller = null;
    GameState.ramram.call = null;
    GameState.wakeLockActive = false;
    delete GameState.wakeLockSentinel;
  } catch (e) {
    console.warn("Storage load error:", e);
  }
}

function saveGame() {
  try {
    localStorage.setItem('tash_minimal_state', JSON.stringify(GameState));
    
    // Non-blocking sync to server
    if (navigator.onLine) {
      fetch('api/save_game.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(GameState)
      }).catch(() => {});
    }
  } catch (e) {}
}

// ==========================================================================
// ==========================================================================
// 15-SECOND FAIR PLAY CALL LOCK ENGINE (TIMER & PULSE EFFECT)
// ==========================================================================
const LockManager = {
  timer: null,
  secondsLeft: 15,
  isLocked: false,

  start() {
    this.reset();
    this.secondsLeft = 15;
    this.isLocked = false;
    this.updateUI();

    this.timer = setInterval(() => {
      this.secondsLeft--;
      this.updateUI();

      if (this.secondsLeft <= 0) {
        this.lock();
      }
    }, 1000);
  },

  lock() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isLocked = true;
    this.secondsLeft = 0;
    if (window.soundEngine && window.soundEngine.playLock) {
      window.soundEngine.playLock();
    }
    showToast("🔒 Call locked for this round (Fair Play)");
    this.updateUI();
  },

  reset() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.secondsLeft = 15;
    this.isLocked = false;
    this.updateUI();
  },

  updateUI() {
    const callerRow = document.querySelector('.caller-toggle-row');
    const chipsWrap = document.querySelector('.call-chips-wrap');
    const activeChip = document.querySelector('.c-chip.active:not(.dbl-toggle-chip)');
    const dblBtn = document.getElementById('btnDblToggle');

    // Strict workflow cue: if no team selected, chips are waiting for team
    if (chipsWrap) {
      chipsWrap.classList.toggle('waiting-for-team', !GameState.ramram.caller);
    }

    // Reset timer badges on all chips
    document.querySelectorAll('.c-chip:not(.dbl-toggle-chip) .chip-timer').forEach(t => {
      t.textContent = '';
      t.style.display = 'none';
    });

    const hasBoth = !!(GameState.ramram.caller && GameState.ramram.call);

    if (!hasBoth || !activeChip) {
      if (callerRow) callerRow.classList.remove('locked');
      if (chipsWrap) chipsWrap.classList.remove('locked', 'counting-down');
      document.querySelectorAll('.c-chip:not(.dbl-toggle-chip)').forEach(c => c.classList.remove('counting-down', 'locked'));
      if (dblBtn) dblBtn.classList.remove('locked');
      updateRrActionLabels();
      return;
    }

    const timerSpan = activeChip.querySelector('.chip-timer');

    if (this.isLocked) {
      if (callerRow) callerRow.classList.add('locked');
      if (chipsWrap) {
        chipsWrap.classList.remove('counting-down');
        chipsWrap.classList.add('locked');
      }
      activeChip.classList.remove('counting-down');
      activeChip.classList.add('locked');
      if (dblBtn) dblBtn.classList.add('locked');
      if (timerSpan) {
        timerSpan.textContent = '🔒';
        timerSpan.style.display = 'inline-block';
      }
    } else {
      if (callerRow) callerRow.classList.remove('locked');
      if (chipsWrap) {
        chipsWrap.classList.add('counting-down');
        chipsWrap.classList.remove('locked');
      }
      activeChip.classList.remove('locked');
      activeChip.classList.add('counting-down');
      if (dblBtn) dblBtn.classList.remove('locked');
      if (timerSpan) {
        timerSpan.textContent = `${this.secondsLeft}s`;
        timerSpan.style.display = 'inline-block';
      }
    }

    updateRrActionLabels();
  }
};

// ==========================================================================
// EVENT HANDLERS
// ==========================================================================
function bindEvents() {
  // Setup Screen: Choose Mode
  document.getElementById('choiceRamRam').addEventListener('click', () => {
    window.soundEngine.playTap();
    GameState.mode = 'ramram';
    document.getElementById('choiceRamRam').classList.add('active');
    document.getElementById('choiceCallBridge').classList.remove('active');
  });

  document.getElementById('choiceCallBridge').addEventListener('click', () => {
    window.soundEngine.playTap();
    GameState.mode = 'callbridge';
    document.getElementById('choiceCallBridge').classList.add('active');
    document.getElementById('choiceRamRam').classList.remove('active');
  });

  // Setup Screen: Choose Target (100 or 60)
  document.querySelectorAll('.target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.soundEngine.playTap();
      GameState.target = parseInt(btn.dataset.target, 10);
      document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Setup Screen: Start Counter
  document.getElementById('startGameBtn').addEventListener('click', () => {
    window.soundEngine.playTap();
    GameState.active = true;
    GameState.ramram.caller = null;
    GameState.ramram.call = null;
    LockManager.reset();
    clearCallerButtons();
    clearCallChips();
    saveGame();
    renderApp();
  });

  // Top Bar: Exit / New Game
  document.getElementById('exitGameBtn').addEventListener('click', () => {
    window.soundEngine.playTap();
    const hasRounds = GameState.mode === 'ramram' 
      ? GameState.ramram.rounds.length > 0 
      : GameState.callbridge.rounds.length > 0;

    if (hasRounds) {
      if (!confirm("New game shuru korba? Current points clear hoye jabe.")) return;
    }

    LockManager.reset();
    resetMatchData();
    GameState.active = false;
    saveGame();
    renderApp();
  });

  // Sound Toggle
  document.getElementById('soundBtn').addEventListener('click', toggleSound);

  // Full Screen Toggle
  const fsBtn = document.getElementById('fullscreenBtn');
  if (fsBtn) {
    fsBtn.addEventListener('click', toggleFullscreen);
  }

  // Wake Lock
  document.getElementById('wakeLockBtn').addEventListener('click', toggleWakeLock);

  // Re-acquire Wake Lock when user returns to Tash tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && WakeLockEngine.active) {
      WakeLockEngine.reacquire();
    }
  });

  // ------------------------------------------------------------------------
  // RAM RAM CONTROLS
  // ------------------------------------------------------------------------
  // Editable Team Names
  document.getElementById('rrNameA').addEventListener('change', (e) => {
    GameState.ramram.teamA = e.target.value.trim() || 'Team A';
    renderApp();
    saveGame();
  });
  document.getElementById('rrNameB').addEventListener('change', (e) => {
    GameState.ramram.teamB = e.target.value.trim() || 'Team B';
    renderApp();
    saveGame();
  });

  // Caller Select (A or B)
  document.getElementById('callerBtnA').addEventListener('click', () => {
    if (LockManager.isLocked) {
      if (confirm("Call is locked for fair play. Do you want to unlock to change call or team?")) {
        LockManager.reset();
        showToast("Call unlocked for 15s");
      } else {
        return;
      }
    }
    window.soundEngine.playTap();
    GameState.ramram.caller = 'A';
    document.getElementById('callerBtnA').classList.add('active');
    document.getElementById('callerBtnB').classList.remove('active');

    // Strict workflow: Switching team resets call and stops the timer until a call number is chosen
    GameState.ramram.call = null;
    clearCallChips();
    LockManager.reset();

    const chipsWrap = document.querySelector('.call-chips-wrap');
    if (chipsWrap) chipsWrap.classList.remove('waiting-for-team');

    updateRrActionLabels();
  });

  document.getElementById('callerBtnB').addEventListener('click', () => {
    if (LockManager.isLocked) {
      if (confirm("Call is locked for fair play. Do you want to unlock to change call or team?")) {
        LockManager.reset();
        showToast("Call unlocked for 15s");
      } else {
        return;
      }
    }
    window.soundEngine.playTap();
    GameState.ramram.caller = 'B';
    document.getElementById('callerBtnB').classList.add('active');
    document.getElementById('callerBtnA').classList.remove('active');

    // Strict workflow: Switching team resets call and stops the timer until a call number is chosen
    GameState.ramram.call = null;
    clearCallChips();
    LockManager.reset();

    const chipsWrap = document.querySelector('.call-chips-wrap');
    if (chipsWrap) chipsWrap.classList.remove('waiting-for-team');

    updateRrActionLabels();
  });

  // Call Chips (7 to 12)
  document.querySelectorAll('.c-chip:not(.dbl-toggle-chip)').forEach(chip => {
    chip.addEventListener('click', () => {
      // STRICT WORKFLOW: Must select Team first before Call Number!
      if (!GameState.ramram.caller) {
        showToast("Please select Team first!");
        window.soundEngine.playSad();
        const callerRow = document.querySelector('.caller-toggle-row');
        if (callerRow) {
          callerRow.classList.add('shake-cue');
          setTimeout(() => callerRow.classList.remove('shake-cue'), 600);
        }
        return;
      }

      if (LockManager.isLocked) {
        if (chip.classList.contains('active')) {
          if (confirm("Call is locked for fair play. Do you want to unlock to change call or team?")) {
            LockManager.start();
            showToast("Call unlocked for 15s");
          }
        } else {
          showToast("🔒 Call is locked! Tap active call to unlock.");
        }
        return;
      }

      window.soundEngine.playTap();
      const baseCall = chip.dataset.call;
      const num = parseInt(baseCall, 10);
      const isDoubleable = num === 10 || num === 11 || num === 12;

      // Keep double if double button was active and new number is doubleable
      const dblBtn = document.getElementById('btnDblToggle');
      const wasDouble = isDoubleable && dblBtn && dblBtn.classList.contains('active');

      GameState.ramram.call = wasDouble ? `${baseCall}D` : baseCall;

      // Reset all number chips
      document.querySelectorAll('.c-chip:not(.dbl-toggle-chip)').forEach(c => {
        c.classList.remove('active');
        const val = c.querySelector('.chip-val');
        if (val) val.textContent = c.dataset.call;
      });

      chip.classList.add('active');
      if (wasDouble) {
        const val = chip.querySelector('.chip-val');
        if (val) val.textContent = `${baseCall} Dbl`;
      }

      // Update double button enabled/disabled state
      if (dblBtn) {
        dblBtn.classList.toggle('disabled', !isDoubleable);
        dblBtn.classList.toggle('active', wasDouble);
      }

      // Start 15s Fair Play Lock countdown
      LockManager.start();
      updateRrActionLabels();
    });
  });

  // 2x Double Toggle Button (10, 11, 12 only)
  const dblToggleBtn = document.getElementById('btnDblToggle');
  if (dblToggleBtn) {
    dblToggleBtn.addEventListener('click', () => {
      if (!GameState.ramram.caller) {
        showToast("Please select Team first!");
        window.soundEngine.playSad();
        const callerRow = document.querySelector('.caller-toggle-row');
        if (callerRow) {
          callerRow.classList.add('shake-cue');
          setTimeout(() => callerRow.classList.remove('shake-cue'), 600);
        }
        return;
      }

      if (LockManager.isLocked) {
        if (confirm("Call is locked for fair play. Do you want to unlock to change call or team?")) {
          LockManager.start();
          showToast("Call unlocked for 15s");
        } else {
          return;
        }
      }

      const currentCall = GameState.ramram.call;
      if (!currentCall) {
        showToast("Select 10, 11, or 12 first!");
        window.soundEngine.playSad();
        return;
      }

      const baseNum = parseInt(currentCall, 10);
      if (baseNum !== 10 && baseNum !== 11 && baseNum !== 12) {
        showToast("Double only allowed for 10, 11, 12!");
        window.soundEngine.playSad();
        return;
      }

      window.soundEngine.playTap();
      const activeChip = document.querySelector(`.c-chip[data-call="${baseNum}"]`);

      if (currentCall.endsWith('D')) {
        // Toggle OFF
        GameState.ramram.call = `${baseNum}`;
        dblToggleBtn.classList.remove('active');
        if (activeChip) {
          const val = activeChip.querySelector('.chip-val');
          if (val) val.textContent = `${baseNum}`;
        }
        showToast(`Call: ${baseNum} Single`);
      } else {
        // Toggle ON
        GameState.ramram.call = `${baseNum}D`;
        dblToggleBtn.classList.add('active');
        if (activeChip) {
          const val = activeChip.querySelector('.chip-val');
          if (val) val.textContent = `${baseNum} Dbl`;
        }
        showToast(`Call: ${baseNum} Double (2x)!`);
      }

      LockManager.start();
      updateRrActionLabels();
    });
  }

  // Outcome Buttons: Win, Lose, Ram Ram
  document.getElementById('btnRrMade').addEventListener('click', () => handleRrOutcome('made'));
  document.getElementById('btnRrFail').addEventListener('click', () => handleRrOutcome('fail'));
  document.getElementById('btnRrRamRam').addEventListener('click', () => handleRrOutcome('ramram'));

  // Undo Last Round
  document.getElementById('rrUndoBtn').addEventListener('click', undoRrRound);

  // Expandable History Accordion (Ram Ram)
  const rrToggle = document.getElementById('rrHistoryToggle');
  if (rrToggle) {
    rrToggle.addEventListener('click', (e) => {
      if (e.target.closest('#rrUndoBtn')) return;
      document.getElementById('rrHistoryBox').classList.toggle('expanded');
      window.soundEngine.playTap();
    });
  }

  // ------------------------------------------------------------------------
  // CALL BRIDGE CONTROLS (A, B, C, D)
  // ------------------------------------------------------------------------
  // Player names
  for (let i = 1; i <= 4; i++) {
    const defaultChar = String.fromCharCode(64 + i); // A, B, C, D
    document.getElementById(`cbName${i}`).addEventListener('change', (e) => {
      GameState.callbridge.players[i - 1] = e.target.value.trim() || defaultChar;
      renderApp();
      saveGame();
    });
  }

  // Steppers (+ / -) with STRICT MAX 13 ENFORCEMENT
  document.querySelectorAll('.stp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      let val = parseInt(input.value, 10) || 0;

      if (btn.classList.contains('stp-plus')) {
        // Calculate other players' sum
        let otherSum = 0;
        for (let i = 1; i <= 4; i++) {
          if (`pit${i}` !== targetId) {
            otherSum += parseInt(document.getElementById(`pit${i}`).value, 10) || 0;
          }
        }
        if (val + otherSum >= 13) {
          showToast("Total points cannot exceed 13!");
          window.soundEngine.playSad();
          return;
        }
        val++;
      } else {
        if (val > 0) val--;
      }

      input.value = val;
      window.soundEngine.playTap();
      updateCbRemaining();
    });
  });

  // Direct Input change with STRICT MAX 13 ENFORCEMENT
  for (let i = 1; i <= 4; i++) {
    const input = document.getElementById(`pit${i}`);
    input.addEventListener('input', () => {
      let val = parseInt(input.value, 10) || 0;
      let otherSum = 0;
      for (let j = 1; j <= 4; j++) {
        if (j !== i) {
          otherSum += parseInt(document.getElementById(`pit${j}`).value, 10) || 0;
        }
      }

      if (val + otherSum > 13) {
        val = Math.max(0, 13 - otherSum);
        input.value = val > 0 ? val : '';
        showToast("Maximum 13 points allowed!");
        window.soundEngine.playSad();
      }
      updateCbRemaining();
    });
  }

  // Individual Row "Auto" Buttons (Fills remaining to this player)
  document.querySelectorAll('.row-auto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pIdx = parseInt(btn.dataset.player, 10);
      autoFillSpecificPlayer(pIdx);
    });
  });

  // Submit Call Bridge Round
  document.getElementById('cbSubmitRoundBtn').addEventListener('click', handleCbRoundSubmit);

  // Undo Call Bridge Round
  document.getElementById('cbUndoBtn').addEventListener('click', undoCbRound);

  // Expandable History Accordion (Call Bridge)
  const cbToggle = document.getElementById('cbHistoryToggle');
  if (cbToggle) {
    cbToggle.addEventListener('click', (e) => {
      if (e.target.closest('#cbUndoBtn')) return;
      document.getElementById('cbHistoryBox').classList.toggle('expanded');
      window.soundEngine.playTap();
    });
  }

  // ------------------------------------------------------------------------
  // MODALS
  // ------------------------------------------------------------------------
  document.getElementById('winCloseBtn').addEventListener('click', () => {
    document.getElementById('winModal').classList.remove('active');
  });

  document.getElementById('winNewMatchBtn').addEventListener('click', () => {
    document.getElementById('winModal').classList.remove('active');
    resetMatchData();
    renderApp();
  });
}

function clearCallerButtons() {
  document.getElementById('callerBtnA').classList.remove('active');
  document.getElementById('callerBtnB').classList.remove('active');
}

function clearCallChips() {
  document.querySelectorAll('.c-chip:not(.dbl-toggle-chip)').forEach(c => {
    c.classList.remove('active', 'counting-down', 'locked');
    const timer = c.querySelector('.chip-timer');
    if (timer) {
      timer.textContent = '';
      timer.style.display = 'none';
    }
    const val = c.querySelector('.chip-val');
    if (val && c.dataset.call) {
      val.textContent = c.dataset.call;
    }
  });

  const dblBtn = document.getElementById('btnDblToggle');
  if (dblBtn) {
    dblBtn.classList.remove('active', 'locked');
    dblBtn.classList.add('disabled');
  }
}

// ==========================================================================
// RENDER & UI UPDATES
// ==========================================================================
function renderApp() {
  const setupScreen = document.getElementById('setupScreen');
  const gameArena = document.getElementById('gameArena');

  if (!GameState.active) {
    setupScreen.classList.add('active');
    gameArena.classList.remove('active');

    // Update choices
    document.getElementById('choiceRamRam').classList.toggle('active', GameState.mode === 'ramram');
    document.getElementById('choiceCallBridge').classList.toggle('active', GameState.mode === 'callbridge');
    document.querySelectorAll('.target-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.target, 10) === GameState.target);
    });
    return;
  }

  setupScreen.classList.remove('active');
  gameArena.classList.add('active');

  // Active Block
  document.getElementById('arenaRamRam').classList.toggle('active', GameState.mode === 'ramram');
  document.getElementById('arenaCallBridge').classList.toggle('active', GameState.mode === 'callbridge');

  if (GameState.mode === 'ramram') {
    renderRamRam();
  } else {
    renderCallBridge();
  }
}

// ==========================================================================
// RAM RAM GAME LOGIC
// ==========================================================================
function updateRrActionLabels() {
  const caller = GameState.ramram.caller;
  const opp = caller === 'A' ? 'B' : (caller === 'B' ? 'A' : null);
  const callerName = caller === 'A' ? GameState.ramram.teamA : (caller === 'B' ? GameState.ramram.teamB : '');
  const oppName = opp === 'A' ? GameState.ramram.teamA : (opp === 'B' ? GameState.ramram.teamB : '');
  const call = GameState.ramram.call;

  if (!caller && !call) {
    document.getElementById('rrMadeHelper').textContent = 'Select Team & Call';
    document.getElementById('rrFailHelper').textContent = 'Select Team & Call';
    return;
  }

  if (!caller) {
    document.getElementById('rrMadeHelper').textContent = 'Select Team';
    document.getElementById('rrFailHelper').textContent = 'Select Team';
    return;
  }

  if (!call) {
    document.getElementById('rrMadeHelper').textContent = 'Select Call';
    document.getElementById('rrFailHelper').textContent = 'Select Call';
    return;
  }

  let madePts = 0;
  let failPts = 0;

  if (call.endsWith('D')) {
    const base = parseInt(call, 10);
    madePts = base * 2;
    failPts = base * 4;
  } else {
    const num = parseInt(call, 10);
    madePts = num;
    failPts = num * 2; // Lose number is doubled to opposing team
  }

  let lockInfo = '';
  if (LockManager.isLocked) {
    lockInfo = ' • 🔒 Locked';
  } else if (LockManager.timer && LockManager.secondsLeft > 0) {
    lockInfo = ` • ${LockManager.secondsLeft}s`;
  }

  document.getElementById('rrMadeHelper').textContent = `${callerName} +${madePts} Pts${lockInfo}`;
  document.getElementById('rrFailHelper').textContent = `${oppName} +${failPts} Pts${lockInfo}`;
}

function handleRrOutcome(outcome) {
  const caller = GameState.ramram.caller;
  if (!caller) {
    showToast("Please select caller team first!");
    window.soundEngine.playSad();
    return;
  }

  const opp = caller === 'A' ? 'B' : 'A';
  const callerName = caller === 'A' ? GameState.ramram.teamA : GameState.ramram.teamB;
  const oppName = opp === 'A' ? GameState.ramram.teamA : GameState.ramram.teamB;
  const call = GameState.ramram.call;

  // If user taps Win or Lose without selecting a call number:
  if (outcome !== 'ramram' && !call) {
    showToast("Please select call number first!");
    window.soundEngine.playSad();
    return;
  }

  let ptsA = 0;
  let ptsB = 0;
  let note = '';

  if (outcome === 'made') {
    // PLAY JOY SOUND FOR WIN BUTTON
    window.soundEngine.playJoy();

    let pts = 0;
    if (call.endsWith('D')) {
      pts = parseInt(call, 10) * 2;
    } else {
      pts = parseInt(call, 10);
    }

    if (caller === 'A') ptsA = pts;
    else ptsB = pts;

    const displayCall = call.endsWith('D') ? `${call.slice(0, -1)} Dbl` : call;
    note = `${callerName} Call ${displayCall} Won (+${pts})`;
  } else if (outcome === 'fail') {
    // PLAY SAD SOUND FOR LOSE BUTTON
    window.soundEngine.playSad();

    let pts = 0;
    if (call.endsWith('D')) {
      pts = parseInt(call, 10) * 4;
    } else {
      pts = parseInt(call, 10) * 2;
    }

    if (opp === 'A') ptsA = pts;
    else ptsB = pts;

    const displayCall = call.endsWith('D') ? `${call.slice(0, -1)} Dbl` : call;
    note = `${callerName} Call ${displayCall} Lost -> ${oppName} +${pts}`;
  } else if (outcome === 'ramram') {
    // RAM RAM = INSTANT GAME OVER & WIN FOR CALLING TEAM!
    window.soundEngine.playRamRam();

    if (caller === 'A') ptsA = 40;
    else ptsB = 40;
    note = `👑 ${callerName} Ram Ram! (Instant Win)`;

    const round = {
      id: Date.now(),
      timestamp: Date.now(),
      caller,
      call: 'RAM RAM',
      outcome: 'ramram',
      ptsA,
      ptsB,
      note
    };

    GameState.ramram.rounds.push(round);
    GameState.ramram.isGameOver = true;
    GameState.ramram.winner = callerName;

    // Reset caller & call selection and stop lock timer
    LockManager.reset();
    GameState.ramram.caller = null;
    GameState.ramram.call = null;
    clearCallerButtons();
    clearCallChips();
    updateRrActionLabels();

    renderApp();
    saveGame();
    triggerVictory(callerName, `${callerName} Swept Ram Ram! Immediate Game Over!`);
    return;
  }

  const round = {
    id: Date.now(),
    timestamp: Date.now(),
    caller,
    call,
    outcome,
    ptsA,
    ptsB,
    note
  };

  GameState.ramram.rounds.push(round);

  // Stop lock timer and AUTO-UNSELECT CALLER & CALL NUMBER FOR THE NEXT ROUND!
  LockManager.reset();
  GameState.ramram.caller = null;
  GameState.ramram.call = null;
  clearCallerButtons();
  clearCallChips();
  updateRrActionLabels();

  checkRrGameOver();
  renderApp();
  saveGame();
  showToast("Round added");
}

function undoRrRound() {
  if (GameState.ramram.rounds.length === 0) return;
  window.soundEngine.playTap();
  GameState.ramram.rounds.pop();
  GameState.ramram.isGameOver = false;
  GameState.ramram.winner = null;

  // Clear call chip, caller, and lock timer
  LockManager.reset();
  GameState.ramram.caller = null;
  GameState.ramram.call = null;
  clearCallerButtons();
  clearCallChips();
  updateRrActionLabels();

  renderApp();
  saveGame();
  showToast("Last round removed");
}

function checkRrGameOver() {
  const totA = GameState.ramram.rounds.reduce((s, r) => s + r.ptsA, 0);
  const totB = GameState.ramram.rounds.reduce((s, r) => s + r.ptsB, 0);
  const target = GameState.target;

  if (totA >= target || totB >= target) {
    GameState.ramram.isGameOver = true;
    const winnerName = totA >= totB ? GameState.ramram.teamA : GameState.ramram.teamB;
    GameState.ramram.winner = winnerName;
    triggerVictory(winnerName, `${GameState.ramram.teamA}: ${totA} | ${GameState.ramram.teamB}: ${totB}`);
  }
}

function renderRamRam() {
  const rState = GameState.ramram;
  const teamA = rState.teamA;
  const teamB = rState.teamB;
  const target = GameState.target;

  // Labels
  document.getElementById('rrNameA').value = teamA;
  document.getElementById('rrNameB').value = teamB;
  document.getElementById('callerLabelA').textContent = teamA;
  document.getElementById('callerLabelB').textContent = teamB;
  document.getElementById('thRrA').textContent = teamA;
  document.getElementById('thRrB').textContent = teamB;

  // Totals
  const totA = rState.rounds.reduce((s, r) => s + r.ptsA, 0);
  const totB = rState.rounds.reduce((s, r) => s + r.ptsB, 0);

  document.getElementById('rrScoreA').textContent = totA;
  document.getElementById('rrScoreB').textContent = totB;
  document.getElementById('rrRemainA').textContent = Math.max(0, target - totA);
  document.getElementById('rrRemainB').textContent = Math.max(0, target - totB);

  // Leader
  document.getElementById('panelTeamA').classList.toggle('leading', totA > totB);
  document.getElementById('panelTeamB').classList.toggle('leading', totB > totA);

  const leadPill = document.getElementById('rrLeadPill');
  if (totA === totB) leadPill.textContent = "Tied";
  else if (totA > totB) leadPill.textContent = `${teamA} +${totA - totB}`;
  else leadPill.textContent = `${teamB} +${totB - totA}`;

  // Round count & Undo
  document.getElementById('rrRoundCount').textContent = rState.rounds.length;
  document.getElementById('rrUndoBtn').disabled = rState.rounds.length === 0;

  // Digital Table
  const tbody = document.getElementById('rrTableBody');
  if (rState.rounds.length === 0) {
    tbody.innerHTML = `<tr class="empty-state-row"><td colspan="4">No rounds yet. Enter first round above.</td></tr>`;
  } else {
    tbody.innerHTML = rState.rounds.map((r, i) => `
      <tr>
        <td><strong>#${i + 1}</strong></td>
        <td><strong>${r.ptsA}</strong></td>
        <td><strong>${r.ptsB}</strong></td>
        <td><span class="time-ago-badge">${formatTimeAgo(r.timestamp || r.id)}</span></td>
      </tr>
    `).join('');
  }

  document.getElementById('rrFootTotalA').textContent = totA;
  document.getElementById('rrFootTotalB').textContent = totB;
  document.getElementById('rrFootWinner').textContent = totA > totB ? `Winner: ${teamA}` : (totB > totA ? `Winner: ${teamB}` : "-");

  // Sync caller buttons active state (no button active if caller is null)
  document.getElementById('callerBtnA').classList.toggle('active', rState.caller === 'A');
  document.getElementById('callerBtnB').classList.toggle('active', rState.caller === 'B');

  // Sync call chips and double toggle state
  const call = rState.call;
  const isDbl = !!call && call.endsWith('D');
  const baseCall = isDbl ? call.slice(0, -1) : call;

  document.querySelectorAll('.c-chip:not(.dbl-toggle-chip)').forEach(c => {
    const isThisActive = !!baseCall && c.dataset.call === baseCall;
    c.classList.toggle('active', isThisActive);
    const valSpan = c.querySelector('.chip-val');
    if (valSpan && c.dataset.call) {
      valSpan.textContent = (isThisActive && isDbl) ? `${c.dataset.call} Dbl` : c.dataset.call;
    }
  });

  const dblBtn = document.getElementById('btnDblToggle');
  if (dblBtn) {
    const baseNum = parseInt(baseCall, 10);
    const isDoubleable = baseNum === 10 || baseNum === 11 || baseNum === 12;
    dblBtn.classList.toggle('disabled', !isDoubleable);
    dblBtn.classList.toggle('active', isDbl);
    dblBtn.classList.toggle('locked', LockManager.isLocked && isDbl);
  }

  updateRrActionLabels();
  LockManager.updateUI();
}

// ==========================================================================
// CALL BRIDGE GAME LOGIC (A, B, C, D)
// ==========================================================================
function getCbInputs() {
  return [
    parseInt(document.getElementById('pit1').value, 10) || 0,
    parseInt(document.getElementById('pit2').value, 10) || 0,
    parseInt(document.getElementById('pit3').value, 10) || 0,
    parseInt(document.getElementById('pit4').value, 10) || 0
  ];
}

function updateCbRemaining() {
  const pits = getCbInputs();
  const sum = pits.reduce((a, b) => a + b, 0);
  const remaining = 13 - sum;

  document.getElementById('cbRemPits').textContent = remaining;
  const warnEl = document.getElementById('cbValidationWarn');

  if (remaining < 0) {
    warnEl.textContent = `Warning: Total pits exceed 13 (${sum}/13)`;
  } else if (remaining > 0) {
    warnEl.textContent = `${remaining} pits left to allocate`;
  } else {
    warnEl.textContent = "13/13 pits complete!";
  }
}

/**
 * Auto-fill specific player with remainder
 * e.g., A: 3, B: 1, D: 0 -> Click C Auto -> C gets 9!
 */
function autoFillSpecificPlayer(targetPIdx) {
  window.soundEngine.playTap();
  let otherSum = 0;
  for (let i = 1; i <= 4; i++) {
    if (i !== targetPIdx) {
      otherSum += parseInt(document.getElementById(`pit${i}`).value, 10) || 0;
    }
  }

  const remainder = Math.max(0, 13 - otherSum);
  document.getElementById(`pit${targetPIdx}`).value = remainder;
  updateCbRemaining();
  showToast(`${GameState.callbridge.players[targetPIdx - 1]} filled with ${remainder}`);
}

function handleCbRoundSubmit() {
  const pits = getCbInputs();
  const sum = pits.reduce((a, b) => a + b, 0);

  if (sum !== 13) {
    if (!confirm(`Total pits is ${sum} (should be 13). Save anyway?`)) return;
  }

  window.soundEngine.playScoreAdd();

  const round = {
    id: Date.now(),
    timestamp: Date.now(),
    pits: pits
  };

  GameState.callbridge.rounds.push(round);

  // Clear inputs for next round
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`pit${i}`).value = '';
  }
  updateCbRemaining();

  checkCbGameOver();
  renderApp();
  saveGame();
  showToast("Round saved");
}

function undoCbRound() {
  if (GameState.callbridge.rounds.length === 0) return;
  window.soundEngine.playTap();
  GameState.callbridge.rounds.pop();
  GameState.callbridge.isGameOver = false;
  GameState.callbridge.winnerIdx = null;
  renderApp();
  saveGame();
  showToast("Last round removed");
}

function checkCbGameOver() {
  const totals = [0, 0, 0, 0];
  GameState.callbridge.rounds.forEach(r => {
    for (let i = 0; i < 4; i++) totals[i] += r.pits[i];
  });

  const max = Math.max(...totals);
  if (max >= GameState.target) {
    const wIdx = totals.indexOf(max);
    GameState.callbridge.isGameOver = true;
    GameState.callbridge.winnerIdx = wIdx;
    const winnerName = GameState.callbridge.players[wIdx];
    triggerVictory(winnerName, `Reached ${max} Pts!`);
  }
}

function renderCallBridge() {
  const cbState = GameState.callbridge;
  const totals = [0, 0, 0, 0];
  const lastPits = [0, 0, 0, 0];

  cbState.rounds.forEach(r => {
    for (let i = 0; i < 4; i++) totals[i] += r.pits[i];
  });

  if (cbState.rounds.length > 0) {
    const lastR = cbState.rounds[cbState.rounds.length - 1];
    for (let i = 0; i < 4; i++) lastPits[i] = lastR.pits[i];
  }

  const max = Math.max(...totals);
  const ranked = [0, 1, 2, 3].sort((a, b) => totals[b] - totals[a]);

  for (let i = 0; i < 4; i++) {
    const pNum = i + 1;
    const name = cbState.players[i];
    document.getElementById(`cbName${pNum}`).value = name;
    document.getElementById(`cbRowName${pNum}`).textContent = name;
    document.getElementById(`thCb${pNum}`).textContent = name;

    document.getElementById(`cbScore${pNum}`).textContent = totals[i];
    document.getElementById(`cbLast${pNum}`).textContent = lastPits[i];

    const rankIdx = ranked.indexOf(i) + 1;
    document.getElementById(`cbRank${pNum}`).textContent = `#${rankIdx}`;

    const card = document.getElementById(`cbCard${pNum}`);
    card.classList.toggle('leading', totals[i] === max && max > 0);
  }

  // Count & Undo
  document.getElementById('cbRoundCount').textContent = cbState.rounds.length;
  document.getElementById('cbUndoBtn').disabled = cbState.rounds.length === 0;

  // Digital Table (No Timing column)
  const tbody = document.getElementById('cbTableBody');
  if (cbState.rounds.length === 0) {
    tbody.innerHTML = `<tr class="empty-state-row"><td colspan="5">No rounds yet. Enter pits above.</td></tr>`;
  } else {
    tbody.innerHTML = cbState.rounds.map((r, idx) => `
      <tr>
        <td><strong>#${idx + 1}</strong></td>
        <td><strong>${r.pits[0]}</strong></td>
        <td><strong>${r.pits[1]}</strong></td>
        <td><strong>${r.pits[2]}</strong></td>
        <td><strong>${r.pits[3]}</strong></td>
      </tr>
    `).join('');
  }

  document.getElementById('cbFoot1').textContent = totals[0];
  document.getElementById('cbFoot2').textContent = totals[1];
  document.getElementById('cbFoot3').textContent = totals[2];
  document.getElementById('cbFoot4').textContent = totals[3];
}

// ==========================================================================
// RESET & VICTORY
// ==========================================================================
function resetMatchData() {
  LockManager.reset();
  if (GameState.mode === 'ramram') {
    GameState.ramram.rounds = [];
    GameState.ramram.caller = null;
    GameState.ramram.call = null;
    GameState.ramram.isGameOver = false;
    GameState.ramram.winner = null;
    clearCallerButtons();
    clearCallChips();
  } else {
    GameState.callbridge.rounds = [];
    GameState.callbridge.isGameOver = false;
    GameState.callbridge.winnerIdx = null;
  }
}

function triggerVictory(winnerName, summary) {
  window.soundEngine.playWin();
  if (window.confetti) {
    window.confetti.start(4000);
  }

  document.getElementById('winnerNameText').textContent = `${winnerName} Jitse! 🏆`;
  document.getElementById('winnerScoreSummary').textContent = summary;
  document.getElementById('winModal').classList.add('active');
}

// ==========================================================================
// UTILITIES (Fullscreen, Sound, Wake Lock, Toast)
// ==========================================================================
function toggleFullscreen() {
  window.soundEngine.playTap();
  if (!document.fullscreenElement) {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => showToast("Fullscreen not allowed"));
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

function handleFullscreenChange() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const btn = document.getElementById('fullscreenBtn');
  if (btn) {
    btn.classList.toggle('active', isFs);
    const expandIcon = document.getElementById('fullscreenIconExpand');
    const compressIcon = document.getElementById('fullscreenIconCompress');
    if (expandIcon && compressIcon) {
      expandIcon.style.display = isFs ? 'none' : 'block';
      compressIcon.style.display = isFs ? 'block' : 'none';
    }
  }
  showToast(isFs ? "Fullscreen mode" : "Exited Fullscreen");
}

function toggleSound() {
  GameState.soundEnabled = window.soundEngine.toggle();
  const btn = document.getElementById('soundBtn');
  btn.classList.toggle('active', GameState.soundEnabled);
  showToast(GameState.soundEnabled ? "Sound ON" : "Sound Muted");
  saveGame();
}

// ==========================================================================
// SCREEN WAKE LOCK ENGINE (DUAL-LAYER: NATIVE API + MEDIA KEEP-AWAKE FALLBACK)
// ==========================================================================
const WakeLockEngine = {
  active: false,
  sentinel: null,
  videoEl: null,
  stream: null,

  async toggle() {
    window.soundEngine.playTap();
    if (this.active) {
      await this.disable();
    } else {
      await this.enable();
    }
  },

  async enable() {
    // Layer 1: Native Screen Wake Lock API
    if ('wakeLock' in navigator && typeof navigator.wakeLock.request === 'function') {
      try {
        this.sentinel = await navigator.wakeLock.request('screen');
        if (this.sentinel) {
          this.sentinel.addEventListener('release', () => {
            if (this.active) {
              this.reacquire();
            }
          });
        }
      } catch (err) {
        console.warn("Native Wake Lock unavailable or denied:", err);
      }
    }

    // Layer 2: Muted Video Keep-Awake Fallback (Works across all browsers & HTTP)
    this.startVideoFallback();

    this.active = true;
    GameState.wakeLockActive = true;
    this.updateUI();
    showToast("Screen will stay awake! ☀️");
  },

  async disable() {
    this.active = false;
    GameState.wakeLockActive = false;

    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (e) {}
      this.sentinel = null;
    }

    this.stopVideoFallback();
    this.updateUI();
    showToast("Screen sleep allowed");
  },

  startVideoFallback() {
    try {
      if (!this.videoEl) {
        this.videoEl = document.createElement('video');
        this.videoEl.setAttribute('playsinline', '');
        this.videoEl.setAttribute('webkit-playsinline', '');
        this.videoEl.setAttribute('muted', '');
        this.videoEl.setAttribute('loop', '');
        this.videoEl.muted = true;
        this.videoEl.style.position = 'fixed';
        this.videoEl.style.top = '-9999px';
        this.videoEl.style.left = '-9999px';
        this.videoEl.style.width = '1px';
        this.videoEl.style.height = '1px';
        this.videoEl.style.opacity = '0';
        this.videoEl.style.pointerEvents = 'none';

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f1624';
        ctx.fillRect(0, 0, 16, 16);
        if (canvas.captureStream) {
          this.stream = canvas.captureStream(1);
          this.videoEl.srcObject = this.stream;
        }
        document.body.appendChild(this.videoEl);
      }
      if (this.videoEl) {
        this.videoEl.play().catch(() => {});
      }
    } catch (e) {
      console.warn("Video keep-awake fallback error:", e);
    }
  },

  stopVideoFallback() {
    if (this.videoEl) {
      this.videoEl.pause();
    }
  },

  async reacquire() {
    if (!this.active) return;
    if ('wakeLock' in navigator && typeof navigator.wakeLock.request === 'function') {
      try {
        this.sentinel = await navigator.wakeLock.request('screen');
      } catch (e) {}
    }
    if (this.videoEl && this.videoEl.paused) {
      this.videoEl.play().catch(() => {});
    }
  },

  updateUI() {
    const btn = document.getElementById('wakeLockBtn');
    if (btn) {
      btn.classList.toggle('active', this.active);
      btn.setAttribute('title', this.active ? 'Screen Always On: Active ☀️' : 'Screen Always On');
    }
  }
};

function toggleWakeLock() {
  WakeLockEngine.toggle();
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// ==========================================================================
// TIME AGO FORMATTER & LIVE REFRESH
// ==========================================================================
function formatTimeAgo(timestamp) {
  if (!timestamp) return '-';
  const ts = Number(timestamp);
  if (isNaN(ts) || ts <= 0) return '-';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));

  if (diffSec < 45) {
    return 'Just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function updateTimingBadges() {
  if (!GameState.active) return;
  if (GameState.mode === 'ramram') {
    const badges = document.querySelectorAll('#rrTableBody .time-ago-badge');
    GameState.ramram.rounds.forEach((r, idx) => {
      if (badges[idx]) {
        badges[idx].textContent = formatTimeAgo(r.timestamp || r.id);
      }
    });
  }
}

// Auto-refresh relative time every 30 seconds
setInterval(updateTimingBadges, 30000);

