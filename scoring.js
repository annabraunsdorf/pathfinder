/**
 * Scoring algorithm, results generation, and style classification for Pathfinder.
 *
 * Round structure (12 nodes each):
 *   Round 1: Numbers <-> Letters (baseline set-switching)
 *   Round 2: Numbers <-> Months (semantic retrieval)
 *   Round 3: Reverse Numbers <-> Reverse Letters (inhibition + reversal)
 */

var Scoring = (function () {
  // --- Tunable constants ---
  var PAR_TIMES = [10, 15, 20]; // seconds per round
  var PENALTY_PER_SECOND = 3;   // points lost per second over par
  var ERROR_COST = 8;           // points lost per error
  var ROUND_WEIGHTS = [0.20, 0.30, 0.50];

  var ROUND_LABELS = [
    {
      short: 'Baseline Switching',
      rule: 'Numbers \u2194 Letters',
      detail: 'This round measures your baseline ability to alternate between two well-known sequences. Numbers and the alphabet are both \u201Coverlearned\u201D \u2014 you can recite them on autopilot. The challenge is switching between them under time pressure, which taxes processing speed and basic set-shifting.'
    },
    {
      short: 'Semantic Retrieval',
      rule: 'Numbers \u2194 Months',
      detail: 'Months are familiar but accessed more slowly than the alphabet \u2014 you have to \u201Cthink through\u201D which one comes next rather than just reciting. This round tests how quickly you can retrieve information from deeper semantic memory while still maintaining the alternating pattern.'
    },
    {
      short: 'Inhibition + Reversal',
      rule: 'Reverse Numbers \u2194 Reverse Letters',
      detail: 'Counting backward requires suppressing your automatic forward-counting instinct. Doing it across two sequences simultaneously taxes inhibitory control and working memory on top of the processing speed and flexibility tested in earlier rounds.'
    }
  ];

  /**
   * Compute score for a single round.
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
   * Classify pathfinding style based on speed-accuracy profile across rounds.
   */
  function classifyStyle(rounds) {
    var r1 = roundScore(rounds[0].time, rounds[0].errors, 0);
    var r2 = roundScore(rounds[1].time, rounds[1].errors, 1);
    var r3 = roundScore(rounds[2].time, rounds[2].errors, 2);

    var totalErrors = rounds[0].errors + rounds[1].errors + rounds[2].errors;
    var totalOverPar = 0;
    for (var i = 0; i < rounds.length; i++) {
      totalOverPar += Math.max(0, rounds[i].time - PAR_TIMES[i]);
    }
    var avgOverPar = totalOverPar / rounds.length;

    var fast = avgOverPar < 4;
    var accurate = totalErrors <= 2;
    var consistent = Math.abs(r1 - r3) < 15;

    // Reversal-Challenged: R1 and R2 are strong, R3 drops significantly
    if (r1 >= 60 && r2 >= 50 && r3 < r1 - 25 && r3 < r2 - 20) {
      return {
        label: 'The Reversal-Challenged',
        description: 'Rounds 1 and 2 were strong, but Round 3 \u2014 the reversal round \u2014 showed a significant drop in speed, accuracy, or both. The forward sequences are well-handled, but suppressing the automatic forward response is where the challenge lives. In daily life, this person may notice more friction when they have to do something \u201Cbackward\u201D \u2014 like retracing steps, reversing a decision, or mentally counting down.'
      };
    }

    // Strong Starter: R1 is great, drops off in later rounds
    if (r1 >= 75 && r3 < r1 - 20 && r2 < r1 - 10) {
      return {
        label: 'The Strong Starter',
        description: 'Fast and accurate in Round 1, but both speed and accuracy drop as rules change. The baseline switching ability is solid, but the added cognitive layers in Rounds 2 and 3 created more friction. In daily life, this person handles familiar routines well but may find it harder to adapt when the rules change mid-task.'
      };
    }

    // Adaptive Builder: improves or stays stable across rounds
    var improving = r3 >= r1 - 5 && r3 >= r2 - 5;
    if (improving && !consistent) {
      return {
        label: 'The Adaptive Builder',
        description: 'Performance improves or stays stable from Round 1 to Round 3, even as the rules got harder. Warms up into the task and adapts to new rules efficiently. In daily life, this person may take a moment to get oriented but handles increasing complexity well once engaged.'
      };
    }

    // Steady Performer: consistent across all rounds
    if (consistent && accurate) {
      return {
        label: 'The Steady Performer',
        description: 'Consistent speed and accuracy across all three rounds. The increasing cognitive demands didn\u2019t meaningfully slow you down. In daily life, this person handles sudden rule changes, multi-step instructions, and unexpected pivots without losing a beat.'
      };
    }

    // Speed-First Thinker: fast but errors increase with complexity
    if (fast && !accurate) {
      return {
        label: 'The Speed-First Thinker',
        description: 'Fast across the board, but errors increase as rules get harder. Prioritizes momentum over verification. In daily life, this person moves quickly through tasks but may occasionally miss details when things get complex.'
      };
    }

    // Careful Processor: slower but accurate
    return {
      label: 'The Careful Processor',
      description: 'Slower overall but highly accurate, especially in the harder rounds. Takes time to verify before committing. In daily life, this person is methodical and precise \u2014 they rarely make mistakes but may feel slower in fast-paced situations.'
    };
  }

  /**
   * Generate a summary paragraph based on performance.
   */
  function generateSummary(rounds, score) {
    var parts = [];
    var r1 = roundScore(rounds[0].time, rounds[0].errors, 0);
    var r2 = roundScore(rounds[1].time, rounds[1].errors, 1);
    var r3 = roundScore(rounds[2].time, rounds[2].errors, 2);

    if (score >= 80) {
      parts.push('Strong overall performance.');
    } else if (score >= 60) {
      parts.push('Solid performance with room for improvement.');
    } else if (score >= 40) {
      parts.push('You completed all rounds, with some areas showing more challenge than others.');
    } else {
      parts.push('This was a challenging test, and you stuck with it through all three rounds.');
    }

    if (r1 > r3 + 25) {
      parts.push('Your performance was strongest in Round 1 (baseline switching), with the reversal round presenting the most challenge.');
    } else if (r3 > r1 + 10) {
      parts.push('Notably, you got stronger as the test progressed \u2014 even as the rules got harder.');
    } else if (r2 < r1 - 15 && r2 < r3 - 10) {
      parts.push('The month sequence in Round 2 appeared to be the trickiest for you, which is common \u2014 months require deeper retrieval than the alphabet.');
    }

    var totalErrors = rounds[0].errors + rounds[1].errors + rounds[2].errors;
    if (totalErrors === 0) {
      parts.push('Impressively, you made zero errors across all rounds.');
    } else if (totalErrors <= 2) {
      parts.push('You kept errors to a minimum, showing good accuracy throughout.');
    } else if (totalErrors > 5) {
      parts.push('There were some missteps along the way \u2014 switching between different rule sets can be tricky under time pressure.');
    }

    return parts.join(' ');
  }

  /**
   * Generate an everyday analogy for the score range.
   */
  function generateAnalogy(score) {
    if (score >= 85) {
      return 'Think of it like navigating a busy kitchen while cooking multiple dishes \u2014 you kept track of everything and stayed on pace.';
    }
    if (score >= 65) {
      return 'Imagine switching between reading a map and checking your mirrors while driving \u2014 you managed the task-switching well, with occasional moments of extra thought.';
    }
    if (score >= 40) {
      return 'It\u2019s similar to following a recipe while having a conversation \u2014 manageable, but the back-and-forth requires real mental effort.';
    }
    return 'Think of it like learning a new board game with alternating rules \u2014 it takes practice to build the pattern into something automatic.';
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
   * Generate an interpretation note comparing round performance.
   */
  function generateInterpretation(rounds) {
    var r1 = roundScore(rounds[0].time, rounds[0].errors, 0);
    var r2 = roundScore(rounds[1].time, rounds[1].errors, 1);
    var r3 = roundScore(rounds[2].time, rounds[2].errors, 2);

    var consistent = Math.abs(r1 - r3) < 12 && Math.abs(r1 - r2) < 12;
    if (consistent) {
      return 'Your time was consistent across all three rounds, even as the rules got harder \u2014 strong cognitive flexibility under load.';
    }

    if (r3 < r1 - 25 && r3 < r2 - 15) {
      return 'Round 3 took significantly longer than Rounds 1 and 2, suggesting the reversal demand was where your processing was most challenged.';
    }

    if (r2 < r1 - 15 && r2 < r3) {
      return 'You were fastest in Round 1 but slowed in Round 2 \u2014 the month sequence may have introduced more hesitation than the alphabet.';
    }

    if (r1 > r2 && r2 > r3) {
      return 'Performance declined gradually as the rules got more complex, which is a normal pattern \u2014 each round added a new cognitive demand.';
    }

    if (r3 >= r1) {
      return 'You adapted well to the increasing difficulty, maintaining or improving your pace through the hardest round.';
    }

    return 'Your performance varied across rounds, reflecting the different cognitive demands of each rule set.';
  }

  /**
   * Generate personalized suggestions based on patterns.
   */
  function generateSuggestions(rounds, score) {
    var suggestions = [];
    var r1 = roundScore(rounds[0].time, rounds[0].errors, 0);
    var r2 = roundScore(rounds[1].time, rounds[1].errors, 1);
    var r3 = roundScore(rounds[2].time, rounds[2].errors, 2);
    var totalErrors = rounds[0].errors + rounds[1].errors + rounds[2].errors;
    var totalOverPar = 0;
    for (var i = 0; i < rounds.length; i++) {
      totalOverPar += Math.max(0, rounds[i].time - PAR_TIMES[i]);
    }
    var avgOverPar = totalOverPar / rounds.length;

    // Round 3 was the clear weak point (reversal difficulty)
    if (r3 < r1 - 20 && r3 < r2 - 15) {
      suggestions.push('Practice \u201Cbackward\u201D thinking in small moments \u2014 count down from 20 while walking, spell short words backward, or mentally reverse a familiar route. These micro-exercises build the same inhibitory control that Round 3 tested.');
    }

    // Errors were high but speed was fast (speed-accuracy tradeoff)
    if (avgOverPar < 5 && totalErrors > 3) {
      suggestions.push('Your instinct is to move fast \u2014 that\u2019s a strength. Try a daily mindfulness practice, even just 5\u201310 minutes. Research shows it strengthens the attentional control needed to stay accurate under pressure.');
    }

    // Round 2 was surprisingly slower (semantic retrieval)
    if (r2 < r1 - 15) {
      suggestions.push('The month sequence requires pulling from a less \u201Cautomatic\u201D mental list than the alphabet. Strengthening retrieval fluency \u2014 like quickly naming months backward, listing items in a category under time pressure, or playing rapid word-association games \u2014 can make this kind of access faster.');
    }

    // Consistent across all rounds
    if (Math.abs(r1 - r3) < 12 && Math.abs(r1 - r2) < 12 && score >= 60) {
      suggestions.push('Your cognitive flexibility held up well under increasing demand. To keep building on this, look for daily opportunities to switch between tasks intentionally \u2014 like alternating between two different types of work in short blocks rather than doing one long stretch.');
    }

    // Slow but accurate overall
    if (avgOverPar > 10 && totalErrors <= 2) {
      suggestions.push('Pick up a fast-paced card game like Set or Dutch Blitz. They train your brain to scan, recognize patterns, and act quickly \u2014 building the same visual processing speed tested here.');
    }

    // Performance degraded across rounds (cognitive endurance)
    if (r1 > r2 && r2 > r3 && r1 - r3 > 20) {
      suggestions.push('Sustained focus improves with aerobic exercise. Even 20-minute walks or jogs have been shown to boost the kind of cognitive stamina that helps on longer, more complex tasks.');
    }

    // General improvement for lower scores
    if (score < 60 && suggestions.length < 2) {
      suggestions.push('Learning a musical instrument \u2014 or picking one back up \u2014 is one of the best ways to build mental flexibility. Reading music while coordinating your hands requires exactly the kind of rapid task-switching this test measures.');
    }

    // High score encouragement
    if (score >= 85 && suggestions.length === 0) {
      suggestions.push('To keep sharpening these skills, try learning something that demands real-time decision-making \u2014 like a new language, a strategy board game, or an improvisational hobby like jazz or debate.');
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Generate final takeaway paragraph.
   */
  function generateTakeaway(score) {
    if (score >= 80) {
      return 'Your pathfinding ability is strong. The mental flexibility you demonstrated \u2014 switching between different rule sets under pressure \u2014 is a skill that serves you well in everyday multitasking and decision-making.';
    }
    if (score >= 55) {
      return 'You showed solid pathfinding ability with room to grow. The good news is that the cognitive skills this test measures \u2014 mental flexibility, processing speed, and inhibitory control \u2014 are all responsive to practice.';
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
    var interpretation = generateInterpretation(rounds);
    var suggestions = generateSuggestions(rounds, score);
    var takeaway = generateTakeaway(score);

    return {
      score: score,
      style: style,
      summary: summary,
      analogy: analogy,
      highlights: highlights,
      interpretation: interpretation,
      suggestions: suggestions,
      takeaway: takeaway,
      rounds: rounds,
      roundLabels: ROUND_LABELS
    };
  }

  return {
    roundScore: roundScore,
    finalScore: finalScore,
    classifyStyle: classifyStyle,
    generateResults: generateResults
  };
})();
