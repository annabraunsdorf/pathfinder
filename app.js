/**
 * Pathfinder — main application state machine and event handling.
 */

(function () {
  'use strict';

  // --- Screen flow ---
  var SCREENS = [
    'title', 'measures', 'processingSpeed', 'cognitiveFlexibility', 'howItWorks',
    'practice', 'practiceComplete',
    'round1', 'interstitial2',
    'round2', 'interstitial3',
    'round3', 'results'
  ];

  // --- Round config (12 nodes each, different cognitive rules) ---
  var ROUND_CONFIG = {
    practice: { roundType: 'practice', isPractice: true },
    round1:   { roundType: 'numbersLetters', isPractice: false },
    round2:   { roundType: 'numbersMonths', isPractice: false },
    round3:   { roundType: 'reverseNumbersLetters', isPractice: false }
  };

  // --- State ---
  var currentScreen = 'title';
  var roundData = []; // { time, errors } per round
  var activeRound = null;

  // --- DOM helpers ---
  function $(id) { return document.getElementById(id); }
  function getScreen(name) { return document.getElementById('screen-' + name); }

  // --- Screen transitions ---
  function showScreen(name) {
    var prev = getScreen(currentScreen);
    var next = getScreen(name);
    if (prev) prev.classList.add('hidden');
    if (next) next.classList.remove('hidden');
    currentScreen = name;

    // Initialize round if needed
    if (ROUND_CONFIG[name]) {
      initRound(name);
    }
  }

  function goNext() {
    var idx = SCREENS.indexOf(currentScreen);
    if (idx >= 0 && idx < SCREENS.length - 1) {
      showScreen(SCREENS[idx + 1]);
    }
  }

  // --- Round logic ---
  function initRound(roundKey) {
    var config = ROUND_CONFIG[roundKey];
    var container = $(roundKey + '-nodes');
    var svg = $(roundKey + '-lines');

    if (!container || !svg) return;

    Nodes.clearLines(svg);

    var area = container.parentElement;
    var w = area.clientWidth;
    var h = area.clientHeight;

    var layout = Nodes.generateLayout(w, h, config.roundType);
    var rendered = Nodes.renderNodes(container, layout, config.roundType);
    var sequence = Nodes.generateSequence(config.roundType);

    activeRound = {
      nodes: rendered,
      sequence: sequence,
      currentIndex: 0,
      startTime: performance.now(),
      errors: 0,
      timerRAF: null,
      roundKey: roundKey,
      isPractice: config.isPractice,
      svg: svg
    };

    // Highlight first target in practice
    if (config.isPractice) {
      highlightNextTarget();
    }

    // Start timer display for test rounds
    if (!config.isPractice) {
      startTimerDisplay(roundKey);
    }

    // Bind tap events
    rendered.forEach(function (node) {
      node.element.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        handleNodeTap(node.label);
      });
    });
  }

  function highlightNextTarget() {
    if (!activeRound || !activeRound.isPractice) return;
    activeRound.nodes.forEach(function (n) {
      n.element.classList.remove('pulse');
    });
    var targetLabel = activeRound.sequence[activeRound.currentIndex];
    var targetNode = findNode(targetLabel);
    if (targetNode) {
      targetNode.element.classList.add('pulse');
    }
  }

  function findNode(label) {
    if (!activeRound) return null;
    for (var i = 0; i < activeRound.nodes.length; i++) {
      if (activeRound.nodes[i].label === label) return activeRound.nodes[i];
    }
    return null;
  }

  function handleNodeTap(label) {
    if (!activeRound) return;
    var expected = activeRound.sequence[activeRound.currentIndex];

    if (label === expected) {
      var node = findNode(label);
      if (!node) return;
      node.element.classList.add('correct');
      node.element.classList.remove('pulse');

      if (activeRound.currentIndex > 0) {
        var prevLabel = activeRound.sequence[activeRound.currentIndex - 1];
        var prevNode = findNode(prevLabel);
        if (prevNode) {
          Nodes.drawLine(activeRound.svg, prevNode, node);
        }
      }

      activeRound.currentIndex++;

      if (activeRound.currentIndex >= activeRound.sequence.length) {
        completeRound();
      } else if (activeRound.isPractice) {
        highlightNextTarget();
      }
    } else {
      activeRound.errors++;
      var wrongNode = findNode(label);
      if (wrongNode && !wrongNode.element.classList.contains('correct')) {
        wrongNode.element.classList.add('error');
        setTimeout(function () {
          wrongNode.element.classList.remove('error');
        }, 200);
      }
    }
  }

  function completeRound() {
    var elapsed = (performance.now() - activeRound.startTime) / 1000;
    var roundKey = activeRound.roundKey;
    var isPractice = activeRound.isPractice;

    if (activeRound.timerRAF) {
      cancelAnimationFrame(activeRound.timerRAF);
    }

    if (!isPractice) {
      roundData.push({
        time: Math.round(elapsed * 10) / 10,
        errors: activeRound.errors
      });
    }

    activeRound = null;

    setTimeout(function () {
      if (isPractice) {
        showScreen('practiceComplete');
      } else if (roundKey === 'round3') {
        showResults();
      } else {
        goNext();
      }
    }, 400);
  }

  // --- Timer display ---
  function startTimerDisplay(roundKey) {
    var timerEl = $('timer-' + roundKey);
    if (!timerEl) return;

    function update() {
      if (!activeRound || activeRound.roundKey !== roundKey) return;
      var elapsed = (performance.now() - activeRound.startTime) / 1000;
      timerEl.textContent = elapsed.toFixed(1) + 's';
      activeRound.timerRAF = requestAnimationFrame(update);
    }
    activeRound.timerRAF = requestAnimationFrame(update);
  }

  // --- Results ---
  function showResults() {
    var results = Scoring.generateResults(roundData);
    renderResults(results);
    showScreen('results');
  }

  function renderResults(r) {
    var container = $('results-container');
    var html = '';

    // 1. Score ring
    html += renderScoreRing(r.score);

    // 2. Summary
    html += '<div class="results-section">';
    html += '<div class="results-card"><p class="results-text">' + r.summary + '</p></div>';
    html += '</div>';

    // 3. Everyday analogy
    html += '<div class="results-section">';
    html += '<div class="results-section-title">In everyday terms</div>';
    html += '<div class="results-card"><p class="results-text-secondary">' + r.analogy + '</p></div>';
    html += '</div>';

    // 4. Disclaimer
    html += '<div class="disclaimer-card">';
    html += '<p class="disclaimer-text">This is an informal cognitive exercise, not a clinical assessment. Results are meant for personal insight and should not be used for medical or diagnostic purposes.</p>';
    html += '</div>';

    // 5. Style classification
    html += '<div class="results-section">';
    html += '<div class="results-section-title">Your pathfinding style</div>';
    html += '<div class="results-card">';
    html += '<div class="style-label">' + r.style.label + '</div>';
    html += '<p class="results-text-secondary">' + r.style.description + '</p>';
    html += '</div></div>';

    // 6. Round breakdown with cognitive labels
    html += '<div class="results-section">';
    html += '<div class="results-section-title">Round by round</div>';
    html += '<div class="results-card"><div class="round-breakdown">';
    for (var i = 0; i < r.rounds.length; i++) {
      html += '<div class="round-row">';
      html += '<div>';
      html += '<span class="round-row-label">Round ' + (i + 1) + '</span>';
      html += '<span class="round-row-rule">' + r.roundLabels[i].short + '</span>';
      html += '<span class="round-row-rule-detail">' + r.roundLabels[i].rule + '</span>';
      if (r.highlights[i]) {
        html += '<span class="round-row-note">' + r.highlights[i] + '</span>';
      }
      html += '</div>';
      html += '<div class="round-row-stats">' + r.rounds[i].time.toFixed(1) + 's';
      if (r.rounds[i].errors > 0) {
        html += ' &middot; ' + r.rounds[i].errors + ' error' + (r.rounds[i].errors !== 1 ? 's' : '');
      }
      html += '</div></div>';
      html += '<div class="round-detail-text">' + r.roundLabels[i].detail + '</div>';
    }
    html += '</div>';
    // Interpretation note
    html += '<div class="interpretation-note">' + r.interpretation + '</div>';
    html += '</div></div>';

    // 7. Suggestions
    if (r.suggestions.length > 0) {
      html += '<div class="results-section">';
      html += '<div class="results-section-title">Tips for improvement</div>';
      html += '<div class="results-card">';
      for (var s = 0; s < r.suggestions.length; s++) {
        html += '<div class="suggestion-item">' + r.suggestions[s] + '</div>';
      }
      html += '</div></div>';
    }

    // 8. Final takeaway
    html += '<div class="final-takeaway">';
    html += '<p class="final-takeaway-text">' + r.takeaway + '</p>';
    html += '</div>';

    container.innerHTML = html;
  }

  function renderScoreRing(score) {
    var radius = 62;
    var circumference = 2 * Math.PI * radius;
    var progress = (score / 100) * circumference;
    var offset = circumference - progress;

    var color = '#4ADE80';
    if (score < 40) color = '#EF4444';
    else if (score < 65) color = '#FBBF24';

    return '<div class="score-ring">' +
      '<svg width="160" height="160" viewBox="0 0 160 160">' +
      '<circle cx="80" cy="80" r="' + radius + '" stroke="#2A2A2E" stroke-width="8" fill="none"/>' +
      '<circle cx="80" cy="80" r="' + radius + '" stroke="' + color + '" stroke-width="8" fill="none" ' +
      'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" stroke-linecap="round"/>' +
      '</svg>' +
      '<div class="score-value">' +
      '<span class="score-number" style="color:' + color + '">' + score + '</span>' +
      '<span class="score-label">out of 100</span>' +
      '</div></div>';
  }

  // --- Reset ---
  function reset() {
    roundData = [];
    activeRound = null;
    ['practice', 'round1', 'round2', 'round3'].forEach(function (key) {
      var container = $(key + '-nodes');
      var svg = $(key + '-lines');
      if (container) container.innerHTML = '';
      if (svg) svg.innerHTML = '';
    });
    $('results-container').innerHTML = '';
    showScreen('title');
  }

  // --- Event delegation ---
  document.addEventListener('pointerdown', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.preventDefault();
    var action = btn.dataset.action;
    if (action === 'next') goNext();
    else if (action === 'reset') reset();
  });

  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // --- Init ---
  showScreen('title');
})();
