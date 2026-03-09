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
    'round3', 'processing', 'results'
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
    showScreen('processing');

    var score = Scoring.finalScore(roundData);
    var progressBar = $('progress-bar');
    var progressText = $('progress-text');

    // Attempt AI-generated report
    Report.generateReport(roundData, score, function (progress) {
      if (progressBar) {
        progressBar.style.width = progress + '%';
      }
    }).then(function (html) {
      var frame = $('report-frame');
      if (frame) {
        frame.srcdoc = html;
      }
      showScreen('results');
    }).catch(function (err) {
      console.error('[Pathfinder] Report generation failed:', err);
      if (progressText) {
        progressText.textContent = 'Report generation failed. Showing summary...';
      }
      // Fall back to the deterministic report after a brief pause
      setTimeout(function () {
        var fallbackResults = Scoring.generateResults(roundData);
        var fallbackHtml = buildFallbackReportHtml(fallbackResults);
        var frame = $('report-frame');
        if (frame) {
          frame.srcdoc = fallbackHtml;
        }
        showScreen('results');
      }, 1500);
    });
  }

  /**
   * Build a simple fallback HTML report when the AI call fails.
   * Uses the deterministic Scoring module results.
   */
  function buildFallbackReportHtml(r) {
    var e = Report.escapeHtml;
    var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var percentile = Report.estimatePercentile(r.score);
    var impactLabel = r.score >= 65 ? 'Positive' : r.score >= 40 ? 'Neutral' : 'Needs Attention';
    var impactClass = r.score >= 65 ? 'positive' : r.score >= 40 ? 'neutral' : 'attention';

    var content = {
      scoreSummary: r.summary,
      everydayAnalogy: r.analogy,
      pathfindingStyle: { name: r.style.label, description: r.style.description },
      scoreReflection: 'This score is based on your Pathfinder performance today. It reflects this specific task on this specific day, not a permanent measure. Factors like energy, sleep, and environment shape performance. Retesting can show whether the pattern holds.',
      narrative: r.summary + ' ' + r.interpretation,
      suggestions: r.suggestions.map(function (s) { return { title: 'Suggestion', body: s }; }),
      takeaway: r.takeaway
    };

    return Report.buildReportHtml({
      content: content,
      score: r.score,
      rounds: r.rounds,
      roundLabels: r.roundLabels,
      date: date
    });
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
    var frame = $('report-frame');
    if (frame) frame.srcdoc = '';
    var progressBar = $('progress-bar');
    if (progressBar) progressBar.style.width = '0%';
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
