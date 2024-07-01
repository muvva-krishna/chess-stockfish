var board = null;
var game = new Chess();
var moveHistory = [];

var $status = $('#status');
var $fen = $('#fen');
var $pgn = $('#pgn');
var stockfishPlayer = new Worker('stockfish.js');
var stockfishEvaluator = new Worker('stockfish.js');
var skillLevel = 0;

var FEN_INPUT = '';
var PGN_INPUT = '';
var BEST_MOVE_INPUT = '';
var SEQUENCE_OF_BEST_MOVES_INPUT = '';
var ALTERNATIVE_MOVE_1 = '';
var ALTERNATIVE_MOVE_2 = '';
var PLAYER_INPUT = '';

function initializeStockfish() {
  stockfishPlayer.postMessage('uci');
  stockfishEvaluator.postMessage('uci');
  console.log('Stockfish initialization started');
}

function setSkillLevel(level) {
  stockfishPlayer.postMessage(`setoption name Skill Level value ${level}`);
  console.log(`Set Stockfish skill level to ${level}`);
}

function onDragStart(source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false;

  // only pick up pieces for White
  if (piece.search(/^b/) !== -1) return false;
}

function onDrop(source, target) {
  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: "q", // NOTE: always promote to a queen for example simplicity
  });

  // illegal move
  if (move === null) return "snapback";

  // make Stockfish move after player move
  window.setTimeout(makeStockfishMove, 250);
  moveHistory.push(game.history({ verbose: true }).slice(-1)[0]);
  displayPGN();
  displayFEN();
  updateButtons();
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd() {
  board.position(game.fen());
}

function makeStockfishMove() {
  stockfishPlayer.postMessage('position fen ' + game.fen());
  stockfishPlayer.postMessage('go depth 15');
}

stockfishPlayer.onmessage = function(event) {
  var message = event.data;

  if (message.startsWith('uciok')) {
    console.log('Stockfish is ready');
  }

  if (message.startsWith('info depth')) {
    var parts = message.split(' ');
    var evaluationIndex = parts.indexOf('score') + 2;
    var evaluation = parts[evaluationIndex];
    if (parts[evaluationIndex - 1] === 'cp') {
      evaluation = (evaluation / 100.0).toFixed(2);
    } else if (parts[evaluationIndex - 1] === 'mate') {
      evaluation = '#' + evaluation;
    }
    document.getElementById('evaluation').innerText = 'Evaluation: ' + evaluation;
  }

  if (message.startsWith('bestmove')) {
    var bestMove = message.split(' ')[1];
    game.move({
      from: bestMove.substring(0, 2),
      to: bestMove.substring(2, 4),
      promotion: 'q'
    });
    board.position(game.fen());
    updateStatus();

    // Now that StockfishPlayer has moved, use StockfishEvaluator for move suggestions
    suggestTopMoves();
  }
};

function suggestTopMoves() {
  stockfishEvaluator.postMessage('position fen ' + game.fen());
  stockfishEvaluator.postMessage('go depth 15');
}

stockfishEvaluator.onmessage = function(event) {
  var message = event.data;

  if (message.startsWith('uciok')) {
    console.log('Stockfish Evaluator is ready');
  }

  if (message.startsWith('info depth')) {
    var parts = message.split(' ');
    var moveIndex = parts.indexOf('pv') + 1;
    var moves = parts.slice(moveIndex, moveIndex + 6).join(' ');
    SEQUENCE_OF_BEST_MOVES_INPUT = moves;

    BEST_MOVE_INPUT = moves.split(' ')[0];
    ALTERNATIVE_MOVE_1 = moves.split(' ')[2] || '';
    ALTERNATIVE_MOVE_2 = moves.split(' ')[4] || '';

    document.getElementById('bestMove').innerText = BEST_MOVE_INPUT;
    document.getElementById('altMove1').innerText = ALTERNATIVE_MOVE_1;
    document.getElementById('altMove2').innerText = ALTERNATIVE_MOVE_2;

    console.log('SEQUENCE_OF_BEST_MOVES_INPUT:', SEQUENCE_OF_BEST_MOVES_INPUT);
    console.log('BEST_MOVE_INPUT:', BEST_MOVE_INPUT);
    console.log('ALTERNATIVE_MOVE_1:', ALTERNATIVE_MOVE_1);
    console.log('ALTERNATIVE_MOVE_2:', ALTERNATIVE_MOVE_2);
  }
};

function updateStatus() {
  var status = '';

  var moveColor = 'White';
  if (game.turn() === 'b') {
    moveColor = 'Black';
  }

  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.';
  } else if (game.in_draw()) {
    status = 'Game over, drawn position';
  } else {
    status = moveColor + ' to move';

    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check';
    }
  }

  $status.html(status);
  $fen.html(game.fen());
  $pgn.html(game.pgn());

  FEN_INPUT = game.fen();
  PGN_INPUT = game.pgn();
  PLAYER_INPUT = moveColor;

  console.log("FEN_INPUT:", FEN_INPUT);
  console.log("PGN_INPUT:", PGN_INPUT);
  console.log("BEST_MOVE_INPUT:", BEST_MOVE_INPUT);
  console.log("SEQUENCE_OF_BEST_MOVES_INPUT:", SEQUENCE_OF_BEST_MOVES_INPUT);
  console.log("ALTERNATIVE_MOVE_1:", ALTERNATIVE_MOVE_1);
  console.log("ALTERNATIVE_MOVE_2:", ALTERNATIVE_MOVE_2);
}

function startGame() {
  game.reset();
  board.start();
  moveHistory = []; // reset move history
  displayPGN();
  displayFEN();
  updateButtons();

  skillLevel = document.getElementById('levelSelect').value;
  initializeStockfish();
  setSkillLevel(skillLevel);
}

function undoMove() {
  if (moveHistory.length > 0) {
    game.undo();
    moveHistory.pop();
    board.position(game.fen());
    displayPGN();
    displayFEN();
    updateButtons();
  }
}

function updateButtons() {
  var undoBtn = document.getElementById("undoBtn");
  undoBtn.disabled = moveHistory.length === 0;
}

var config = {
  draggable: true,
  position: "start",
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
};
board = Chessboard("myBoard", config);

// Add event listeners to buttons
document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("undoBtn").addEventListener("click", undoMove);
document.getElementById("setFenBtn").addEventListener("click", setFEN);

// Display PGN and FEN under the board
function displayPGN() {
  var pgn = game.pgn({ max_width: 5, newline_char: '<br />' });
  
  // Extracting only the move sequence without setup tags
  var startIndex = pgn.indexOf(']');
  var pgnText = startIndex !== -1 ? pgn.slice(startIndex + 1).trim() : pgn.trim();
  
  document.getElementById("pgnDisplay").innerHTML = pgnText;
}

function displayFEN() {
  var fen = game.fen();
  document.getElementById("fenDisplay").textContent = fen;
}

// Set FEN string and update board
function setFEN() {
  var fenInput = document.getElementById("fenInput").value.trim();
  if (game.load(fenInput)) {
    board.position(game.fen());
    moveHistory = game.history({ verbose: true });
    displayPGN();
    displayFEN();
    updateButtons();
  } else {
    alert("Invalid FEN string");
  }
}

$(document).ready(function() {
  var urlParams = new URLSearchParams(window.location.search);
  var level = urlParams.get('level');
  if (level) {
    skillLevel = level;
    setSkillLevel(skillLevel);
  }
  initializeStockfish();
});
