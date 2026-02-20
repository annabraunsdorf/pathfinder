/**
 * Scoring algorithm, results generation, and style classification for Pathfinder.
 */

var Scoring = (function () {
  // --- Tunable constants ---
  var PAR_TIMES = [10, 18, 30]; // seconds per round
  var PENALTY_PER_SECOND = 3;   // points lost per second over par
  var ERROR_COST = 5;           // points lost per error
  var ROUND_WEIGHTS = [0.20, 0.30, 0.50];

  /**
   * Compute score for a single round.
   * round_score = max(0, max(0, 100 - (time - par) * penalty) - errors * errorCost)
   */
  function roundScore(time, errors, roundIndex) {
    var par = PAR_TIMES[roundIndex];
    var timeScore = Math.max(0, 100 - Math.max(0, time - par) * PENALTY_PER_SECOND);
    return Math.max(0, timeScore - errors * ERROR_COST);
  }

  /**
   * Compute final weighted score (0-100).
   */
  function finalScore(rounds) {
    var score = 0;
    for (var i = 0; i < rounds.length; i++) {
      var rs = roundScore(rounds[i].time, rounds[i].errors, i);
      score += rs * ROUND_WEIGHTS[i];
    }
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Classify pathfinding style based on speed-accuracy profile.
   */
  function classifyStyle(rounds) {
    var totalErrors = 0;
    var totalOverPar = 0;
    for (var i = 0; i < rounds.length; i++) {
      totalErrors += rounds[i].errors;
      totalOverPar += Math.max(0, rounds[i].time - PAR_TIMES[i]);
    }

    var avgOverPar = totalOverPar / rounds.length;
    var avgErrors = totalErrors / rounds.length;
    var fast = avgOverPar < 3;
    var accurate = avgErrors < 1;

    // Check for improvement pattern
    var improving = rounds.length >= 3 &&
      rounds[2].time / PAR_TIMES[2] < rounds[0].time / PAR_TIMES[0];

    // Check for strong start pattern
    var strongStart = rounds.length >= 3 &&
      roundScore(rounds[0].time, rounds[0].errors, 0) > 85 &&
      roundScore(rounds[2].time, rounds[2].errors, 2) < 60;

    if (strongStart) {
      return {
        label: 'Strong Starter',
        description: 'You came out sharp and focused, with excellent performance on the simpler rounds. As complexity increased, the challenge grew — which is completely normal. This pattern suggests strong foundational skills that could be extended with practice on complex tasks.'
      };
    }

    if (improving) {
      return {
        label: 'Steady Builder',
        description: 'You found your rhythm as you went, improving relative to the difficulty across rounds. This warming-up pattern suggests that with a bit more practice, your starting performance could match your peak performance.'
      };
    }

    if (fast && accurate) {
      return {
        label: 'Balanced Pathfinder',
        description: 'You combined speed and accuracy effectively throughout the test. This balance is a hallmark of strong executive function — the ability to move quickly while still tracking the correct sequence.'
      };
    }

    if (fast && !accurate) {
      return {
        label: 'Fast Scanner',
        description: 'You moved through the test quickly, prioritizing speed. A few errors crept in along the way, which is a common trade-off. Slowing down just slightly on the trickiest switches could preserve your speed advantage while catching more mistakes.'
      };
    }

    // slow and accurate, or slow and inaccurate
    return {
      label: 'Careful Navigator',
      description: 'You took a measured, deliberate approach to the test. This careful strategy helps minimize errors, and with practice, you can gradually increase your pace while maintaining that accuracy.'
    };
  }

  /**
   * Generate a summary paragraph based on performance.
   */
  function generateSummary(rounds, score) {
    var parts = [];
    var r1Score = roundScore(rounds[0].time, rounds[0].errors, 0);
    var r3Score = roundScore(rounds[2].time, rounds[2].errors, 2);

    if (score >= 80) {
      parts.push('Strong overall performance.');
    } else if (score >= 60) {
      parts.push('Solid performance with room for improvement.');
    } else if (score >= 40) {
      parts.push('You completed all rounds, with some areas showing more challenge than others.');
    } else {
      parts.push('This was a challenging test, and you stuck with it through all three rounds.');
    }

    if (r1Score > r3Score + 20) {
      parts.push('Your performance was strongest in the earlier, simpler rounds, with more challenge as complexity increased.');
    } else if (r3Score > r1Score + 10) {
      parts.push('Notably, you got stronger as the test progressed, suggesting a good warm-up effect.');
    }

    var totalErrors = rounds[0].errors + rounds[1].errors + rounds[2].errors;
    if (totalErrors === 0) {
      parts.push('Impressively, you made zero errors across all rounds.');
    } else if (totalErrors <= 2) {
      parts.push('You kept errors to a minimum, showing good accuracy throughout.');
    } else if (totalErrors > 5) {
      parts.push('There were some missteps along the way — the number-letter switches can be tricky under time pressure.');
    }

    return parts.join(' ');
  }

  /**
   * Generate an everyday analogy for the score range.
   */
  function generateAnalogy(score) {
    if (score >= 85) {
      return 'Think of it like navigating a busy kitchen while cooking multiple dishes — you kept track of everything and stayed on pace.';
    }
    if (score >= 65) {
      return 'Imagine switching between reading a map and checking your mirrors while driving — you managed the task-switching well, with occasional moments of extra thought.';
    }
    if (score >= 40) {
      return 'It\'s similar to following a recipe while having a conversation — manageable, but the back-and-forth requires real mental effort.';
    }
    return 'Think of it like learning a new board game with alternating rules — it takes practice to build the pattern into something automatic.';
  }

  /**
   * Generate round-by-round highlight notes.
   */
  function roundHighlights(rounds) {
    var highlights = [];
    for (var i = 0; i < rounds.length; i++) {
      var notes = [];
      var rs = roundScore(rounds[i].time, rounds[i].errors, i);
      var ratio = rounds[i].time / PAR_TIMES[i];

      if (rs >= 90) {
        notes.push('Excellent');
      } else if (rs >= 70) {
        notes.push('Good');
      } else if (rs < 40) {
        notes.push('Challenging');
      }

      if (ratio <= 1.0) {
        notes.push('Under par time');
      } else if (ratio > 2.0) {
        notes.push('Well over par');
      }

      if (rounds[i].errors === 0) {
        notes.push('No errors');
      } else if (rounds[i].errors >= 3) {
        notes.push(rounds[i].errors + ' errors');
      }

      highlights.push(notes.length > 0 ? notes.join(' \u00B7 ') : '');
    }
    return highlights;
  }

  /**
   * Generate personalized suggestions based on patterns.
   */
  function generateSuggestions(rounds, score) {
    var suggestions = [];
    var totalErrors = rounds[0].errors + rounds[1].errors + rounds[2].errors;
    var avgOverPar = 0;
    for (var i = 0; i < rounds.length; i++) {
      avgOverPar += Math.max(0, rounds[i].time - PAR_TIMES[i]);
    }
    avgOverPar /= rounds.length;

    // Error-heavy — practice task-switching in daily life
    if (totalErrors > 3) {
      suggestions.push('Try cooking a meal with multiple dishes on different timers. Juggling stove, oven, and prep tasks builds the same mental switching skill this test measures.');
    }

    // Slow but accurate — build processing speed
    if (avgOverPar > 10 && totalErrors <= 2) {
      suggestions.push('Pick up a fast-paced card game like Set or Dutch Blitz. They train your brain to scan, recognize patterns, and act quickly — the same visual processing speed tested here.');
    }

    // Fast but error-prone — build sustained attention
    if (avgOverPar < 5 && totalErrors > 2) {
      suggestions.push('Try a daily mindfulness practice, even just 5-10 minutes. Research shows it strengthens the attentional control needed to stay accurate under pressure.');
    }

    // Got worse over rounds — build cognitive endurance
    if (roundScore(rounds[2].time, rounds[2].errors, 2) < roundScore(rounds[0].time, rounds[0].errors, 0) - 25) {
      suggestions.push('Sustained focus improves with aerobic exercise. Even 20-minute walks or jogs have been shown to boost the kind of cognitive stamina that helps on longer, more complex tasks.');
    }

    // General improvement suggestion
    if (score < 70) {
      suggestions.push('Learning a musical instrument — or picking one back up — is one of the best ways to build mental flexibility. Reading music while coordinating your hands requires exactly the kind of rapid task-switching this test measures.');
    }

    // High score encouragement
    if (score >= 85 && suggestions.length === 0) {
      suggestions.push('To keep sharpening these skills, try learning something that demands real-time decision-making — like a new language, a strategy board game, or an improvisational hobby like jazz or debate.');
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Generate final takeaway paragraph.
   */
  function generateTakeaway(score) {
    if (score >= 80) {
      return 'Your pathfinding ability is strong. The mental flexibility you demonstrated — switching between numbers and letters under pressure — is a skill that serves you well in everyday multitasking and decision-making.';
    }
    if (score >= 55) {
      return 'You showed solid pathfinding ability with room to grow. The good news is that the cognitive skills this test measures — mental flexibility and processing speed — are responsive to practice.';
    }
    return 'Remember that this is a snapshot, not a verdict. Cognitive flexibility is a skill that develops with practice, and many factors (sleep, stress, time of day) can influence any single session.';
  }

  /**
   * Build the full results object from round data.
   */
  function generateResults(rounds) {
    var score = finalScore(rounds);
    var style = classifyStyle(rounds);
    var summary = generateSummary(rounds, score);
    var analogy = generateAnalogy(score);
    var highlights = roundHighlights(rounds);
    var suggestions = generateSuggestions(rounds, score);
    var takeaway = generateTakeaway(score);

    return {
      score: score,
      style: style,
      summary: summary,
      analogy: analogy,
      highlights: highlights,
      suggestions: suggestions,
      takeaway: takeaway,
      rounds: rounds
    };
  }

  return {
    roundScore: roundScore,
    finalScore: finalScore,
    classifyStyle: classifyStyle,
    generateResults: generateResults
  };
})();
