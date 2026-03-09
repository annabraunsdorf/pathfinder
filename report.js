/**
 * AI-powered report generation for Pathfinder.
 * Mirrors the Focus report pattern: compute score → call Claude → render HTML.
 */

var Report = (function () {
  'use strict';

  // --- Config ---
  var ANTHROPIC_API_KEY = ''; // Set via Report.setApiKey() for direct API access
  var PROXY_URL = ''; // Set via Report.setProxyUrl() for server-proxied access

  var DISCLAIMER_TEXT = 'This report reflects performance on a specific cognitive task and is not a clinical assessment. Results may vary based on energy, environment, and engagement. For concerns about cognitive health, consult a qualified professional.';

  // --- System prompt ---

  var SYSTEM_PROMPT = 'You generate JSON content for a cognitive flexibility performance report. The participant completed a Pathfinder test (adapted from the Trail Making Test), which measures processing speed and cognitive flexibility through three rounds of increasingly complex sequence-connection tasks.\n\n' +
    'THE THREE ROUNDS:\n' +
    'Round 1 - Baseline Switching (Numbers and Letters): Alternating between two well-learned sequences (1, A, 2, B...). Tests basic processing speed and set-shifting with overlearned material.\n' +
    'Round 2 - Semantic Retrieval (Numbers and Months): Alternating between numbers and months of the year (1, Jan, 2, Feb...). Months require deeper memory retrieval than the alphabet, adding cognitive load.\n' +
    'Round 3 - Inhibition + Reversal (Reverse Numbers and Reverse Letters): Counting backward across two sequences simultaneously (26, Z, 25, Y...). Requires suppressing the automatic forward-counting response, taxing inhibitory control and working memory.\n\n' +
    'Each round has a par time (Round 1: 10s, Round 2: 15s, Round 3: 20s). The score is weighted: Round 1 = 20%, Round 2 = 30%, Round 3 = 50%.\n\n' +
    'WHAT THIS TEST REVEALS:\n' +
    '- How well someone navigates familiar, linear sequences (numbers, letters)\n' +
    '- What happens to their speed and efficiency when those sequences are reversed\n' +
    '- What happens when less automatic sequences (months) are introduced\n' +
    '- The overall picture of cognitive flexibility, processing speed, and inhibitory control in daily life\n\n' +
    'RULES:\n' +
    '- Second person voice ("you"/"your"). Never third person.\n' +
    '- No cognitive domain claims beyond what this specific task measures. Describe task performance only.\n' +
    '- No diagnostic or decline language.\n' +
    '- Warm, precise, encouraging tone. Emphasize patterns, not flaws.\n' +
    '- No jargon or clinical language. Write like a smart friend, not a textbook. The test: would a normal person use this word in everyday conversation? Words like "pattern" or "switching" are fine. Terms like "cognitive load," "executive function," "inhibitory control," "set-shifting," or any psychology/neuroscience terminology are not. When in doubt, use the simpler word.\n' +
    '- All values must be plain text (no HTML, no markdown, no **bold**).\n' +
    '- Keep every field concise. This is a mobile report.\n' +
    '- Avoid em dashes.\n' +
    '- Avoid the words "just" or "only" when describing results (these minimize).\n' +
    '- Match qualitative labels to numbers. Every score should have a plain-language descriptor.\n\n' +
    'KEY METRICS TO INTERPRET:\n' +
    '- Round scores (0-100 each): Based on time vs par and errors. Higher = better.\n' +
    '- Composite score (0-100): Weighted average (R1: 20%, R2: 30%, R3: 50%). Higher = better.\n' +
    '- Time vs par: How much faster or slower than the target time for each round.\n' +
    '- Errors per round: Wrong taps. Each error costs 8 points from that round\'s score.\n' +
    '- Round-to-round pattern: The drop (or gain) from R1 to R3 reveals how well the brain handles increasing demands.\n\n' +
    'SCORE INTERPRETATION (composite score):\n' +
    '- 80+ = Strong flexibility and speed across all demands\n' +
    '- 65-79 = Good performance with some areas to develop\n' +
    '- 50-64 = Typical range, clear patterns to build on\n' +
    '- Below 50 = Below typical, specific areas for improvement\n\n' +
    'PATHFINDING STYLE ARCHETYPE SYSTEM:\n\n' +
    'Core archetypes (pick the best fit based on the round-by-round pattern):\n' +
    '"The Steady Navigator" - Consistent speed and accuracy across all three rounds, even as rules got harder. Distractions and rule changes barely slow you down.\n' +
    '"The Strong Starter" - Fast and accurate on familiar sequences, but performance drops as rules get more complex. Handles routine well but new demands create friction.\n' +
    '"The Adaptive Builder" - Warms up into the task and gets stronger as it progresses, even as rounds get harder. Handles increasing complexity well once engaged.\n' +
    '"The Speed-First Mover" - Fast across the board, but errors increase with complexity. Prioritizes momentum over verification.\n' +
    '"The Careful Navigator" - Slower overall but highly accurate. Takes time to verify before committing. Rarely makes mistakes but trades speed for precision.\n' +
    '"The Reversal-Resistant" - Strong on forward sequences (Rounds 1 and 2), but the backward round (Round 3) is where things slow down significantly. Suppressing the automatic forward response is the challenge.\n' +
    '"The Retrieval-Sensitive" - Numbers and letters are handled well, but the month sequence (Round 2) introduces noticeable hesitation. Pulling from less automatic memory takes extra effort.\n' +
    '"The Momentum Builder" - Starts slow but builds speed and confidence as the test progresses. Performance in later rounds exceeds early rounds.\n\n' +
    'Every archetype must have a clear upside. No generic strengths/challenges bullets. Use "The" prefix.\n\n' +
    'OUTPUT: A single JSON object. No markdown fencing, no explanation.\n' +
    '{\n' +
    '  "scoreSummary": "One sentence summarizing performance with the score embedded (e.g., \'You navigated all three rounds with strong precision, scoring 78 out of 100.\')",\n' +
    '  "everydayAnalogy": "One sentence everyday analogy that makes the result feel concrete and recognizable, tied to the specific pattern you observed (not generic)",\n' +
    '  "pathfindingStyle": { "name": "The [Archetype Name]", "description": "2-3 sentences, plain recognizable language, must include a clear upside, should reference the specific round pattern that led to this classification" },\n' +
    '  "scoreReflection": "3-4 sentences: this score is based on your Pathfinder performance, reflects this specific task on this specific day, is not a diagnosis, factors like energy/sleep/environment shape performance, retesting can show whether the pattern holds",\n' +
    '  "narrative": "One paragraph (5-7 sentences): what the round-by-round pattern reveals. How did you handle the familiar number-letter sequence? What happened when months were introduced? What changed when everything was reversed? Connect these patterns to recognizable daily-life moments. Smart friend tone.",\n' +
    '  "suggestions": [\n' +
    '    { "title": "Short title", "body": "One paragraph, practical, builds on strengths, immediately doable, framed as experiment not prescription, tied to something specific from the data" },\n' +
    '    { "title": "Short title", "body": "One paragraph" },\n' +
    '    { "title": "Short title", "body": "One paragraph" }\n' +
    '  ],\n' +
    '  "takeaway": "Short closing paragraph (3-5 sentences). Reframe performance holistically, end encouraging."\n' +
    '}';

  // --- Percentile estimation ---

  function estimatePercentile(score) {
    var z = (score - 55) / 18;
    var absZ = Math.abs(z);
    var t = 1 / (1 + 0.2316419 * absZ);
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    var cdf = z > 0 ? 1 - p : p;
    return Math.min(99, Math.max(1, Math.round(cdf * 100)));
  }

  // --- HTML escaping ---

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- Build HTML report ---

  function buildReportHtml(params) {
    var content = params.content;
    var score = params.score;
    var rounds = params.rounds;
    var roundLabels = params.roundLabels;
    var date = params.date;
    var averageScore = 55;
    var percentile = estimatePercentile(score);

    var cognitiveAgeImpact = score >= 65 ? 'Positive' : score >= 40 ? 'Neutral' : 'Needs Attention';
    var impactClass = score >= 65 ? 'positive' : score >= 40 ? 'neutral' : 'attention';

    // Metric rows for detailed breakdown
    var PAR_TIMES = [10, 15, 20];
    var totalErrors = 0;
    var totalTime = 0;
    for (var i = 0; i < rounds.length; i++) {
      totalErrors += rounds[i].errors;
      totalTime += rounds[i].time;
    }

    var roundRows = '';
    for (var r = 0; r < rounds.length; r++) {
      var diff = rounds[r].time - PAR_TIMES[r];
      var diffText = diff <= 0 ? (Math.abs(diff).toFixed(1) + 's under par') : (diff.toFixed(1) + 's over par');
      var rs = Scoring.roundScore(rounds[r].time, rounds[r].errors, r);
      roundRows += '<tr>' +
        '<td>Round ' + (r + 1) + '</td>' +
        '<td class="value">' + rounds[r].time.toFixed(1) + 's</td>' +
        '<td class="value">' + rounds[r].errors + '</td>' +
        '<td class="value">' + rs + '</td>' +
        '<td class="notes">' + escapeHtml(diffText) + '</td>' +
        '</tr>';
    }

    var suggestionCards = '';
    for (var s = 0; s < content.suggestions.length; s++) {
      suggestionCards += '<div class="suggestion">' +
        '<div class="suggestion-top">' +
        '<div class="suggestion-num">' + (s + 1) + '</div>' +
        '<div class="suggestion-title">' + escapeHtml(content.suggestions[s].title) + '</div>' +
        '</div>' +
        '<p>' + escapeHtml(content.suggestions[s].body) + '</p>' +
        '</div>';
    }

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
      '<title>Pathfinder Report</title>' +
      '<style>' +
      "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');" +
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
      'html{height:100%;overflow-y:scroll;-webkit-overflow-scrolling:touch}' +
      "body{font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;background:#f8fafc;color:#374151;line-height:1.6;max-width:480px;margin:0 auto;padding-bottom:40px;min-height:100%}" +
      '.header{background:linear-gradient(135deg,#0a2e1a 0%,#0f3d22 50%,#1a5c35 100%);color:#fff;padding:32px 24px 28px}' +
      '.header-label{font-size:10px;text-transform:uppercase;letter-spacing:2px;opacity:0.5;margin-bottom:2px}' +
      '.header h1{font-size:22px;font-weight:700;margin:0 0 3px}' +
      '.header-meta{opacity:0.6;font-size:13px}' +
      '.content{padding:24px 20px 32px;background:#f8fafc}' +
      '.score-heading{font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;position:relative;color:#111827}' +
      '.score-info-btn{background:none;border:1.5px solid #bbb;width:16px;height:16px;border-radius:50%;padding:0;cursor:pointer;color:#999;line-height:1;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;font-style:italic;font-family:Georgia,serif;flex-shrink:0}' +
      '.score-tooltip-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.15);z-index:99}' +
      '.score-tooltip{display:none;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;font-size:13px;color:#555;line-height:1.6;box-shadow:0 4px 16px rgba(0,0,0,0.12);position:absolute;left:0;right:0;z-index:100}' +
      '.score-bar-container{position:relative;height:143px;margin-bottom:4px}' +
      '.score-bar-min,.score-bar-max{position:absolute;top:50%;transform:translateY(-50%);font-size:11px;color:#888}' +
      '.score-bar-min{left:0}' +
      '.score-bar-max{right:0}' +
      '.score-bar-area{position:absolute;top:0;bottom:0;left:16px;right:30px}' +
      '.score-bar{position:absolute;top:50%;left:0;right:0;transform:translateY(-50%);height:6px;background:#e5e7eb;border-radius:3px}' +
      '.score-marker{position:absolute;display:flex;flex-direction:column;align-items:center}' +
      '.score-marker.user{bottom:calc(50% - 5px);transform:translateX(-50%)}' +
      '.score-marker.user .score-marker-pill{order:1}' +
      '.score-marker.user .score-marker-stem{order:2}' +
      '.score-marker.user .score-marker-dot{order:3}' +
      '.score-marker.average{top:calc(50% - 5px);transform:translateX(-50%)}' +
      '.score-marker.average .score-marker-dot{order:1}' +
      '.score-marker.average .score-marker-stem{order:2}' +
      '.score-marker.average .score-marker-pill{order:3}' +
      '.score-marker-pill{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap}' +
      '.score-marker.user .score-marker-pill{border:2px solid #22c55e;color:#15803d;background:#fff}' +
      '.score-marker.average .score-marker-pill{border:2px solid #d1d5db;color:#6b7280;background:#fff}' +
      '.score-marker-stem{width:2px;height:16px}' +
      '.score-marker.user .score-marker-stem{background:#22c55e}' +
      '.score-marker.average .score-marker-stem{background:#d1d5db}' +
      '.score-marker-dot{width:10px;height:10px;border-radius:50%}' +
      '.score-marker.user .score-marker-dot{background:#22c55e}' +
      '.score-marker.average .score-marker-dot{background:#d1d5db}' +
      '.percentile{text-align:center;font-size:12px;color:#6b7280;margin-bottom:16px}' +
      '.cognitive-age{display:flex;flex-direction:column;align-items:center;gap:2px;width:100%;padding:14px 16px;border-radius:14px;margin-bottom:16px}' +
      '.cognitive-age-label{font-size:12px;font-weight:600;opacity:0.8}' +
      '.cognitive-age-value{font-size:16px;font-weight:700}' +
      '.cognitive-age.positive{background:#dcfce7;color:#15803d}' +
      '.cognitive-age.neutral{background:#f3f4f6;color:#6b7280}' +
      '.cognitive-age.attention{background:#fef3c7;color:#92400e}' +
      '.score-summary{font-size:14px;color:#4b5563;line-height:1.5;margin-bottom:24px}' +
      '.score-summary strong{color:#111827}' +
      '.archetype{background:#ecfdf5;border-radius:14px;padding:18px 20px;margin-bottom:24px;border:1px solid #d1fae5}' +
      '.archetype-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#059669;margin-bottom:4px}' +
      '.archetype-name{font-size:18px;font-weight:700;color:#111827;margin-bottom:4px}' +
      '.archetype-desc{font-size:13px;line-height:1.6;color:#4b5563}' +
      '.reflection{margin-bottom:24px;background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #e5e7eb}' +
      '.reflection h2{font-size:16px;font-weight:700;margin-bottom:10px;color:#111827}' +
      '.reflection p{font-size:14px;line-height:1.75;color:#4b5563}' +
      '.narrative{margin-bottom:24px;background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #e5e7eb}' +
      '.narrative h2{font-size:16px;font-weight:700;margin-bottom:10px;color:#111827}' +
      '.narrative p{font-size:14px;line-height:1.75;color:#4b5563}' +
      '.suggestions-header{font-size:16px;font-weight:700;margin-bottom:12px;color:#111827}' +
      '.suggestion{background:#fff;border-radius:14px;padding:16px 18px;border:1px solid #e5e7eb;margin-bottom:10px}' +
      '.suggestion-top{display:flex;align-items:center;gap:10px;margin-bottom:4px}' +
      '.suggestion-num{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#059669,#34d399);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}' +
      '.suggestion-title{font-size:14px;font-weight:700;color:#111827}' +
      '.suggestion p{font-size:13px;line-height:1.65;color:#4b5563;padding-left:36px}' +
      '.breakdown{margin-top:24px;margin-bottom:24px;background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #e5e7eb}' +
      '.breakdown-heading{font-size:16px;font-weight:700;margin-bottom:12px;color:#111827}' +
      '.table-wrap{overflow-x:auto;border-radius:10px;border:1px solid #e5e7eb;background:#fff}' +
      'table{width:100%;border-collapse:collapse;font-size:12px}' +
      'thead tr{background:#f3f4f6}' +
      'th{padding:8px 10px;text-align:left;font-weight:700;border-bottom:2px solid #e5e7eb;font-size:11px;color:#111827}' +
      'td{padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#374151}' +
      'td.value{font-weight:600;font-size:12px}' +
      'td.notes{color:#6b7280;font-size:11px}' +
      'tr:nth-child(even){background:#f9fafb}' +
      '.footer{background:linear-gradient(135deg,#0a2e1a 0%,#0f3d22 50%,#1a5c35 100%);color:#fff;border-radius:14px;padding:22px 20px;margin-bottom:24px}' +
      '.footer-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.5;margin-bottom:6px}' +
      '.footer p{font-size:13px;line-height:1.75;opacity:0.92}' +
      '.disclaimer{font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;padding:0 8px}' +
      '</style></head><body>' +
      '<div class="header">' +
      '<div class="header-label">Pathfinder Report</div>' +
      '<h1>Your report</h1>' +
      '<div class="header-meta">' + escapeHtml(date) + '</div>' +
      '</div>' +
      '<div class="content">' +
      '<div class="score-heading">Your score ' +
      '<button class="score-info-btn" onclick="var t=document.querySelector(\'.score-tooltip\'),o=document.querySelector(\'.score-tooltip-overlay\'),v=t.style.display===\'none\'?\'block\':\'none\';t.style.display=v;o.style.display=v">i</button>' +
      '</div>' +
      '<div class="score-tooltip-overlay" style="display:none" onclick="document.querySelector(\'.score-tooltip\').style.display=\'none\';this.style.display=\'none\'"></div>' +
      '<div class="score-tooltip" style="display:none">' + escapeHtml(DISCLAIMER_TEXT) + '</div>' +
      '<div class="score-bar-container">' +
      '<div class="score-bar-min">0</div>' +
      '<div class="score-bar-max">100</div>' +
      '<div class="score-bar-area">' +
      '<div class="score-bar"></div>' +
      '<div class="score-marker user" style="left:' + score + '%">' +
      '<div class="score-marker-pill">You ' + score + '</div>' +
      '<div class="score-marker-stem"></div>' +
      '<div class="score-marker-dot"></div>' +
      '</div>' +
      '<div class="score-marker average" style="left:' + averageScore + '%">' +
      '<div class="score-marker-dot"></div>' +
      '<div class="score-marker-stem"></div>' +
      '<div class="score-marker-pill">Average ' + averageScore + '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="percentile">Better than ' + percentile + '% of people your age</div>' +
      '<div class="cognitive-age ' + impactClass + '">' +
      '<div class="cognitive-age-label">Impact on Cognitive Age</div>' +
      '<div class="cognitive-age-value">' + cognitiveAgeImpact + '</div>' +
      '</div>' +
      '<div class="score-summary"><strong>' + escapeHtml(content.scoreSummary.replace(/\*\*/g, '')) + '</strong> ' + escapeHtml(content.everydayAnalogy) + '</div>' +
      '<div class="archetype">' +
      '<div class="archetype-label">Your Pathfinding Style</div>' +
      '<div class="archetype-name">' + escapeHtml(content.pathfindingStyle.name) + '</div>' +
      '<div class="archetype-desc">' + escapeHtml(content.pathfindingStyle.description) + '</div>' +
      '</div>' +
      '<div class="reflection">' +
      '<h2>What This Score Reflects</h2>' +
      '<p>' + escapeHtml(content.scoreReflection) + '</p>' +
      '</div>' +
      '<div class="narrative">' +
      '<h2>How Your Brain Navigated</h2>' +
      '<p>' + escapeHtml(content.narrative) + '</p>' +
      '</div>' +
      '<div class="suggestions-header">Personalized Suggestions</div>' +
      suggestionCards +
      '<div class="breakdown">' +
      '<div class="breakdown-heading">Round-by-Round Breakdown</div>' +
      '<div class="table-wrap">' +
      '<table>' +
      '<thead><tr><th>Round</th><th>Time</th><th>Errors</th><th>Score</th><th>Note</th></tr></thead>' +
      '<tbody>' + roundRows + '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>' +
      '<div class="footer">' +
      '<div class="footer-label">Takeaway</div>' +
      '<p>' + escapeHtml(content.takeaway) + '</p>' +
      '</div>' +
      '<div class="disclaimer">' + escapeHtml(DISCLAIMER_TEXT) + '</div>' +
      '</div>' +
      '</body></html>';
  }

  // --- Auto-detect proxy URL ---
  function detectProxyUrl() {
    // If explicitly set, use that
    if (PROXY_URL) return PROXY_URL;
    // If running on a server (not file://), use same-origin API route
    if (window.location.protocol === 'https:' || window.location.protocol === 'http:') {
      return window.location.origin + '/api/pathfinder-report';
    }
    return '';
  }

  // --- Build the user message from round data ---

  function buildUserMessage(rounds, score) {
    var PAR_TIMES = [10, 15, 20];
    var ROUND_NAMES = [
      'Round 1: Baseline Switching (Numbers and Letters)',
      'Round 2: Semantic Retrieval (Numbers and Months)',
      'Round 3: Inhibition + Reversal (Reverse Numbers and Reverse Letters)'
    ];

    var today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    var userMessage = 'DATE: ' + today + '\n\n';
    userMessage += 'PATHFINDER TASK METRICS:\n';
    userMessage += '  Composite score: ' + score + '/100\n';
    userMessage += '  Average score: 55\n\n';

    for (var i = 0; i < rounds.length; i++) {
      var rs = Scoring.roundScore(rounds[i].time, rounds[i].errors, i);
      var diff = rounds[i].time - PAR_TIMES[i];
      var diffText = diff <= 0 ? (Math.abs(diff).toFixed(1) + 's under par') : (diff.toFixed(1) + 's over par');
      userMessage += '  ' + ROUND_NAMES[i] + ':\n';
      userMessage += '    Time: ' + rounds[i].time.toFixed(1) + 's (par: ' + PAR_TIMES[i] + 's, ' + diffText + ')\n';
      userMessage += '    Errors: ' + rounds[i].errors + '\n';
      userMessage += '    Round score: ' + rs + '/100\n\n';
    }

    var totalErrors = 0;
    for (var e = 0; e < rounds.length; e++) {
      totalErrors += rounds[e].errors;
    }
    userMessage += '  Total errors across all rounds: ' + totalErrors + '\n\n';

    var r1 = Scoring.roundScore(rounds[0].time, rounds[0].errors, 0);
    var r2 = Scoring.roundScore(rounds[1].time, rounds[1].errors, 1);
    var r3 = Scoring.roundScore(rounds[2].time, rounds[2].errors, 2);
    userMessage += 'ROUND SCORE PATTERN: R1=' + r1 + ', R2=' + r2 + ', R3=' + r3 + '\n';
    userMessage += '  R1 to R2 change: ' + (r2 - r1 > 0 ? '+' : '') + (r2 - r1) + '\n';
    userMessage += '  R1 to R3 change: ' + (r3 - r1 > 0 ? '+' : '') + (r3 - r1) + '\n';
    userMessage += '  R2 to R3 change: ' + (r3 - r2 > 0 ? '+' : '') + (r3 - r2) + '\n\n';

    userMessage += 'Generate the report content as JSON now.';
    return userMessage;
  }

  // --- Generate report via proxy (non-streaming, server-side API key) ---

  function generateViaProxy(proxyUrl, userMessage, onProgress) {
    if (onProgress) onProgress(10);

    // Simulate progress since proxy is non-streaming
    var simProgress = 10;
    var progressInterval = setInterval(function () {
      simProgress += (90 - simProgress) * 0.04;
      if (onProgress) onProgress(Math.min(simProgress, 90));
    }, 300);

    return fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      })
    }).then(function (response) {
      clearInterval(progressInterval);
      if (!response.ok) {
        return response.text().then(function (errText) {
          throw new Error('Proxy error: ' + response.status + ' - ' + errText);
        });
      }
      return response.json();
    }).then(function (data) {
      var fullText = data.content && data.content[0] ? data.content[0].text : '';
      if (onProgress) onProgress(95);
      return fullText;
    });
  }

  // --- Generate report via direct API (streaming, client-side API key) ---

  function generateViaDirect(userMessage, onProgress) {
    if (onProgress) onProgress(10);

    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      })
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (errText) {
          throw new Error('Report generation error: ' + response.status + ' - ' + errText);
        });
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var fullText = '';
      var buffer = '';
      var estimatedTotal = 1500;

      function processStream() {
        return reader.read().then(function (result) {
          if (result.done) return fullText;

          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (var l = 0; l < lines.length; l++) {
            var line = lines[l];
            if (line.indexOf('data: ') !== 0) continue;
            var data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              var event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta && event.delta.text) {
                fullText += event.delta.text;
                var outputTokens = Math.floor(fullText.length / 4);
                if (onProgress) {
                  onProgress(Math.min(90, 10 + (outputTokens / estimatedTotal) * 80));
                }
              }
            } catch (parseErr) {
              // Skip malformed JSON
            }
          }

          return processStream();
        });
      }

      return processStream();
    }).then(function (fullText) {
      if (onProgress) onProgress(95);
      return fullText;
    });
  }

  // --- Main entry point: generate report ---

  function generateReport(rounds, score, onProgress) {
    var today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    var userMessage = buildUserMessage(rounds, score);
    var proxyUrl = detectProxyUrl();

    // Choose strategy: proxy (server-side key) > direct (client-side key) > error
    var fetchPromise;
    if (proxyUrl && !ANTHROPIC_API_KEY) {
      fetchPromise = generateViaProxy(proxyUrl, userMessage, onProgress);
    } else if (ANTHROPIC_API_KEY) {
      fetchPromise = generateViaDirect(userMessage, onProgress);
    } else {
      return Promise.reject(new Error('No API key or proxy configured'));
    }

    return fetchPromise.then(function (fullText) {
      var jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse report content JSON');
      }

      var content = JSON.parse(jsonMatch[0]);

      var roundLabels = [
        { short: 'Baseline Switching', rule: 'Numbers \u2194 Letters' },
        { short: 'Semantic Retrieval', rule: 'Numbers \u2194 Months' },
        { short: 'Inhibition + Reversal', rule: 'Reverse Numbers \u2194 Reverse Letters' }
      ];

      var html = buildReportHtml({
        content: content,
        score: score,
        rounds: rounds,
        roundLabels: roundLabels,
        date: today
      });

      if (onProgress) onProgress(100);
      return html;
    });
  }

  return {
    setApiKey: function (key) { ANTHROPIC_API_KEY = key; },
    setProxyUrl: function (url) { PROXY_URL = url; },
    generateReport: generateReport,
    buildReportHtml: buildReportHtml,
    estimatePercentile: estimatePercentile,
    escapeHtml: escapeHtml
  };
})();
