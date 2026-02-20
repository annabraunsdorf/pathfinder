/**
 * Node layout generation and drawing system for Pathfinder.
 */

var Nodes = (function () {
  var NODE_SIZE = 52;
  var NODE_SIZE_WIDE = 58; // for 3-char labels (months) and 2-digit numbers
  var MIN_DISTANCE = 72;
  var EDGE_PADDING = 30;
  var HUD_HEIGHT = 60;
  var MAX_PLACEMENT_RETRIES = 200;
  var MAX_FULL_RETRIES = 50;

  /**
   * Generate the sequence for a given round type.
   * Types: 'practice', 'numbersLetters', 'numbersMonths', 'reverseNumbersLetters'
   */
  function generateSequence(roundType) {
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    switch (roundType) {
      case 'practice':
        // 1, A, 2, B, 3, C
        return ['1', 'A', '2', 'B', '3', 'C'];

      case 'numbersLetters':
        // 1, A, 2, B, 3, C, 4, D, 5, E, 6, F
        return ['1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E', '6', 'F'];

      case 'numbersMonths':
        // 1, Jan, 2, Feb, 3, Mar, 4, Apr, 5, May, 6, Jun
        return ['1', 'Jan', '2', 'Feb', '3', 'Mar', '4', 'Apr', '5', 'May', '6', 'Jun'];

      case 'reverseNumbersLetters':
        // 26, Z, 25, Y, 24, X, 23, W, 22, V, 21, U
        return ['26', 'Z', '25', 'Y', '24', 'X', '23', 'W', '22', 'V', '21', 'U'];

      default:
        return [];
    }
  }

  /**
   * Check if a label needs the wider node size.
   */
  function needsWideNode(label) {
    return label.length >= 2;
  }

  /**
   * Get the appropriate node size for a sequence.
   * If any label is wide, use the wide size for all nodes (consistency).
   */
  function getNodeSize(sequence) {
    for (var i = 0; i < sequence.length; i++) {
      if (needsWideNode(sequence[i])) return NODE_SIZE_WIDE;
    }
    return NODE_SIZE;
  }

  /**
   * Distance between two points.
   */
  function dist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if placing at (x, y) is valid given existing positions.
   */
  function isValidPlacement(x, y, placed) {
    for (var i = 0; i < placed.length; i++) {
      if (dist({ x: x, y: y }, placed[i]) < MIN_DISTANCE) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if the layout is "too sequential" — if nodes are largely
   * ordered left-to-right, re-generate.
   */
  function isTooOrdered(positions) {
    if (positions.length < 4) return false;
    var inOrder = 0;
    for (var i = 1; i < positions.length; i++) {
      if (positions[i].x > positions[i - 1].x) inOrder++;
    }
    return inOrder / (positions.length - 1) > 0.75;
  }

  /**
   * Generate node layout via rejection sampling.
   * Returns array of { label, x, y } where x,y are center positions.
   */
  function generateLayout(containerWidth, containerHeight, roundType) {
    var sequence = generateSequence(roundType);
    var count = sequence.length;
    var nodeSize = getNodeSize(sequence);
    var halfNode = nodeSize / 2;
    var minX = EDGE_PADDING + halfNode;
    var maxX = containerWidth - EDGE_PADDING - halfNode;
    var minY = HUD_HEIGHT + EDGE_PADDING + halfNode;
    var maxY = containerHeight - EDGE_PADDING - halfNode;

    if (maxX <= minX || maxY <= minY) {
      return sequence.map(function (label, i) {
        return { label: label, x: containerWidth / 2, y: 80 + i * 60 };
      });
    }

    for (var attempt = 0; attempt < MAX_FULL_RETRIES; attempt++) {
      var positions = [];
      var success = true;

      for (var i = 0; i < count; i++) {
        var placed = false;
        for (var r = 0; r < MAX_PLACEMENT_RETRIES; r++) {
          var x = minX + Math.random() * (maxX - minX);
          var y = minY + Math.random() * (maxY - minY);
          if (isValidPlacement(x, y, positions)) {
            positions.push({ x: x, y: y });
            placed = true;
            break;
          }
        }
        if (!placed) {
          success = false;
          break;
        }
      }

      if (success && !isTooOrdered(positions)) {
        // Shuffle positions so sequential labels aren't in placement order
        var indices = positions.map(function (_, idx) { return idx; });
        for (var s = indices.length - 1; s > 0; s--) {
          var j = Math.floor(Math.random() * (s + 1));
          var temp = indices[s];
          indices[s] = indices[j];
          indices[j] = temp;
        }

        return sequence.map(function (label, idx) {
          var pos = positions[indices[idx]];
          return { label: label, x: pos.x, y: pos.y };
        });
      }
    }

    // Last resort: grid layout
    var cols = Math.ceil(Math.sqrt(count));
    var cellW = (maxX - minX) / cols;
    var cellH = (maxY - minY) / Math.ceil(count / cols);
    return sequence.map(function (label, i) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      return {
        label: label,
        x: minX + col * cellW + cellW / 2 + (Math.random() - 0.5) * 20,
        y: minY + row * cellH + cellH / 2 + (Math.random() - 0.5) * 20
      };
    });
  }

  /**
   * Render nodes into a container element.
   * Returns array of { label, element, x, y }.
   */
  function renderNodes(container, layout, roundType) {
    container.innerHTML = '';
    var sequence = generateSequence(roundType);
    var nodeSize = getNodeSize(sequence);
    var halfNode = nodeSize / 2;

    return layout.map(function (node) {
      var el = document.createElement('div');
      el.className = 'node';
      el.textContent = node.label;
      el.dataset.label = node.label;
      el.style.left = (node.x - halfNode) + 'px';
      el.style.top = (node.y - halfNode) + 'px';
      el.style.width = nodeSize + 'px';
      el.style.height = nodeSize + 'px';

      // Slightly smaller font for longer labels
      if (node.label.length >= 3) {
        el.style.fontSize = '14px';
      } else if (node.label.length === 2) {
        el.style.fontSize = '16px';
      }

      container.appendChild(el);
      return { label: node.label, element: el, x: node.x, y: node.y };
    });
  }

  /**
   * Draw a line between two nodes on the SVG overlay.
   */
  function drawLine(svg, fromNode, toNode) {
    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fromNode.x);
    line.setAttribute('y1', fromNode.y);
    line.setAttribute('x2', toNode.x);
    line.setAttribute('y2', toNode.y);
    line.setAttribute('class', 'connection-line');
    svg.appendChild(line);
  }

  /**
   * Clear all lines from SVG overlay.
   */
  function clearLines(svg) {
    svg.innerHTML = '';
  }

  return {
    generateSequence: generateSequence,
    generateLayout: generateLayout,
    renderNodes: renderNodes,
    drawLine: drawLine,
    clearLines: clearLines
  };
})();
