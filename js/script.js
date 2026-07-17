(() => {
  const boardEl = document.querySelector('.chass');
  if (!boardEl) return;

  const initialHTML = boardEl.innerHTML;
  let squares = [];
  const N = 8;

  // Unicode pieces mapping from the HTML already used.
  // HTML uses: black: ♟♞♝♜♚♛ and white: ♙♘♗♖♔♕
  const UNICODE = {
    // White
    '♙': { type: 'pawn', color: 'w' },
    '♘': { type: 'knight', color: 'w' },
    '♗': { type: 'bishop', color: 'w' },
    '♖': { type: 'rook', color: 'w' },
    '♔': { type: 'king', color: 'w' },
    '♕': { type: 'queen', color: 'w' },
    // Black
    '♟': { type: 'pawn', color: 'b' },
    '♞': { type: 'knight', color: 'b' },
    '♝': { type: 'bishop', color: 'b' },
    '♜': { type: 'rook', color: 'b' },
    '♚': { type: 'king', color: 'b' },
    '♛': { type: 'queen', color: 'b' }
  };

  function idxToRC(i) {
    return { r: Math.floor(i / N), c: i % N };
  }
  function rcToIdx(r, c) {
    return r * N + c;
  }

  function getPieceAt(i) {
    const ch = squares[i].textContent.trim();
    if (!ch) return null;
    return { ...UNICODE[ch], unicode: ch };
  }

  function setPieceAt(i, piece) {
    squares[i].textContent = piece ? piece.unicode : '';
    squares[i].dataset.piece = piece ? JSON.stringify({ type: piece.type, color: piece.color }) : '';
    squares[i].classList.remove('piece-w', 'piece-b');
    if (piece) {
      squares[i].classList.add(piece.color === 'w' ? 'piece-w' : 'piece-b');
    }
  }

  function isInside(r, c) {
    return r >= 0 && r < N && c >= 0 && c < N;
  }

  function clearHighlights() {
    squares.forEach(sq => {
      sq.classList.remove('selected', 'move', 'capture');
    });
  }

  function setHighlight(i, kind) {
    const sq = squares[i];
    sq.classList.add(kind);
  }

  function sameColor(p1, p2) {
    return p1 && p2 && p1.color === p2.color;
  }

  // Movement rules (basic): no castling, no en-passant, no check validation.
  function getPseudoLegalMoves(fromIdx) {
    const piece = getPieceAt(fromIdx);
    if (!piece) return [];

    const { r, c } = idxToRC(fromIdx);
    const moves = [];

    const addMove = (nr, nc) => {
      if (!isInside(nr, nc)) return;
      const toIdx = rcToIdx(nr, nc);
      const targetPiece = getPieceAt(toIdx);
      if (!targetPiece) {
        moves.push({ to: toIdx, capture: false });
      } else if (!sameColor(piece, targetPiece)) {
        moves.push({ to: toIdx, capture: true });
      }
    };

    if (piece.type === 'pawn') {
      const dir = piece.color === 'w' ? -1 : 1;
      const startRow = piece.color === 'w' ? 6 : 1;

      // forward 1
      const r1 = r + dir;
      if (isInside(r1, c)) {
        const i1 = rcToIdx(r1, c);
        if (!getPieceAt(i1)) {
          moves.push({ to: i1, capture: false });
          // forward 2
          const r2 = r + 2 * dir;
          if (r === startRow && isInside(r2, c)) {
            const i2 = rcToIdx(r2, c);
            if (!getPieceAt(i2)) {
              moves.push({ to: i2, capture: false });
            }
          }
        }
      }

      // captures
      for (const dc of [-1, 1]) {
        const nr = r + dir;
        const nc = c + dc;
        if (!isInside(nr, nc)) continue;
        const ti = rcToIdx(nr, nc);
        const tp = getPieceAt(ti);
        if (tp && tp.color !== piece.color) {
          moves.push({ to: ti, capture: true });
        }
      }
    }

    if (piece.type === 'knight') {
      const deltas = [
        [-2, -1], [-2, 1],
        [-1, -2], [-1, 2],
        [1, -2], [1, 2],
        [2, -1], [2, 1]
      ];
      for (const [dr, dc] of deltas) addMove(r + dr, c + dc);
    }

    if (piece.type === 'bishop' || piece.type === 'rook' || piece.type === 'queen') {
      const directions = [];
      if (piece.type === 'bishop' || piece.type === 'queen') {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }
      if (piece.type === 'rook' || piece.type === 'queen') {
        directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }

      for (const [dr, dc] of directions) {
        let nr = r + dr;
        let nc = c + dc;
        while (isInside(nr, nc)) {
          const toIdx = rcToIdx(nr, nc);
          const target = getPieceAt(toIdx);
          if (!target) {
            moves.push({ to: toIdx, capture: false });
          } else {
            if (target.color !== piece.color) moves.push({ to: toIdx, capture: true });
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    }

    if (piece.type === 'king') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          addMove(r + dr, c + dc);
        }
      }
    }

    return moves;
  }

  function findKing(color) {
    for (let i = 0; i < N * N; i++) {
      const piece = getPieceAt(i);
      if (piece && piece.type === 'king' && piece.color === color) {
        return i;
      }
    }
    return -1;
  }

  // Checks if squareIdx is attacked by any piece of attackerColor
  function isSquareAttackedBy(targetIdx, attackerColor) {
    const { r: tr, c: tc } = idxToRC(targetIdx);

    for (let i = 0; i < N * N; i++) {
      const piece = getPieceAt(i);
      if (!piece || piece.color !== attackerColor) continue;

      const { r: pr, c: pc } = idxToRC(i);

      if (piece.type === 'pawn') {
        const dir = piece.color === 'w' ? -1 : 1;
        if (tr === pr + dir && (tc === pc - 1 || tc === pc + 1)) {
          return true;
        }
      } else if (piece.type === 'knight') {
        const dr = Math.abs(tr - pr);
        const dc = Math.abs(tc - pc);
        if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) {
          return true;
        }
      } else if (piece.type === 'king') {
        const dr = Math.abs(tr - pr);
        const dc = Math.abs(tc - pc);
        if (dr <= 1 && dc <= 1) {
          return true;
        }
      } else if (piece.type === 'bishop' || piece.type === 'rook' || piece.type === 'queen') {
        const isDiagonal = Math.abs(tr - pr) === Math.abs(tc - pc);
        const isStraight = tr === pr || tc === pc;

        if (piece.type === 'bishop' && !isDiagonal) continue;
        if (piece.type === 'rook' && !isStraight) continue;
        if (piece.type === 'queen' && !isDiagonal && !isStraight) continue;

        const dr = Math.sign(tr - pr);
        const dc = Math.sign(tc - pc);
        let nr = pr + dr;
        let nc = pc + dc;
        let pathClear = true;
        while (nr !== tr || nc !== tc) {
          if (getPieceAt(rcToIdx(nr, nc))) {
            pathClear = false;
            break;
          }
          nr += dr;
          nc += dc;
        }
        if (pathClear) return true;
      }
    }
    return false;
  }

  function isKingInCheck(color) {
    const kingIdx = findKing(color);
    if (kingIdx === -1) return false;
    const opponentColor = color === 'w' ? 'b' : 'w';
    return isSquareAttackedBy(kingIdx, opponentColor);
  }

  function isMoveLeavingKingInCheck(fromIdx, toIdx, color) {
    const fromText = squares[fromIdx].textContent;
    const toText = squares[toIdx].textContent;

    // Simulate move
    squares[toIdx].textContent = fromText;
    squares[fromIdx].textContent = '';

    const inCheck = isKingInCheck(color);

    // Undo move
    squares[fromIdx].textContent = fromText;
    squares[toIdx].textContent = toText;

    return inCheck;
  }

  function getLegalMoves(fromIdx) {
    const piece = getPieceAt(fromIdx);
    if (!piece) return [];
    const pseudoMoves = getPseudoLegalMoves(fromIdx);
    return pseudoMoves.filter(m => !isMoveLeavingKingInCheck(fromIdx, m.to, piece.color));
  }

  function hasAnyLegalMoves(color) {
    for (let i = 0; i < N * N; i++) {
      const piece = getPieceAt(i);
      if (piece && piece.color === color) {
        if (getLegalMoves(i).length > 0) return true;
      }
    }
    return false;
  }

  function updateCheckHighlights() {
    squares.forEach(sq => sq.classList.remove('check'));
    
    if (isKingInCheck('w')) {
      const kingIdx = findKing('w');
      if (kingIdx !== -1) squares[kingIdx].classList.add('check');
    }
    if (isKingInCheck('b')) {
      const kingIdx = findKing('b');
      if (kingIdx !== -1) squares[kingIdx].classList.add('check');
    }
  }


  // UI elements
  let statusEl = document.querySelector('.chess-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.className = 'chess-status';
    statusEl.style.margin = '10px auto';
    statusEl.style.maxWidth = '700px';
    statusEl.style.textAlign = 'center';
    statusEl.style.fontFamily = 'Arial, sans-serif';
    statusEl.style.fontSize = '16px';
    statusEl.textContent = '';
    boardEl.insertAdjacentElement('afterend', statusEl);
  }

  let gameMode = 'pvp'; // 'pvp' or 'pve'
  let turn = 'w';
  let selectedIdx = null;
  let legalCache = [];
  let promotionResolve = null;

  function updateStatus(text) {
    statusEl.textContent = text;
  }

  function coordLabel(i) {
    const { r, c } = idxToRC(i);
    const file = 'abcdefgh'[c];
    const rank = (8 - r);
    return `${file}${rank}`;
  }

  // Confetti Particle System
  let stopConfettiFn = null;
  function startCelebration() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const resizeHandler = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeHandler);

    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    const particles = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        r: Math.random() * 6 + 4,
        d: Math.random() * height,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: 0
      });
    }

    let animationId;
    function draw() {
      ctx.clearRect(0, 0, width, height);
      let active = false;

      particles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.x += Math.sin(p.tiltAngle);
        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;

        if (p.y <= height) {
          active = true;
        } else {
          p.x = Math.random() * width;
          p.y = -20;
          p.tilt = Math.random() * 10 - 5;
        }

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });

      if (active) {
        animationId = requestAnimationFrame(draw);
      } else {
        canvas.remove();
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeHandler);
      canvas.remove();
    };
  }

  // Modal Setup
  const modalOverlay = document.getElementById('winner-modal-overlay');
  const winnerTitle = document.getElementById('winner-title');
  const winnerMessage = document.getElementById('winner-message');
  const playAgainBtn = document.getElementById('play-again-btn');

  // Pawn Promotion Setup
  const promotionOverlay = document.getElementById('promotion-modal-overlay');
  if (promotionOverlay) {
    const optionsContainer = promotionOverlay.querySelector('.promotion-options');
    optionsContainer.addEventListener('click', (e) => {
      const button = e.target.closest('.promotion-option');
      if (button && promotionResolve) {
        const type = button.dataset.piece;
        promotionOverlay.classList.remove('active');
        const resolveFn = promotionResolve;
        promotionResolve = null;
        resolveFn(type);
      }
    });
  }

  function promptPromotion(color) {
    return new Promise((resolve) => {
      promotionResolve = resolve;

      // Update symbols
      const symbols = color === 'w' 
        ? { queen: '♕', rook: '♖', bishop: '♗', knight: '♘' }
        : { queen: '♛', rook: '♜', bishop: '♝', knight: '♞' };

      const options = promotionOverlay.querySelectorAll('.promotion-option');
      options.forEach(button => {
        const type = button.dataset.piece;
        const symbolSpan = button.querySelector('.piece-symbol');
        if (symbolSpan) {
          symbolSpan.textContent = symbols[type];
          symbolSpan.className = 'piece-symbol'; // reset
          symbolSpan.classList.add(color === 'w' ? 'piece-w' : 'piece-b');
        }
      });

      promotionOverlay.classList.add('active');
    });
  }

  function showWinner(winnerColor, endReason) {
    if (winnerColor === 'draw') {
      winnerTitle.textContent = `It's a Draw!`;
      winnerMessage.textContent = `Stalemate - no legal moves available.`;
    } else {
      const winnerName = winnerColor === 'w' ? 'White' : 'Black';
      winnerTitle.textContent = `${winnerName} Wins!`;
      if (endReason === 'checkmate') {
        winnerMessage.textContent = `${winnerName} has delivered Checkmate!`;
      } else {
        winnerMessage.textContent = `${winnerName} has won the game!`;
      }
    }
    modalOverlay.classList.add('active');
    if (winnerColor !== 'draw') {
      stopConfettiFn = startCelebration();
    }
  }

  function hideWinner() {
    modalOverlay.classList.remove('active');
    if (stopConfettiFn) {
      stopConfettiFn();
      stopConfettiFn = null;
    }
  }

  // AI Piece value mapping
  const PIECE_VALUES = {
    'pawn': 10,
    'knight': 30,
    'bishop': 30,
    'rook': 50,
    'queen': 90,
    'king': 10000
  };

  // AI Move function
  function makeComputerMove() {
    if (gameMode !== 'pve' || turn !== 'b') return;

    updateStatus('Computer is thinking...');

    // Gather all legal moves for Black
    const allMoves = [];
    for (let i = 0; i < N * N; i++) {
      const piece = getPieceAt(i);
      if (piece && piece.color === 'b') {
        const moves = getLegalMoves(i);
        for (const m of moves) {
          allMoves.push({
            from: i,
            to: m.to,
            capture: m.capture,
            piece: piece
          });
        }
      }
    }

    if (allMoves.length === 0) {
      if (isKingInCheck('b')) {
        showWinner('w', 'checkmate');
      } else {
        showWinner('draw', 'stalemate');
      }
      return;
    }

    // Score each move using simple heuristics
    allMoves.forEach(move => {
      let score = 0;
      const targetPiece = getPieceAt(move.to);

      // 1. Capture bonus
      if (move.capture && targetPiece) {
        score += PIECE_VALUES[targetPiece.type] * 10;
      }

      // 2. Safety check: avoid moving to squares under attack by White
      if (isSquareAttackedBy(move.to, 'w')) {
        score -= PIECE_VALUES[move.piece.type] * 5;
      }

      // 3. Defense bonus: save piece if currently under attack
      if (isSquareAttackedBy(move.from, 'w')) {
        score += PIECE_VALUES[move.piece.type] * 3;
      }

      // 4. Positional bonus: move down (towards row index 7)
      const toCoords = idxToRC(move.to);
      score += toCoords.r * 0.5;

      // 5. Center control: rows 3-4, columns 2-5
      if (toCoords.r >= 3 && toCoords.r <= 4 && toCoords.c >= 2 && toCoords.c <= 5) {
        score += 2;
      }

      // 6. Variance
      score += Math.random() * 3;

      move.score = score;
    });

    // Sort moves descending
    allMoves.sort((a, b) => b.score - a.score);

    // Make best move with delay
    setTimeout(() => {
      // Re-verify that game state has not changed during the delay
      if (gameMode !== 'pve' || turn !== 'b') return;

      const bestMove = allMoves[0];
      const movingPiece = getPieceAt(bestMove.from);

      setPieceAt(bestMove.to, movingPiece);
      setPieceAt(bestMove.from, null);

      // Pawn promotion check for Black
      if (movingPiece.type === 'pawn') {
        const { r } = idxToRC(bestMove.to);
        if (r === 7) {
          movingPiece.type = 'queen';
          movingPiece.unicode = '♛';
          setPieceAt(bestMove.to, movingPiece);
        }
      }

      // next turn
      clearHighlights();
      selectedIdx = null;
      legalCache = [];
      turn = 'w';

      updateCheckHighlights();

      if (!hasAnyLegalMoves('w')) {
        if (isKingInCheck('w')) {
          showWinner('b', 'checkmate');
        } else {
          showWinner('draw', 'stalemate');
        }
        return;
      }

      let statusText = 'White to move';
      if (isKingInCheck('w')) {
        statusText += ' - CHECK!';
      }
      updateStatus(statusText);
    }, 600);
  }

  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      hideWinner();
      initGame();
    });
  }

  function initGame() {
    boardEl.innerHTML = initialHTML;
    squares = Array.from(boardEl.querySelectorAll('.box1, .box2'));

    if (squares.length !== N * N) {
      console.warn('Expected 64 squares, found:', squares.length);
    }

    turn = 'w';
    selectedIdx = null;
    legalCache = [];
    clearHighlights();
    updateCheckHighlights();
    updateStatus('White to move');

    squares.forEach((sq, i) => {
      sq.style.cursor = 'pointer';
      sq.dataset.sq = String(i);

      const piece = getPieceAt(i);
      if (piece) {
        sq.classList.add(piece.color === 'w' ? 'piece-w' : 'piece-b');
      }

      sq.addEventListener('click', async () => {
        if (gameMode === 'pve' && turn === 'b') return;
        const piece = getPieceAt(i);

        // Click same selected piece => deselect
        if (selectedIdx === i) {
          clearHighlights();
          selectedIdx = null;
          legalCache = [];
          updateStatus(turn === 'w' ? 'White to move' : 'Black to move');
          return;
        }

        // If nothing selected: select only if piece belongs to current turn
        if (selectedIdx === null) {
          if (piece && piece.color === turn) {
            clearHighlights();
            selectedIdx = i;
            sq.classList.add('selected');
            legalCache = getLegalMoves(selectedIdx);
            for (const m of legalCache) {
              setHighlight(m.to, m.capture ? 'capture' : 'move');
            }
            updateStatus(`Selected ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type} at ${coordLabel(i)}. Choose move.`);
          } else {
            updateStatus('Select your piece');
          }
          return;
        }

        // If something selected: try move
        const move = legalCache.find(m => m.to === i);
        if (!move) {
          // if clicked another own piece, switch selection
          if (piece && piece.color === turn) {
            clearHighlights();
            selectedIdx = i;
            sq.classList.add('selected');
            legalCache = getLegalMoves(selectedIdx);
            for (const m of legalCache) setHighlight(m.to, m.capture ? 'capture' : 'move');
            updateStatus(`Selected ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type} at ${coordLabel(i)}. Choose move.`);
          } else {
            updateStatus('Not a legal move');
          }
          return;
        }

        // Make move
        const movingPiece = getPieceAt(selectedIdx);

        setPieceAt(move.to, movingPiece);
        setPieceAt(selectedIdx, null);

        // Pawn promotion check
        if (movingPiece.type === 'pawn') {
          const { r } = idxToRC(move.to);
          if ((movingPiece.color === 'w' && r === 0) || (movingPiece.color === 'b' && r === 7)) {
            // Wait for user to select the piece
            const chosenType = await promptPromotion(movingPiece.color);
            movingPiece.type = chosenType;
            
            const symbols = movingPiece.color === 'w' 
              ? { queen: '♕', rook: '♖', bishop: '♗', knight: '♘' }
              : { queen: '♛', rook: '♜', bishop: '♝', knight: '♞' };
              
            movingPiece.unicode = symbols[chosenType];
            setPieceAt(move.to, movingPiece);
          }
        }

        // next turn
        clearHighlights();
        selectedIdx = null;
        legalCache = [];
        turn = turn === 'w' ? 'b' : 'w';

        updateCheckHighlights();

        if (!hasAnyLegalMoves(turn)) {
          if (isKingInCheck(turn)) {
            const winner = turn === 'w' ? 'b' : 'w';
            showWinner(winner, 'checkmate');
          } else {
            showWinner('draw', 'stalemate');
          }
          return;
        }

        let statusText = turn === 'w' ? 'White to move' : 'Black to move';
        if (isKingInCheck(turn)) {
          statusText += ' - CHECK!';
        }
        updateStatus(statusText);

        if (gameMode === 'pve' && turn === 'b') {
          makeComputerMove();
        }
      });
    });
  }

  // Mode Selector Buttons
  const btnPvP = document.getElementById('btn-pvp');
  const btnPvE = document.getElementById('btn-pve');

  if (btnPvP && btnPvE) {
    btnPvP.addEventListener('click', () => {
      if (gameMode === 'pvp') return;
      gameMode = 'pvp';
      btnPvP.classList.add('active');
      btnPvE.classList.remove('active');
      initGame();
    });

    btnPvE.addEventListener('click', () => {
      if (gameMode === 'pve') return;
      gameMode = 'pve';
      btnPvE.classList.add('active');
      btnPvP.classList.remove('active');
      initGame();
    });
  }

  // Start the game for the first time
  initGame();
})();
