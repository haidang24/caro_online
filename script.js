document.addEventListener("DOMContentLoaded", () => {
  // Utility functions for performance
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // Socket connection
  const socket = io({
    reconnectionAttempts: 5,
    timeout: 10000,
  });

  // Âm thanh game - simplified
  const sounds = {
    move: new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"
    ),
    moveX: new Audio(
      "https://assets.mixkit.co/active_storage/sfx/3005/3005-preview.mp3"
    ),
    moveO: new Audio(
      "https://assets.mixkit.co/active_storage/sfx/1410/1410-preview.mp3"
    ),
    win: new Audio(
      "https://assets.mixkit.co/active_storage/sfx/270/270-preview.mp3"
    ),
    draw: new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2702/2702-preview.mp3"
    ),
    error: new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2053/2053-preview.mp3"
    ),
    tick: new Audio(
      "https://assets.mixkit.co/active_storage/sfx/3092/3092-preview.mp3"
    ),
    emoji: new Audio(
      // "https://assets.mixkit.co/active_storage/sfx/1131/1131-preview.mp3"
      "./public/like.mp3"
    ),
    message: new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2365/2365-preview.mp3"
    ),
    call: new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2533/2533-preview.mp3"
    ),
  };

  // Load âm thanh - Sử dụng lazy loading để tăng hiệu suất
  let soundsLoaded = false;

  const preloadSounds = () => {
    if (soundsLoaded) return;

    Object.values(sounds).forEach((sound) => {
      sound.load();
      sound.volume = 0.5;
      sound.preload = "auto";
    });

    soundsLoaded = true;
  };

  // Hàm phát âm thanh - optimized
  function playSound(type) {
    try {
      // If sound is disabled, don't play
      if (!soundEnabled && type !== "error") return;

      // Đảm bảo âm thanh đã được preload
      if (!soundsLoaded) {
        preloadSounds();
      }

      if (sounds[type]) {
        // Sử dụng reset time thay vì tạo audio mới
        sounds[type].currentTime = 0;
        sounds[type]
          .play()
          .catch((err) => console.log("Không thể phát âm thanh:", err));
      }
    } catch (error) {
      console.error("Lỗi phát âm thanh:", error);
    }
  }

  // Sound toggle
  let soundEnabled = true;
  const toggleSoundBtn = document.getElementById("toggle-sound");

  // Connection status element
  const connectionStatus = document.getElementById("connection-status");

  // Log socket connection events
  socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);
    connectionStatus.textContent = "Đã kết nối đến server";
    connectionStatus.className = "status-connected";

    // Load room list on successful connection
    loadRoomList();
  });

  socket.on("connect_error", (error) => {
    console.error("Connection error:", error);
    connectionStatus.textContent = "Lỗi kết nối đến server!";
    connectionStatus.className = "status-error";
    playSound("error");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
    connectionStatus.textContent = "Mất kết nối với server!";
    connectionStatus.className = "status-error";
    playSound("error");
  });

  socket.on("reconnecting", (attemptNumber) => {
    console.log(`Attempting to reconnect (${attemptNumber})...`);
    connectionStatus.textContent = `Đang thử kết nối lại (${attemptNumber})...`;
    connectionStatus.className = "status-warning";
  });

  socket.on("reconnect", () => {
    console.log("Reconnected to server");
    connectionStatus.textContent = "Đã kết nối lại thành công";
    connectionStatus.className = "status-connected";

    // Refresh room list
    loadRoomList();
  });

  // Elements - Login & Room Creation
  const loginScreen = document.getElementById("login-screen");
  const waitingScreen = document.getElementById("waiting-screen");
  const gameContainer = document.getElementById("game-container");
  const playerNameJoinInput = document.getElementById("player-name-join");
  const roomIdJoinInput = document.getElementById("room-id-join");
  const joinBtn = document.getElementById("join-btn");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const createRoomBtn = document.getElementById("create-room-btn");
  const playerNameCreateInput = document.getElementById("player-name-create");
  const roomNameInput = document.getElementById("room-name");
  const roomIdCreateInput = document.getElementById("room-id-create");
  const boardSizeCreateSelect = document.getElementById("board-size-create");
  const moveTimeSelect = document.getElementById("move-time");
  const publicRoomCheckbox = document.getElementById("public-room");
  const blockTwoEndsCheckbox = document.getElementById("block-two-ends");
  const roomList = document.getElementById("room-list");
  const refreshRoomsBtn = document.getElementById("refresh-rooms");
  const cancelWaitingBtn = document.getElementById("cancel-waiting");

  // Win/Loss notification elements
  const winLossNotification = document.getElementById("win-loss-notification");
  const winLossIcon = winLossNotification.querySelector(".win-loss-icon");
  const winLossTitle = winLossNotification.querySelector(".win-loss-title");
  const winLossSubtitle =
    winLossNotification.querySelector(".win-loss-subtitle");
  const winLossEffects = winLossNotification.querySelector(".win-loss-effects");

  // Waiting screen elements
  const roomCodeSpan = document.getElementById("room-code");
  const waitingRoomNameSpan = document.getElementById("waiting-room-name");
  const waitingBoardSizeSpan = document.getElementById("waiting-board-size");
  const waitingBoardSizeSpan2 = document.getElementById("waiting-board-size-2");
  const waitingMoveTimeSpan = document.getElementById("waiting-move-time");
  const waitingBlockTwoEndsSpan = document.getElementById(
    "waiting-block-two-ends"
  );

  // Game elements
  const currentRoomSpan = document.getElementById("current-room");
  const currentRoomNameSpan = document.getElementById("current-room-name");
  const gameRulesSpan = document.getElementById("game-rules");
  const playerXInfo = document
    .getElementById("player-x-info")
    .querySelector("span");
  const playerOInfo = document
    .getElementById("player-o-info")
    .querySelector("span");
  const gameBoard = document.getElementById("game-board");
  const playerX = document.querySelector(".player-x");
  const playerO = document.querySelector(".player-o");
  const xScoreElem = document.getElementById("x-score");
  const oScoreElem = document.getElementById("o-score");
  const resetButton = document.getElementById("reset-game");
  const newGameButton = document.getElementById("new-game");
  const boardSizeSelect = document.getElementById("board-size");
  const gameMoveTimeSelect = document.getElementById("game-move-time");
  const leaveRoomButton = document.getElementById("leave-room");
  const gameMessage = document.getElementById("game-message");
  const timerDisplay = document.getElementById("timer");

  // Emoji reaction buttons
  const heartEmojiBtn = document.getElementById("heart-emoji");
  const stoneEmojiBtn = document.getElementById("stone-emoji");
  const clapEmojiBtn = document.getElementById("clap-emoji");
  const laughEmojiBtn = document.getElementById("laugh-emoji");
  const thinkEmojiBtn = document.getElementById("think-emoji");
  const fireEmojiBtn = document.getElementById("fire-emoji");
  const cowEmojiBtn = document.getElementById("cow-emoji");

  // Debug logs to check if emoji buttons are found
  console.log("Heart emoji button:", heartEmojiBtn);
  console.log("Stone emoji button:", stoneEmojiBtn);
  console.log(
    "Additional emoji buttons:",
    clapEmojiBtn,
    laughEmojiBtn,
    thinkEmojiBtn,
    fireEmojiBtn,
    cowEmojiBtn
  );

  // Game state
  let currentPlayer = "x";
  let gameActive = false;
  let boardSize = 15;
  let gameState = [];
  let xScore = 0;
  let oScore = 0;
  let mySymbol = "";
  let currentRoomId = "";
  let playersInfo = {};
  let moveTime = 30;
  let timeLeft = 30;
  let timerInterval;
  let tickSound = false;
  let blockTwoEnds = false; // Chặn 2 đầu flag

  // Mobile device detection and optimization
  function isMobileDevice() {
    return (
      window.innerWidth <= 768 ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
  }

  // Detect low performance devices
  function isLowPerformanceDevice() {
    // Check hardware concurrency (CPU cores)
    const lowCores = navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency <= 4
      : true;

    // Check device memory if available
    const lowMemory = navigator.deviceMemory
      ? navigator.deviceMemory <= 4
      : true;

    // Check if it's a mobile device
    const isMobile = isMobileDevice();

    // Performance measurement via timing API
    let performanceSlow = false;
    const start = performance.now();
    let count = 0;
    for (let i = 0; i < 1000000; i++) {
      count += i % 2;
    }
    const duration = performance.now() - start;
    performanceSlow = duration > 50; // Threshold for slow performance

    // Return true if any two conditions are met
    return isMobile && (lowCores || lowMemory || performanceSlow);
  }

  // Add performance based optimizations
  function applyPerformanceOptimizations() {
    // If it's not a low performance device, no need to optimize heavily
    if (!isLowPerformanceDevice()) return;

    console.log(
      "Low performance device detected, applying deeper optimizations"
    );

    // Add performance mode class
    document.body.classList.add("high-performance-mode");

    // Additional CSS for extreme optimization
    const styleSheet = document.createElement("style");
    styleSheet.id = "performance-mode";
    styleSheet.textContent = `
      .high-performance-mode #blockchain-background {
        opacity: 0.5 !important;
      }
      .high-performance-mode .emoji-animation,
      .high-performance-mode .emoji-center,
      .high-performance-mode .emoji-small,
      .high-performance-mode .emoji-clap,
      .high-performance-mode .emoji-laugh,
      .high-performance-mode .emoji-think,
      .high-performance-mode .emoji-fire,
      .high-performance-mode .heart-orbit,
      .high-performance-mode .fire-particle {
        display: none !important;
      }
      .high-performance-mode .cell {
        transition: none !important;
        animation-duration: 0.1s !important;
      }
      .high-performance-mode .player-turn span,
      .high-performance-mode .timer-display {
        transition: none !important;
      }
      .high-performance-mode .win-cell {
        animation: none !important;
        background-color: rgba(255, 215, 0, 0.3) !important;
      }
      .high-performance-mode * {
        animation-duration: 0.2s !important;
      }
    `;
    document.head.appendChild(styleSheet);
  }

  // Add mobile-specific optimizations

  // Optimized blockchain background animation
  const initBlockchainBackground = () => {
    const canvas = document.getElementById("blockchain-background");
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false }); // Disable alpha for better performance

    // Set canvas size to window size with performance consideration
    function setCanvasSize() {
      // Giảm kích thước canvas trên thiết bị di động để tăng hiệu suất
      const scaleFactor = isMobileDevice() ? 0.7 : 1;
      canvas.width = window.innerWidth * scaleFactor;
      canvas.height = window.innerHeight * scaleFactor;

      // CSS để canvas vẫn phủ toàn màn hình
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }

    // Call once on load
    setCanvasSize();

    // Update canvas size when window resizes with debounce
    const debouncedResize = debounce(() => {
      setCanvasSize();
    }, 200);
    window.addEventListener("resize", debouncedResize);

    // Mouse interaction
    let mouse = {
      x: null,
      y: null,
      radius: isMobileDevice() ? 100 : 150, // Reduced radius on mobile
      active: false,
    };

    // Throttle mouse movement to improve performance
    const throttledMouseMove = throttle(function (event) {
      mouse.x = event.x;
      mouse.y = event.y;
      mouse.active = true;

      // Only create ripple occasionally to reduce load
      if (Math.random() > 0.8) {
        createRipple(mouse.x, mouse.y, "move");
      }
    }, 30);

    // Track mouse movement
    window.addEventListener("mousemove", throttledMouseMove);

    // Handle mouse click
    window.addEventListener("click", function (event) {
      // Create ripple on click
      createRipple(event.x, event.y, "click");

      // Create new node on click
      if (nodes.length < maxNodes + 5) {
        createNode(event.x, event.y, true);
      }
    });

    // Handle mouse leave
    window.addEventListener("mouseout", function () {
      mouse.active = false;
      mouse.x = null;
      mouse.y = null;
    });

    // Optimize for mobile performance
    const maxNodes = isMobileDevice() ? 40 : 80;
    const connectionDistance = isMobileDevice() ? 120 : 150;
    const nodeRadius = 2;

    // Spatial grid for efficient neighbor finding
    const spatialGrid = {};
    const gridSize = connectionDistance;

    function addToGrid(node) {
      const cellX = Math.floor(node.x / gridSize);
      const cellY = Math.floor(node.y / gridSize);
      const key = `${cellX},${cellY}`;

      if (!spatialGrid[key]) {
        spatialGrid[key] = [];
      }
      spatialGrid[key].push(node);
    }

    function updateGrid() {
      // Clear grid
      Object.keys(spatialGrid).forEach((key) => {
        delete spatialGrid[key];
      });

      // Repopulate grid
      nodes.forEach((node) => {
        addToGrid(node);
      });
    }

    function getNeighbors(node) {
      const cellX = Math.floor(node.x / gridSize);
      const cellY = Math.floor(node.y / gridSize);
      const neighbors = [];

      // Check current and surrounding cells
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          const key = `${cellX + x},${cellY + y}`;
          if (spatialGrid[key]) {
            neighbors.push(...spatialGrid[key]);
          }
        }
      }

      return neighbors;
    }

    // Nodes and connections
    const nodes = [];
    const ripples = [];

    // Colors
    const nodeColor = "rgba(77, 121, 255, 0.7)";
    const lineColor = "rgba(77, 121, 255, 0.2)";
    const highlightColor = "rgba(255, 82, 82, 0.9)";
    const interactionColor = "rgba(255, 215, 0, 0.7)";

    // Create a new node
    function createNode(x, y, isHighlighted = false) {
      const node = {
        x: x || Math.random() * canvas.width,
        y: y || Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 1 + nodeRadius,
        highlight: isHighlighted || Math.random() > 0.9,
        pulseTime: Math.random() * 100,
        pulseSpeed: Math.random() * 0.05 + 0.01,
        interacting: false,
      };

      nodes.push(node);
      addToGrid(node);
    }

    // Create a ripple effect
    function createRipple(x, y, type) {
      // Limit ripples to avoid performance issues
      if (ripples.length > 10) {
        ripples.shift();
      }

      // Smaller ripples on mobile
      const mobileFactor = isMobileDevice() ? 0.7 : 1;
      const maxRadius =
        type === "click" ? 100 * mobileFactor : 50 * mobileFactor;

      ripples.push({
        x: x,
        y: y,
        radius: 5,
        maxRadius: maxRadius,
        alpha: 1,
        color: type === "click" ? interactionColor : nodeColor,
        duration: type === "click" ? 2 : 1,
        life: 0,
      });
    }

    // Create initial nodes
    for (let i = 0; i < maxNodes; i++) {
      createNode();
    }

    // Performance optimization variables
    let lastFrameTime = 0;
    const targetFPS = isMobileDevice() ? 30 : 60;
    const frameInterval = 1000 / targetFPS;

    // Animation loop with frame skipping for consistent FPS
    function animate(timestamp) {
      // Skip frames to maintain target FPS
      if (timestamp - lastFrameTime < frameInterval) {
        requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = timestamp;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update spatial grid periodically (not every frame)
      if (timestamp % 3 === 0) {
        updateGrid();
      }

      // Batch drawing operations
      const linesToDraw = [];
      const nodesToDraw = [];

      // Update nodes and collect drawing operations
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Handle boundary bounce
        if (node.x < 0 || node.x > canvas.width) {
          node.vx *= -1;
          node.x = Math.max(0, Math.min(node.x, canvas.width));
        }
        if (node.y < 0 || node.y > canvas.height) {
          node.vy *= -1;
          node.y = Math.max(0, Math.min(node.y, canvas.height));
        }

        // Reset interaction state
        node.interacting = false;

        // Handle mouse interaction - use square distance for performance
        if (mouse.active) {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const mouseDistSq = dx * dx + dy * dy;
          const mouseRadiusSq = mouse.radius * mouse.radius;

          if (mouseDistSq < mouseRadiusSq) {
            const mouseDistance = Math.sqrt(mouseDistSq);
            const attractionStrength =
              ((mouse.radius - mouseDistance) / mouse.radius) * 0.05;

            // Apply attraction towards mouse
            node.vx += (mouse.x - node.x) * attractionStrength;
            node.vy += (mouse.y - node.y) * attractionStrength;

            // Limit velocity
            const maxVelocity = 2;
            const velocityMagnitude = Math.sqrt(
              node.vx * node.vx + node.vy * node.vy
            );
            if (velocityMagnitude > maxVelocity) {
              node.vx = (node.vx / velocityMagnitude) * maxVelocity;
              node.vy = (node.vy / velocityMagnitude) * maxVelocity;
            }

            // Mark as interacting
            node.interacting = true;
          }
        }

        // Find connections efficiently using spatial grid
        const neighbors = getNeighbors(node);
        for (let j = 0; j < neighbors.length; j++) {
          const nodeB = neighbors[j];

          // Skip self or already processed pairs
          if (nodeB === node || nodes.indexOf(nodeB) < i) continue;

          const dx = node.x - nodeB.x;
          const dy = node.y - nodeB.y;
          const distSquared = dx * dx + dy * dy;
          const maxDistSquared = connectionDistance * connectionDistance;

          if (distSquared < maxDistSquared) {
            const distance = Math.sqrt(distSquared);
            let opacity = 1 - distance / connectionDistance;

            // Enhance connections if mouse is near
            if (mouse.active) {
              const mouseDistToA = Math.hypot(
                node.x - mouse.x,
                node.y - mouse.y
              );
              const mouseDistToB = Math.hypot(
                nodeB.x - mouse.x,
                nodeB.y - mouse.y
              );

              if (mouseDistToA < mouse.radius || mouseDistToB < mouse.radius) {
                opacity *= 2;
                node.interacting = true;
                nodeB.interacting = true;
              }
            }

            // Add to lines to draw
            linesToDraw.push({
              x1: node.x,
              y1: node.y,
              x2: nodeB.x,
              y2: nodeB.y,
              opacity: opacity,
            });
          }
        }

        // Update pulse effect
        node.pulseTime += node.pulseSpeed;
        const pulseFactor = 0.7 + Math.sin(node.pulseTime) * 0.3;

        // Add to nodes to draw
        nodesToDraw.push({
          x: node.x,
          y: node.y,
          radius: node.radius * pulseFactor,
          highlight: node.highlight,
          interacting: node.interacting,
        });
      }

      // Draw all connections in batch
      for (const line of linesToDraw) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.strokeStyle = lineColor.replace("0.2", line.opacity * 0.4);
        ctx.lineWidth = line.opacity * 1.5;
        ctx.stroke();
      }

      // Draw all nodes in batch
      for (const node of nodesToDraw) {
        let nodeSize = node.radius;
        let fillColor = nodeColor;
        let glowSize = 0;
        let glowColor = "rgba(255, 255, 255, 0)";

        // Different styles based on node state
        if (node.highlight) {
          fillColor = highlightColor;
          glowSize = node.radius * 2;
          glowColor = "rgba(255, 82, 82, 0.3)";
        }

        if (node.interacting) {
          nodeSize *= 1.5;
          fillColor = interactionColor;
          glowSize = node.radius * 3;
          glowColor = "rgba(255, 215, 0, 0.4)";
        }

        // Draw glow effect
        if (glowSize > 0) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
          ctx.fillStyle = glowColor;
          ctx.fill();
        }

        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
      }

      // Update and draw ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];

        // Update ripple
        ripple.life += 0.02;
        ripple.radius = ripple.maxRadius * Math.min(ripple.life, 1);
        ripple.alpha = 1 - ripple.life / ripple.duration;

        // Draw ripple
        if (ripple.alpha > 0) {
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
          ctx.strokeStyle = ripple.color.replace("0.7", ripple.alpha);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Remove completed ripples
        if (ripple.life > ripple.duration) {
          ripples.splice(i, 1);
        }
      }

      // Occasionally change which nodes are highlighted - reduced frequency
      if (Math.random() > 0.995) {
        const nodeIdx = Math.floor(Math.random() * nodes.length);
        nodes[nodeIdx].highlight = !nodes[nodeIdx].highlight;

        // Create a ripple at the highlighted node
        if (nodes[nodeIdx].highlight) {
          createRipple(nodes[nodeIdx].x, nodes[nodeIdx].y, "click");
        }
      }

      // Continue animation
      requestAnimationFrame(animate);
    }

    // Start animation with timestamp
    requestAnimationFrame(animate);
  };

  // Optimized emoji animations
  // Heart animation
  function showHeartAnimation() {
    const isMobile = isMobileDevice();
    const numHearts = isMobile ? 4 : 8;
    const floatingHearts = isMobile ? 8 : 16;

    // Create main center heart
    const centerHeart = document.createElement("div");
    centerHeart.classList.add("emoji-center");
    centerHeart.textContent = "❤️";
    document.body.appendChild(centerHeart);

    // Use document fragment to reduce DOM operations
    const fragment = document.createDocumentFragment();

    // Create orbiting hearts
    for (let i = 0; i < numHearts; i++) {
      const orbitHeart = document.createElement("div");
      orbitHeart.classList.add("heart-orbit");
      orbitHeart.textContent = "❤️";
      orbitHeart.style.animationDelay = `${i * 0.1}s`;
      orbitHeart.style.transform = `translate(-50%, -50%) rotate(${
        i * (360 / numHearts)
      }deg) translateX(120px)`;
      fragment.appendChild(orbitHeart);

      // Remove after animation completes
      setTimeout(() => {
        if (orbitHeart.parentNode) {
          orbitHeart.parentNode.removeChild(orbitHeart);
        }
      }, 2000 + i * 100);
    }

    document.body.appendChild(fragment);

    // Create floating hearts with batching
    const floatingFragment = document.createDocumentFragment();

    for (let i = 0; i < floatingHearts; i++) {
      setTimeout(() => {
        const floatHeart = document.createElement("div");
        floatHeart.classList.add("emoji-small");
        floatHeart.textContent = "❤️";
        floatHeart.style.fontSize = `${Math.random() * 1.5 + 1}em`;

        // Position near center
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const centerX = screenWidth / 2;
        const centerY = screenHeight / 2;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 150 + 100;

        floatHeart.style.left = `${centerX + Math.cos(angle) * distance}px`;
        floatHeart.style.top = `${centerY + Math.sin(angle) * distance}px`;
        floatHeart.style.animation = `emoji-float ${
          Math.random() * 2 + 2
        }s forwards`;

        document.body.appendChild(floatHeart);

        // Remove after animation completes
        setTimeout(() => {
          if (floatHeart.parentNode) {
            floatHeart.parentNode.removeChild(floatHeart);
          }
        }, 4000);
      }, i * (isMobile ? 150 : 100));
    }

    // Remove center heart after animation completes
    setTimeout(() => {
      if (centerHeart.parentNode) {
        centerHeart.parentNode.removeChild(centerHeart);
      }
    }, 2000);
  }

  // Function to optimize DOM operations in emoji animations
  function optimizeElementCreation(count, createFn) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const element = createFn(i);
      if (element) {
        fragment.appendChild(element);
      }
    }
    return fragment;
  }

  // Enhanced mobile optimization
  function optimizeForMobile() {
    if (!isMobileDevice()) return;

    console.log("Mobile device detected, applying optimizations");

    // Add mobile optimization class to body
    document.body.classList.add("mobile-optimized");

    // Adjust CSS variables for better mobile performance
    document.documentElement.style.setProperty("--cell-size", "28px");

    // Reduce animations on mobile
    const styleSheet = document.createElement("style");
    styleSheet.id = "mobile-optimizations";
    styleSheet.textContent = `
      .mobile-optimized #blockchain-background {
        opacity: 0.8;
      }
      .mobile-optimized .emoji-center,
      .mobile-optimized .emoji-clap,
      .mobile-optimized .emoji-laugh,
      .mobile-optimized .emoji-think,
      .mobile-optimized .emoji-fire {
        filter: none !important;
      }
      .mobile-optimized .cell.x,
      .mobile-optimized .cell.o {
        animation-duration: 0.2s !important;
      }
      .mobile-optimized .timer-display,
      .mobile-optimized .player-turn span {
        transition-duration: 0.2s !important;
      }
    `;
    document.head.appendChild(styleSheet);

    // Use passive listeners for touch events
    document.addEventListener("touchstart", function () {}, { passive: true });
    document.addEventListener("touchmove", function () {}, { passive: true });
  }

  // Tab switching
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");

      // Remove active class from all tabs and contents
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Add active class to current tab and content
      btn.classList.add("active");
      document.getElementById(`${tabId}-tab`).classList.add("active");

      // Animation
      document.getElementById(`${tabId}-tab`).style.animation = "none";
      setTimeout(() => {
        document.getElementById(`${tabId}-tab`).style.animation =
          "fade-in 0.3s ease";
      }, 10);
    });
  });

  // Load room list on page load and refresh button
  loadRoomList();
  refreshRoomsBtn.addEventListener("click", () => {
    loadRoomList();
    refreshRoomsBtn.classList.add("refreshing");
    setTimeout(() => {
      refreshRoomsBtn.classList.remove("refreshing");
    }, 500);
  });

  // Function to load available rooms
  function loadRoomList() {
    roomList.innerHTML =
      '<p class="loading-text">Đang tải danh sách phòng...</p>';

    fetch("/api/rooms")
      .then((response) => response.json())
      .then((rooms) => {
        if (Object.keys(rooms).length === 0) {
          roomList.innerHTML =
            '<p class="loading-text">Không có phòng nào đang khả dụng</p>';
          return;
        }

        roomList.innerHTML = "";

        for (const roomId in rooms) {
          const room = rooms[roomId];
          const roomElement = document.createElement("div");
          roomElement.classList.add("room-item");
          roomElement.innerHTML = `
            <div class="room-name">${room.name}</div>
            <div class="room-details">
              <span>Người tạo: ${room.createdBy}</span>
              <span>${room.boardSize}x${room.boardSize}</span>
              <span>${room.moveTime}s/nước</span>
              ${
                room.blockTwoEnds
                  ? '<span class="block-rule">Chặn 2 đầu</span>'
                  : ""
              }
            </div>
          `;

          roomElement.addEventListener("click", () => {
            roomIdJoinInput.value = roomId;
            // Hiệu ứng khi chọn phòng
            roomElement.classList.add("selected");
            setTimeout(() => {
              roomElement.classList.remove("selected");
            }, 300);
          });

          roomList.appendChild(roomElement);
        }
      })
      .catch((error) => {
        console.error("Error loading room list:", error);
        roomList.innerHTML =
          '<p class="loading-text">Lỗi khi tải danh sách phòng</p>';
      });
  }

  // Cancel waiting and return to login screen
  cancelWaitingBtn.addEventListener("click", () => {
    socket.disconnect();
    socket.connect();
    waitingScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    // Animation
    loginScreen.style.animation = "none";
    setTimeout(() => {
      loginScreen.style.animation = "fade-in 0.5s ease";
    }, 10);
  });

  // Join room event
  joinBtn.addEventListener("click", () => {
    const playerName = playerNameJoinInput.value.trim();
    const roomId = roomIdJoinInput.value.trim();

    if (!playerName) {
      alert("Vui lòng nhập tên người chơi!");
      playerNameJoinInput.focus();
      playSound("error");
      return;
    }

    if (!roomId) {
      alert("Vui lòng nhập mã phòng!");
      roomIdJoinInput.focus();
      playSound("error");
      return;
    }

    // Show waiting screen with room code
    loginScreen.classList.add("hidden");
    waitingScreen.classList.remove("hidden");
    roomCodeSpan.textContent = roomId;

    // Animation
    waitingScreen.style.animation = "none";
    setTimeout(() => {
      waitingScreen.style.animation = "fade-in 0.5s ease";
    }, 10);

    // Join room via socket
    socket.emit("joinRoom", { roomId, playerName });
  });

  // Create room event
  createRoomBtn.addEventListener("click", () => {
    const playerName = playerNameCreateInput.value.trim();
    let roomId = roomIdCreateInput.value.trim();
    const roomName = roomNameInput.value.trim();
    const boardSize = parseInt(boardSizeCreateSelect.value);
    const moveTime = parseInt(moveTimeSelect.value);
    const isPublic = publicRoomCheckbox.checked;
    const blockTwoEnds = blockTwoEndsCheckbox.checked;

    if (!playerName) {
      alert("Vui lòng nhập tên người chơi!");
      playerNameCreateInput.focus();
      playSound("error");
      return;
    }

    // Generate random room ID if none provided
    if (!roomId) {
      roomId = Math.random().toString(36).substring(2, 8);
    }

    // Show waiting screen
    loginScreen.classList.add("hidden");
    waitingScreen.classList.remove("hidden");
    roomCodeSpan.textContent = roomId;

    // Animation
    waitingScreen.style.animation = "none";
    setTimeout(() => {
      waitingScreen.style.animation = "fade-in 0.5s ease";
    }, 10);

    // Create room via socket
    socket.emit("createRoom", {
      roomId,
      roomName: roomName || `Phòng của ${playerName}`,
      playerName,
      boardSize,
      moveTime,
      isPublic,
      blockTwoEnds,
    });
  });

  // Leave room event
  leaveRoomButton.addEventListener("click", () => {
    // Clean up video call and chat
    cleanupVideoCall();

    // Reset UI to login screen
    gameContainer.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    // Animation
    loginScreen.style.animation = "none";
    setTimeout(() => {
      loginScreen.style.animation = "fade-in 0.5s ease";
    }, 10);

    // Clear timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Disconnect from current room
    socket.disconnect();

    // Reconnect for new room
    socket.connect();

    // Reset game state
    mySymbol = "";
    currentRoomId = "";
    playersInfo = {};
    resetGame();

    // Refresh room list
    loadRoomList();
  });

  // Socket events
  socket.on(
    "playerAssigned",
    ({
      symbol,
      roomId,
      roomName,
      boardSize: newBoardSize,
      moveTime: newMoveTime,
      opponent,
      blockTwoEnds: newBlockTwoEnds,
    }) => {
      mySymbol = symbol;
      currentRoomId = roomId;
      boardSize = newBoardSize;
      moveTime = newMoveTime;
      timeLeft = moveTime;
      blockTwoEnds = newBlockTwoEnds; // Lưu trữ cấu hình luật chơi

      // Update waiting screen info
      waitingRoomNameSpan.textContent = roomName || `Phòng ${roomId}`;
      waitingBoardSizeSpan.textContent = boardSize;
      waitingBoardSizeSpan2.textContent = boardSize;
      waitingMoveTimeSpan.textContent = moveTime;
      waitingBlockTwoEndsSpan.textContent = blockTwoEnds
        ? "Chặn 2 đầu"
        : "Cơ bản (5 quân liên tiếp)";

      // Update board size in select element
      boardSizeSelect.value = newBoardSize.toString();
      gameMoveTimeSelect.value = newMoveTime.toString();

      // Show waiting screen or game container based on opponent
      if (opponent) {
        waitingScreen.classList.add("hidden");
        gameContainer.classList.remove("hidden");

        // Animation
        gameContainer.style.animation = "none";
        setTimeout(() => {
          gameContainer.style.animation = "fade-in 0.5s ease";
        }, 10);
      } else {
        waitingScreen.classList.remove("hidden");
        loginScreen.classList.add("hidden");
      }

      // Update room info
      currentRoomSpan.textContent = roomId;
      currentRoomNameSpan.textContent = roomName || `Phòng ${roomId}`;
      gameRulesSpan.textContent = blockTwoEnds
        ? "Luật: Chặn 2 đầu"
        : "Luật: Cơ bản";

      // Initialize board
      initBoard();

      // Setup timer display
      timerDisplay.textContent = timeLeft;
    }
  );

  socket.on("roomUpdate", ({ players, moveTime: newMoveTime }) => {
    // Update players info
    players.forEach((player) => {
      playersInfo[player.symbol] = player;

      if (player.symbol === "x") {
        playerXInfo.textContent = player.name;
      } else {
        playerOInfo.textContent = player.name;
      }
    });

    // Update move time if provided
    if (newMoveTime) {
      moveTime = newMoveTime;
      timeLeft = moveTime;
      timerDisplay.textContent = timeLeft;
      gameMoveTimeSelect.value = moveTime.toString();
    }
  });

  socket.on(
    "gameStart",
    ({ currentPlayer: startingPlayer, timeLeft: initialTime }) => {
      // Start the game
      gameActive = true;
      currentPlayer = startingPlayer;
      timeLeft = initialTime || moveTime;

      // Hide waiting screen, show game container
      waitingScreen.classList.add("hidden");
      gameContainer.classList.remove("hidden");

      // Animation
      gameContainer.style.animation = "none";
      setTimeout(() => {
        gameContainer.style.animation = "fade-in 0.5s ease";
      }, 10);

      // Update UI
      updatePlayerTurn();
      timerDisplay.textContent = timeLeft;

      // Show message
      gameMessage.textContent = "Game đã bắt đầu!";
      gameMessage.classList.add("start-message");
      setTimeout(() => {
        gameMessage.textContent = "";
        gameMessage.classList.remove("start-message");
      }, 2000);

      // Show turn notification when game starts
      setTimeout(() => {
        showTurnNotification();
        showCenterTurnNotification();
      }, 500);

      // Play sound
      playSound("move");

      // Re-attach emoji button listeners
      setupEmojiButtons();
    }
  );

  socket.on(
    "gameUpdate",
    ({
      gameState: newGameState,
      currentPlayer: newCurrentPlayer,
      lastMove,
      timeLeft: newTimeLeft,
    }) => {
      // Update game state
      gameState = newGameState;
      currentPlayer = newCurrentPlayer;

      // Play sound if opponent moved
      if (lastMove && lastMove.player !== mySymbol) {
        playSound("move");
      }

      // Update timer
      if (newTimeLeft !== undefined) {
        timeLeft = newTimeLeft;
        timerDisplay.textContent = timeLeft;
        updateTimerDisplay();
      }

      // Update board UI
      updateBoardUI();

      // Highlight last move
      if (lastMove) {
        const cells = document.querySelectorAll(".cell");
        const cellIndex = lastMove.row * boardSize + lastMove.col;
        if (cells[cellIndex]) {
          cells[cellIndex].classList.add("last-move");

          // Add position indicator to the last move
          const positionIndicator = document.createElement("div");
          positionIndicator.className = "last-move-position";

          // Xác định nếu đây là nước đi của đối thủ
          const isOpponentMove = lastMove.player !== mySymbol;

          // Tạo nội dung vị trí với biểu tượng và định dạng tốt hơn
          if (isOpponentMove) {
            // Nếu là nước đi của đối thủ, hiển thị thông báo với biểu tượng
            const opponentName =
              playersInfo[lastMove.player]?.name ||
              `Người chơi ${lastMove.player.toUpperCase()}`;
            positionIndicator.innerHTML = `<span style="color: ${
              lastMove.player === "x" ? "var(--x-color)" : "var(--o-color)"
            }">⊕</span> ${opponentName} đánh <strong>${lastMove.row + 1},${
              lastMove.col + 1
            }</strong>`;
          } else {
            // Nếu là nước đi của mình, hiển thị vị trí với màu sắc tốt hơn
            const playerName =
              playersInfo[mySymbol]?.name ||
              `Người chơi ${mySymbol.toUpperCase()}`;
            positionIndicator.innerHTML = `<span style="color: ${
              mySymbol === "x" ? "var(--x-color)" : "var(--o-color)"
            }">✓</span> Bạn đánh <strong>${lastMove.row + 1},${
              lastMove.col + 1
            }</strong>`;
          }

          cells[cellIndex].appendChild(positionIndicator);

          setTimeout(() => {
            cells[cellIndex].classList.remove("last-move");
            // Remove the position indicator after animation completes
            if (cells[cellIndex].contains(positionIndicator)) {
              cells[cellIndex].removeChild(positionIndicator);
            }
          }, 2500);
        }
      }

      // Update player turn indicator
      updatePlayerTurn();

      // Show turn notification in the middle of the screen
      showTurnNotification();
      showCenterTurnNotification();

      // Reset tick sound flag
      tickSound = false;
    }
  );

  socket.on("timerUpdate", ({ timeLeft: newTimeLeft }) => {
    timeLeft = newTimeLeft;
    timerDisplay.textContent = timeLeft;
    updateTimerDisplay();

    // Play tick sound when time is running low and it's my turn
    if (timeLeft <= 5 && currentPlayer === mySymbol && !tickSound) {
      playSound("tick");
      tickSound = true;
    }
  });

  // Hàm hiển thị ô chiến thắng
  function highlightWinningCells(row, col, symbol) {
    if (!gameState || !gameState.length) return;

    const directions = [
      [0, 1], // ngang
      [1, 0], // dọc
      [1, 1], // chéo xuống
      [1, -1], // chéo lên
    ];

    for (const [dx, dy] of directions) {
      // Kiểm tra dãy chiến thắng theo hướng cụ thể
      let count = 1;
      let cells = [{ row, col }];

      // Kiểm tra một hướng
      let r = row + dx;
      let c = col + dy;
      while (
        r >= 0 &&
        r < boardSize &&
        c >= 0 &&
        c < boardSize &&
        gameState[r][c] === symbol &&
        count < 5
      ) {
        cells.push({ row: r, col: c });
        count++;
        r += dx;
        c += dy;
      }

      // Kiểm tra hướng ngược lại
      r = row - dx;
      c = col - dy;
      while (
        r >= 0 &&
        r < boardSize &&
        c >= 0 &&
        c < boardSize &&
        gameState[r][c] === symbol &&
        count < 5
      ) {
        cells.push({ row: r, col: c });
        count++;
        r -= dx;
        c -= dy;
      }

      // Nếu đủ 5 quân cờ liên tiếp
      if (count >= 5) {
        // Kiểm tra chặn 2 đầu nếu luật này được bật
        if (blockTwoEnds) {
          // Kiểm tra đầu 1
          let endR1 = cells[0].row + dx;
          let endC1 = cells[0].col + dy;
          let isBlocked1 = false;

          // Nếu đầu đầu tiên nằm ngoài biên hoặc bị chặn bởi quân đối phương
          if (
            endR1 < 0 ||
            endR1 >= boardSize ||
            endC1 < 0 ||
            endC1 >= boardSize ||
            (gameState[endR1][endC1] !== "" &&
              gameState[endR1][endC1] !== symbol)
          ) {
            isBlocked1 = true;
          }

          // Kiểm tra đầu 2
          let endR2 = cells[cells.length - 1].row - dx;
          let endC2 = cells[cells.length - 1].col - dy;
          let isBlocked2 = false;

          // Nếu đầu thứ hai nằm ngoài biên hoặc bị chặn bởi quân đối phương
          if (
            endR2 < 0 ||
            endR2 >= boardSize ||
            endC2 < 0 ||
            endC2 >= boardSize ||
            (gameState[endR2][endC2] !== "" &&
              gameState[endR2][endC2] !== symbol)
          ) {
            isBlocked2 = true;
          }

          // Nếu cả 2 đầu đều bị chặn, không tính là thắng
          if (isBlocked1 && isBlocked2) {
            continue; // Tiếp tục kiểm tra hướng khác
          }
        }

        // Highlight các ô chiến thắng
        const allCells = document.querySelectorAll(".cell");
        cells.forEach(({ row, col }) => {
          const index = row * boardSize + col;
          if (allCells[index]) {
            allCells[index].classList.add("win-cell");
          }
        });
        return cells;
      }
    }

    return null;
  }

  // Cập nhật xử lý game end
  socket.on(
    "gameEnd",
    ({
      winner,
      draw,
      timeout,
      timeoutPlayer,
      gameState: finalGameState,
      winningMove,
    }) => {
      // Update game state
      gameState = finalGameState;
      gameActive = false;
      updateBoardUI();

      // Highlight dãy chiến thắng nếu có thông tin về nước đi chiến thắng
      if (winner && winningMove) {
        highlightWinningCells(winningMove.row, winningMove.col, winner);
      }

      // Show beautiful win/loss notification
      if (draw) {
        showWinLossNotification("draw");
        gameMessage.textContent = "Hòa!";
      } else if (timeout) {
        showWinLossNotification("timeout", winner, { timeoutPlayer });
        gameMessage.textContent = `Người chơi ${timeoutPlayer.toUpperCase()} hết thời gian! ${winner.toUpperCase()} thắng!`;
        gameMessage.classList.add("win-message");
      } else {
        showWinLossNotification("win", winner);
        gameMessage.textContent = `Người chơi ${winner.toUpperCase()} thắng!`;
        gameMessage.classList.add("win-message");
      }

      // Update score
      if (winner) {
        if (winner === "x") {
          xScore++;
          xScoreElem.textContent = xScore;
        } else {
          oScore++;
          oScoreElem.textContent = oScore;
        }
      }

      // Phát âm thanh chiến thắng
      playSound(winner ? "win" : "draw");
    }
  );

  socket.on(
    "gameReset",
    ({
      gameState: newGameState,
      currentPlayer: newCurrentPlayer,
      timeLeft: newTimeLeft,
    }) => {
      // Reset game state
      gameState = newGameState;
      currentPlayer = newCurrentPlayer;
      gameActive = true;

      // Update timer
      timeLeft = newTimeLeft || moveTime;
      timerDisplay.textContent = timeLeft;
      updateTimerDisplay();

      // Update UI
      updateBoardUI();
      updatePlayerTurn();

      // Clear message
      gameMessage.textContent = "";
      gameMessage.classList.remove("win-message");

      // Remove win cell highlights
      document.querySelectorAll(".win-cell").forEach((cell) => {
        cell.classList.remove("win-cell");
      });

      // Show turn notification when game resets
      setTimeout(() => {
        showTurnNotification();
        showCenterTurnNotification();
      }, 500);

      // Play sound
      playSound("move");
    }
  );

  socket.on(
    "boardSizeChanged",
    ({ boardSize: newBoardSize, gameState: newGameState }) => {
      // Update board size and game state
      boardSize = newBoardSize;
      gameState = newGameState;

      // Update UI
      initBoard();

      // Update select element
      boardSizeSelect.value = newBoardSize.toString();

      // Play sound
      playSound("move");
    }
  );

  socket.on("moveTimeChanged", ({ moveTime: newMoveTime }) => {
    // Update move time
    moveTime = newMoveTime;
    if (!gameActive) {
      timeLeft = moveTime;
      timerDisplay.textContent = timeLeft;
    }

    // Update select element
    gameMoveTimeSelect.value = newMoveTime.toString();
  });

  socket.on("playerDisconnected", ({ players }) => {
    // Show disconnect message
    gameMessage.textContent = "Người chơi khác đã ngắt kết nối!";
    gameActive = false;

    // Play sound
    playSound("error");

    // Stop timer
    clearInterval(timerInterval);

    // Automatically close room and return to login screen after 3 seconds
    setTimeout(() => {
      // Reset UI to login screen
      gameContainer.classList.add("hidden");
      loginScreen.classList.remove("hidden");

      // Animation
      loginScreen.style.animation = "none";
      setTimeout(() => {
        loginScreen.style.animation = "fade-in 0.5s ease";
      }, 10);

      // Disconnect from current room
      socket.disconnect();

      // Reconnect for new room
      socket.connect();

      // Reset game state
      mySymbol = "";
      currentRoomId = "";
      playersInfo = {};
      resetGame();

      // Refresh room list
      loadRoomList();

      // Show notification
      const notification = document.createElement("div");
      notification.className = "notification";
      notification.textContent = "Phòng đã đóng do người chơi khác rời đi";
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.classList.add("show");
        setTimeout(() => {
          notification.classList.remove("show");
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 300);
        }, 3000);
      }, 100);
    }, 3000);

    // Update players info
    players.forEach((player) => {
      playersInfo[player.symbol] = player;

      if (player.symbol === "x") {
        playerXInfo.textContent = player.name;
      } else {
        playerOInfo.textContent = player.name;
      }
    });
  });

  socket.on("roomFull", () => {
    alert("Phòng đã đầy! Vui lòng thử phòng khác.");
    waitingScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    // Animation
    loginScreen.style.animation = "none";
    setTimeout(() => {
      loginScreen.style.animation = "fade-in 0.5s ease";
    }, 10);

    // Play sound
    playSound("error");
  });

  socket.on("roomError", ({ message }) => {
    alert(message);
    waitingScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    // Animation
    loginScreen.style.animation = "none";
    setTimeout(() => {
      loginScreen.style.animation = "fade-in 0.5s ease";
    }, 10);

    // Play sound
    playSound("error");
  });

  // Reset game event
  resetButton.addEventListener("click", () => {
    if (currentRoomId) {
      socket.emit("resetGame", { roomId: currentRoomId });
      // Add effect to button
      resetButton.classList.add("clicked");
      setTimeout(() => {
        resetButton.classList.remove("clicked");
      }, 200);
    }
  });

  // New game event
  newGameButton.addEventListener("click", () => {
    if (currentRoomId) {
      // Reset game and scores
      socket.emit("resetGame", { roomId: currentRoomId });
      xScore = 0;
      oScore = 0;
      xScoreElem.textContent = "0";
      oScoreElem.textContent = "0";

      // Add effect to button
      newGameButton.classList.add("clicked");
      setTimeout(() => {
        newGameButton.classList.remove("clicked");
      }, 200);
    }
  });

  // Board size change event
  boardSizeSelect.addEventListener("change", () => {
    if (currentRoomId && !gameActive) {
      const size = parseInt(boardSizeSelect.value);
      socket.emit("changeBoardSize", { roomId: currentRoomId, size });
    } else if (gameActive) {
      alert("Không thể thay đổi kích thước bàn cờ khi đang chơi!");
      boardSizeSelect.value = boardSize.toString();

      // Play sound
      playSound("error");
    }
  });

  // Move time change event
  gameMoveTimeSelect.addEventListener("change", () => {
    if (currentRoomId && !gameActive) {
      const newMoveTime = parseInt(gameMoveTimeSelect.value);
      socket.emit("changeMoveTime", {
        roomId: currentRoomId,
        moveTime: newMoveTime,
      });
    } else if (gameActive) {
      alert("Không thể thay đổi thời gian nước đi khi đang chơi!");
      gameMoveTimeSelect.value = moveTime.toString();

      // Play sound
      playSound("error");
    }
  });

  // Hàm khởi tạo bàn cờ
  function initBoard() {
    gameBoard.innerHTML = "";
    gameBoard.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;

    if (!gameState.length) {
      gameState = Array(boardSize)
        .fill()
        .map(() => Array(boardSize).fill(""));
    }

    for (let i = 0; i < boardSize; i++) {
      for (let j = 0; j < boardSize; j++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.dataset.row = i;
        cell.dataset.col = j;

        // Add x or o class if cell is already marked
        if (gameState[i][j]) {
          cell.classList.add(gameState[i][j]);
        }

        cell.addEventListener("click", handleCellClick);
        gameBoard.appendChild(cell);

        // Animation thêm dần các ô
        cell.style.opacity = "0";
        setTimeout(() => {
          cell.style.opacity = "1";
        }, (i * boardSize + j) * 5);
      }
    }

    // Cập nhật trạng thái người chơi
    updatePlayerTurn();
  }

  // Hàm xử lý khi click vào ô
  function handleCellClick(e) {
    if (!gameActive) return;

    // Only allow moves on your turn
    if (currentPlayer !== mySymbol) return;

    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);

    // Kiểm tra xem ô đã được đánh chưa
    if (gameState[row][col] !== "") {
      // Play error sound for invalid move
      playSound("error");
      return;
    }

    // Hiệu ứng hình ảnh
    e.target.classList.add("clicked");
    setTimeout(() => {
      e.target.classList.remove("clicked");
    }, 200);

    // Send move to server
    socket.emit("makeMove", { roomId: currentRoomId, row, col });

    // Play move sound
    playSound("move");
  }

  // Hàm cập nhật lượt chơi
  function updatePlayerTurn() {
    playerX.classList.toggle("active", currentPlayer === "x");
    playerO.classList.toggle("active", currentPlayer === "o");

    // Highlight timer when it's my turn
    if (currentPlayer === mySymbol) {
      timerDisplay.parentElement.classList.add("active");
    } else {
      timerDisplay.parentElement.classList.remove("active");
    }
  }

  // Hàm cập nhật giao diện bàn cờ
  function updateBoardUI() {
    const cells = document.querySelectorAll(".cell");

    for (let i = 0; i < boardSize; i++) {
      for (let j = 0; j < boardSize; j++) {
        const cellIndex = i * boardSize + j;
        const cell = cells[cellIndex];

        // Clear existing classes
        cell.classList.remove("x", "o");

        // Add class based on game state
        if (gameState[i][j]) {
          cell.classList.add(gameState[i][j]);
        }
      }
    }
  }

  // Hàm cập nhật hiển thị thời gian
  function updateTimerDisplay() {
    // Add warning class when time is running low
    if (timeLeft <= 10 && timeLeft > 5) {
      timerDisplay.classList.add("warning");
      timerDisplay.classList.remove("danger");
    } else if (timeLeft <= 5) {
      timerDisplay.classList.add("danger");
      timerDisplay.classList.remove("warning");
    } else {
      timerDisplay.classList.remove("warning", "danger");
    }
  }

  // Hàm reset game
  function resetGame() {
    gameActive = true;
    currentPlayer = "x";
    gameState = Array(boardSize)
      .fill()
      .map(() => Array(boardSize).fill(""));

    document.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.remove("x", "o", "win-cell");
    });

    gameMessage.textContent = "";
    gameMessage.classList.remove("win-message");

    updatePlayerTurn();
  }

  // Socket events for emoji reactions
  socket.on("emojiReceived", ({ emoji, player }) => {
    console.log("Emoji received:", emoji, "from player:", player);
    showEmojiAnimation(emoji, player);
    playSound("emoji");
  });

  // Biến theo dõi thời gian gửi emoji cuối cùng
  let lastEmojiTime = 0;
  const EMOJI_COOLDOWN = 3000; // 3 giây cooldown

  // Function to show emoji animation on the board
  function showEmojiAnimation(emoji, player) {
    console.log("Showing emoji animation:", emoji, player);

    // Tối ưu hiệu suất trên thiết bị di động
    const isMobile = isMobileDevice();

    if (emoji === "heart") {
      showHeartAnimation();
    } else if (emoji === "stone") {
      // Stone animation - optimized
      const numStones = isMobile ? 1 : 2;
      for (let i = 0; i < numStones; i++) {
        const emojiElement = document.createElement("div");
        emojiElement.classList.add("emoji-animation");
        emojiElement.textContent = "🪨";

        const boardRect = gameBoard.getBoundingClientRect();
        const startX =
          player === "x"
            ? boardRect.left + Math.random() * 100
            : boardRect.right - 100 - Math.random() * 100;
        const startY = boardRect.bottom - 50;

        emojiElement.style.left = `${startX}px`;
        emojiElement.style.top = `${startY}px`;

        document.body.appendChild(emojiElement);

        // Batch style changes to reduce reflows
        requestAnimationFrame(() => {
          emojiElement.classList.add("emoji-fly");
        });

        setTimeout(() => {
          if (emojiElement.parentNode) {
            emojiElement.parentNode.removeChild(emojiElement);
          }
        }, 3000);
      }
    } else if (emoji === "clap") {
      // Clap animation - optimized
      const centerClap = document.createElement("div");
      centerClap.classList.add("emoji-clap");
      centerClap.textContent = "👏";
      document.body.appendChild(centerClap);

      const numClaps = isMobile ? 5 : 10;
      const fragment = document.createDocumentFragment();

      for (let i = 0; i < numClaps; i++) {
        setTimeout(() => {
          const clap = document.createElement("div");
          clap.textContent = "👏";
          clap.style.position = "fixed";
          clap.style.fontSize = `${Math.random() * 2 + 1}em`;

          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;
          clap.style.left = `${Math.random() * screenWidth}px`;
          clap.style.top = `${
            (Math.random() * screenHeight) / 2 + screenHeight / 4
          }px`;
          clap.style.transition = "all 1s ease-out";
          clap.style.opacity = "0";
          clap.style.transform = "scale(0.5)";

          document.body.appendChild(clap);

          // Batch together for better performance
          requestAnimationFrame(() => {
            clap.style.opacity = "1";
            clap.style.transform = "scale(1.2)";
          });

          setTimeout(() => {
            clap.style.opacity = "0";
            clap.style.transform = "scale(0.5) translateY(-20px)";

            setTimeout(() => {
              if (clap.parentNode) {
                clap.parentNode.removeChild(clap);
              }
            }, 1000);
          }, 1000);
        }, i * (isMobile ? 200 : 100));
      }

      setTimeout(() => {
        if (centerClap.parentNode) {
          centerClap.parentNode.removeChild(centerClap);
        }
      }, 2000);
    } else if (emoji === "laugh") {
      // Laugh animation - optimized
      const centerLaugh = document.createElement("div");
      centerLaugh.classList.add("emoji-laugh");
      centerLaugh.textContent = "😂";
      document.body.appendChild(centerLaugh);

      const texts = ["HA", "HA HA", "HI HI", "HE HE"];
      const numTexts = isMobile ? 8 : 15;

      for (let i = 0; i < numTexts; i++) {
        setTimeout(() => {
          const text = document.createElement("div");
          text.textContent = texts[Math.floor(Math.random() * texts.length)];
          text.style.position = "fixed";
          text.style.fontSize = `${Math.random() * 1.5 + 1}em`;
          text.style.fontWeight = "bold";
          text.style.color = `hsl(${Math.random() * 60 + 30}, 100%, 50%)`;

          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;
          text.style.left = `${
            Math.random() * screenWidth * 0.6 + screenWidth * 0.2
          }px`;
          text.style.top = `${
            Math.random() * screenHeight * 0.6 + screenHeight * 0.2
          }px`;
          text.style.opacity = "0";
          text.style.transition = "all 1.5s ease-out";
          text.style.transform = "scale(0.5)";

          document.body.appendChild(text);

          requestAnimationFrame(() => {
            text.style.opacity = "1";
            text.style.transform = "scale(1.2)";
          });

          setTimeout(() => {
            text.style.opacity = "0";
            text.style.transform = "scale(0.8) translateY(-40px)";

            setTimeout(() => {
              if (text.parentNode) {
                text.parentNode.removeChild(text);
              }
            }, 1500);
          }, 1500);
        }, i * (isMobile ? 200 : 150));
      }

      setTimeout(() => {
        if (centerLaugh.parentNode) {
          centerLaugh.parentNode.removeChild(centerLaugh);
        }
      }, 2000);
    } else if (emoji === "think") {
      // Think animation - optimized
      const centerThink = document.createElement("div");
      centerThink.classList.add("emoji-think");
      centerThink.textContent = "🤔";
      document.body.appendChild(centerThink);

      const numBubbles = isMobile ? 4 : 8;

      for (let i = 0; i < numBubbles; i++) {
        setTimeout(() => {
          const bubble = document.createElement("div");
          bubble.textContent = "💭";
          bubble.style.position = "fixed";
          bubble.style.fontSize = `${Math.random() * 1.5 + 1}em`;

          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;
          const centerX = screenWidth / 2;
          const centerY = screenHeight / 2;

          const angle = Math.random() * Math.PI - Math.PI / 2;
          const distance = Math.random() * 100 + 50;

          bubble.style.left = `${centerX + Math.cos(angle) * distance}px`;
          bubble.style.top = `${centerY + Math.sin(angle) * distance}px`;
          bubble.style.opacity = "0";
          bubble.style.transition = "all 2s ease-out";
          bubble.style.transform = "scale(0.5)";

          document.body.appendChild(bubble);

          requestAnimationFrame(() => {
            bubble.style.opacity = "0.8";
            bubble.style.transform = "scale(1) translateY(-100px)";
          });

          setTimeout(() => {
            bubble.style.opacity = "0";

            setTimeout(() => {
              if (bubble.parentNode) {
                bubble.parentNode.removeChild(bubble);
              }
            }, 2000);
          }, 2000);
        }, i * 250);
      }

      setTimeout(() => {
        if (centerThink.parentNode) {
          centerThink.parentNode.removeChild(centerThink);
        }
      }, 2500);
    } else if (emoji === "fire") {
      // Fire animation - optimized
      const centerFire = document.createElement("div");
      centerFire.classList.add("emoji-fire");
      centerFire.textContent = "🔥";
      document.body.appendChild(centerFire);

      const particles = ["💥", "✨", "🔥", "⚡"];
      const numParticles = isMobile ? 10 : 20;

      for (let i = 0; i < numParticles; i++) {
        setTimeout(() => {
          const particle = document.createElement("div");
          particle.classList.add("fire-particle");
          particle.textContent =
            particles[Math.floor(Math.random() * particles.length)];
          particle.style.fontSize = `${Math.random() * 1.8 + 0.8}em`;

          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;
          const centerX = screenWidth / 2;
          const centerY = screenHeight / 2;

          particle.style.left = `${centerX}px`;
          particle.style.top = `${centerY}px`;

          const tx = Math.random() * 300 - 150;
          const ty = Math.random() * 300 - 150;
          particle.style.setProperty("--tx", `${tx}px`);
          particle.style.setProperty("--ty", `${ty}px`);

          document.body.appendChild(particle);

          setTimeout(() => {
            if (particle.parentNode) {
              particle.parentNode.removeChild(particle);
            }
          }, 1500);
        }, i * (isMobile ? 150 : 100));
      }

      setTimeout(() => {
        if (centerFire.parentNode) {
          centerFire.parentNode.removeChild(centerFire);
        }
      }, 2000);
    } else if (emoji === "cow") {
      // Cow animation - super cute and unique
      const centerCow = document.createElement("div");
      centerCow.classList.add("emoji-cow");
      centerCow.textContent = "🐄";
      document.body.appendChild(centerCow);

      // Create MOO sound effects
      const mooTexts = ["MOO!", "Moo~", "MOOO!", "moo moo", "🥛"];
      const numMoos = isMobile ? 8 : 15;

      for (let i = 0; i < numMoos; i++) {
        setTimeout(() => {
          const moo = document.createElement("div");
          moo.classList.add("cow-moo");
          moo.textContent =
            mooTexts[Math.floor(Math.random() * mooTexts.length)];

          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;
          const centerX = screenWidth / 2;
          const centerY = screenHeight / 2;

          // Position around the center cow
          const angle = (i / numMoos) * Math.PI * 2;
          const distance = Math.random() * 80 + 60;

          moo.style.left = `${centerX + Math.cos(angle) * distance}px`;
          moo.style.top = `${centerY + Math.sin(angle) * distance}px`;

          document.body.appendChild(moo);

          setTimeout(() => {
            if (moo.parentNode) {
              moo.parentNode.removeChild(moo);
            }
          }, 2000);
        }, i * (isMobile ? 200 : 150));
      }

      // Create floating mini cows
      const numCows = isMobile ? 6 : 12;
      for (let i = 0; i < numCows; i++) {
        setTimeout(() => {
          const miniCow = document.createElement("div");
          miniCow.textContent = "🐄";
          miniCow.style.position = "fixed";
          miniCow.style.fontSize = `${Math.random() * 1.5 + 1}em`;

          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;
          const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left

          // Start from edges and move towards center
          if (side === 0) {
            // top
            miniCow.style.left = `${Math.random() * screenWidth}px`;
            miniCow.style.top = `-50px`;
          } else if (side === 1) {
            // right
            miniCow.style.left = `${screenWidth + 50}px`;
            miniCow.style.top = `${Math.random() * screenHeight}px`;
          } else if (side === 2) {
            // bottom
            miniCow.style.left = `${Math.random() * screenWidth}px`;
            miniCow.style.top = `${screenHeight + 50}px`;
          } else {
            // left
            miniCow.style.left = `-50px`;
            miniCow.style.top = `${Math.random() * screenHeight}px`;
          }

          miniCow.style.opacity = "0";
          miniCow.style.transition = "all 2s ease-out";
          miniCow.style.transform = "scale(0.5) rotate(0deg)";
          miniCow.style.zIndex = "1000";

          document.body.appendChild(miniCow);

          // Animate towards center
          requestAnimationFrame(() => {
            const centerX = screenWidth / 2;
            const centerY = screenHeight / 2;
            miniCow.style.left = `${centerX + (Math.random() - 0.5) * 100}px`;
            miniCow.style.top = `${centerY + (Math.random() - 0.5) * 100}px`;
            miniCow.style.opacity = "1";
            miniCow.style.transform = `scale(1.2) rotate(${
              (Math.random() - 0.5) * 360
            }deg)`;
          });

          setTimeout(() => {
            miniCow.style.opacity = "0";
            miniCow.style.transform = `scale(0) rotate(720deg)`;

            setTimeout(() => {
              if (miniCow.parentNode) {
                miniCow.parentNode.removeChild(miniCow);
              }
            }, 2000);
          }, 1500);
        }, i * (isMobile ? 250 : 200));
      }

      setTimeout(() => {
        if (centerCow.parentNode) {
          centerCow.parentNode.removeChild(centerCow);
        }
      }, 2500);
    }

    // Play sound
    playSound("emoji");
  }

  // Function to setup emoji buttons
  function setupEmojiButtons() {
    // Emoji reaction buttons
    const heartEmojiBtn = document.getElementById("heart-emoji");
    const stoneEmojiBtn = document.getElementById("stone-emoji");
    const clapEmojiBtn = document.getElementById("clap-emoji");
    const laughEmojiBtn = document.getElementById("laugh-emoji");
    const thinkEmojiBtn = document.getElementById("think-emoji");
    const fireEmojiBtn = document.getElementById("fire-emoji");

    // Hàm gửi emoji với kiểm tra thời gian chờ
    const sendEmoji = (emoji) => {
      const now = Date.now();
      if (now - lastEmojiTime < EMOJI_COOLDOWN) {
        // Chưa đủ thời gian chờ
        console.log(
          `Phải đợi ${Math.ceil(
            (EMOJI_COOLDOWN - (now - lastEmojiTime)) / 1000
          )}s nữa để gửi emoji`
        );

        // Hiển thị thông báo nhỏ
        const gameMessage = document.getElementById("game-message");
        if (gameMessage) {
          gameMessage.textContent =
            "Vui lòng đợi 3 giây giữa mỗi lần gửi emoji";
          gameMessage.style.opacity = "1";
          setTimeout(() => {
            gameMessage.style.opacity = "0";
            setTimeout(() => {
              if (
                gameMessage.textContent ===
                "Vui lòng đợi 3 giây giữa mỗi lần gửi emoji"
              ) {
                gameMessage.textContent = "";
              }
            }, 300);
          }, 1500);
        }

        return false;
      }

      // Đủ thời gian chờ, gửi emoji
      if (currentRoomId) {
        socket.emit("sendEmoji", { roomId: currentRoomId, emoji: emoji });
        lastEmojiTime = now;
        return true;
      }

      return false;
    };

    // Remove existing listeners to avoid duplicates
    const removeOldListeners = (element, event) => {
      if (element && element.cloneNode) {
        const newElement = element.cloneNode(true);
        if (element.parentNode) {
          element.parentNode.replaceChild(newElement, element);
        }
        return newElement;
      }
      return element;
    };

    // Heart emoji button
    let newHeartBtn = removeOldListeners(heartEmojiBtn, "click");
    if (newHeartBtn) {
      newHeartBtn.addEventListener("click", () => {
        console.log("Heart emoji clicked");
        if (sendEmoji("heart")) {
          playSound("emoji");

          // Add click effect to button
          newHeartBtn.classList.add("clicked");
          setTimeout(() => {
            newHeartBtn.classList.remove("clicked");
          }, 200);
        }
      });
    }

    // Stone emoji button
    let newStoneBtn = removeOldListeners(stoneEmojiBtn, "click");
    if (newStoneBtn) {
      newStoneBtn.addEventListener("click", () => {
        console.log("Stone emoji clicked");
        if (sendEmoji("stone")) {
          playSound("emoji");

          // Add click effect to button
          newStoneBtn.classList.add("clicked");
          setTimeout(() => {
            newStoneBtn.classList.remove("clicked");
          }, 200);
        }
      });
    }

    // Clap emoji button
    let newClapBtn = removeOldListeners(clapEmojiBtn, "click");
    if (newClapBtn) {
      newClapBtn.addEventListener("click", () => {
        console.log("Clap emoji clicked");
        if (sendEmoji("clap")) {
          playSound("emoji");

          // Add click effect to button
          newClapBtn.classList.add("clicked");
          setTimeout(() => {
            newClapBtn.classList.remove("clicked");
          }, 200);
        }
      });
    }

    // Laugh emoji button
    let newLaughBtn = removeOldListeners(laughEmojiBtn, "click");
    if (newLaughBtn) {
      newLaughBtn.addEventListener("click", () => {
        console.log("Laugh emoji clicked");
        if (sendEmoji("laugh")) {
          playSound("emoji");

          // Add click effect to button
          newLaughBtn.classList.add("clicked");
          setTimeout(() => {
            newLaughBtn.classList.remove("clicked");
          }, 200);
        }
      });
    }

    // Think emoji button
    let newThinkBtn = removeOldListeners(thinkEmojiBtn, "click");
    if (newThinkBtn) {
      newThinkBtn.addEventListener("click", () => {
        console.log("Think emoji clicked");
        if (sendEmoji("think")) {
          playSound("emoji");

          // Add click effect to button
          newThinkBtn.classList.add("clicked");
          setTimeout(() => {
            newThinkBtn.classList.remove("clicked");
          }, 200);
        }
      });
    }

    // Fire emoji button
    let newFireBtn = removeOldListeners(fireEmojiBtn, "click");
    if (newFireBtn) {
      newFireBtn.addEventListener("click", () => {
        console.log("Fire emoji clicked");
        if (sendEmoji("fire")) {
          playSound("emoji");

          // Add click effect to button
          newFireBtn.classList.add("clicked");
          setTimeout(() => {
            newFireBtn.classList.remove("clicked");
          }, 200);
        }
      });
    }

    // Cow emoji button
    let newCowBtn = removeOldListeners(cowEmojiBtn, "click");
    if (newCowBtn) {
      newCowBtn.addEventListener("click", () => {
        console.log("Cow emoji clicked");
        if (sendEmoji("cow")) {
          playSound("emoji");

          // Add click effect to button
          newCowBtn.classList.add("clicked");
          setTimeout(() => {
            newCowBtn.classList.remove("clicked");
          }, 200);
        }
      });
    }
  }

  // Thêm chế độ hiệu suất cao khi khởi động
  document.addEventListener("DOMContentLoaded", function () {
    // Tối ưu cho thiết bị di động
    optimizeForMobile();

    // Phát hiện thiết bị hiệu suất thấp và áp dụng tối ưu sâu
    applyPerformanceOptimizations();

    // Khởi tạo blockchain background animation
    initBlockchainBackground();

    // Preload sounds for better user experience - sử dụng requestIdleCallback nếu có
    const userInteraction = () => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => {
          if (!soundsLoaded) preloadSounds();
        });
      } else {
        if (!soundsLoaded) preloadSounds();
      }
      document.removeEventListener("click", userInteraction);
    };
    document.addEventListener("click", userInteraction);
  });

  // DOM elements for chat and video
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const sendMessageBtn = document.getElementById("send-message-btn");
  const toggleVideoBtn = document.getElementById("toggle-video");
  const toggleAudioBtn = document.getElementById("toggle-audio");
  const endCallBtn = document.getElementById("end-call");
  const localVideo = document.getElementById("local-video");
  const remoteVideo = document.getElementById("remote-video");

  // Chat tab functionality
  const communicationTabs = document.querySelectorAll(
    ".communication-container .tab-btn"
  );
  const communicationContents = document.querySelectorAll(
    ".communication-container .tab-content"
  );

  communicationTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active class from all tabs and contents
      communicationTabs.forEach((t) => t.classList.remove("active"));
      communicationContents.forEach((c) => c.classList.remove("active"));

      // Add active class to current tab and content
      tab.classList.add("active");
      const tabId = tab.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });
  });

  // Chat functionality
  sendMessageBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Send message to server
    socket.emit("sendMessage", { roomId: currentRoomId, message });

    // Clear input
    chatInput.value = "";
  }

  function appendMessage(message) {
    const { sender, symbol, message: text, timestamp } = message;

    // Create message element
    const messageEl = document.createElement("div");
    messageEl.className = `message ${symbol === mySymbol ? "own" : "other"} ${
      symbol === "x" ? "x-player" : "o-player"
    }`;

    // Create sender element
    const senderEl = document.createElement("div");
    senderEl.className = "sender";
    senderEl.textContent = `${sender} (${symbol.toUpperCase()})`;

    // Create text element
    const textEl = document.createElement("div");
    textEl.className = "text";
    textEl.textContent = text;

    // Create timestamp element
    const timestampEl = document.createElement("div");
    timestampEl.className = "timestamp";
    timestampEl.textContent = new Date(timestamp).toLocaleTimeString();

    // Append all elements to message
    messageEl.appendChild(senderEl);
    messageEl.appendChild(textEl);
    messageEl.appendChild(timestampEl);

    // Append message to chat
    chatMessages.appendChild(messageEl);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Play sound if message is from opponent
    if (symbol !== mySymbol) {
      playSound("message");
    }
  }

  // Socket event for receiving messages
  socket.on("messageReceived", (messageData) => {
    appendMessage(messageData);
  });

  // Video call functionality
  let localStream = null;
  let peerConnection = null;
  let isVideoEnabled = true;
  let isAudioEnabled = true;
  let isCallActive = false;

  // ICE servers for WebRTC
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.stunprotocol.org:3478" },
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      {
        urls: "turn:numb.viagenie.ca",
        credential: "muazkh",
        username: "webrtc@live.com",
      },
    ],
  };

  // Start video call
  async function startVideoCall() {
    try {
      // Get user media
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Display local video
      localVideo.srcObject = localStream;

      // Create peer connection
      createPeerConnection();

      // Add local stream to peer connection
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer to remote peer
      const remotePlayerId = Object.values(playersInfo).find(
        (player) => player.id !== socket.id
      )?.id;
      if (remotePlayerId) {
        socket.emit("videoSignal", {
          roomId: currentRoomId,
          signal: peerConnection.localDescription,
          recipientId: remotePlayerId,
        });
      }

      // Update UI to show call is active
      isCallActive = true;
      toggleVideoBtn.classList.add("active");
      toggleAudioBtn.classList.add("active");
      endCallBtn.style.display = "flex";

      // Notify others about call status
      socket.emit("videoStatus", {
        roomId: currentRoomId,
        isActive: true,
      });

      // Play call sound
      playSound("call");
    } catch (error) {
      console.error("Error starting video call:", error);
      alert("Không thể bắt đầu cuộc gọi video: " + error.message);
    }
  }

  // Create WebRTC peer connection
  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(iceServers);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const remotePlayerId = Object.values(playersInfo).find(
          (player) => player.id !== socket.id
        )?.id;
        if (remotePlayerId) {
          socket.emit("videoSignal", {
            roomId: currentRoomId,
            signal: { type: "ice-candidate", candidate: event.candidate },
            recipientId: remotePlayerId,
          });
        }
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (
        peerConnection.connectionState === "disconnected" ||
        peerConnection.connectionState === "failed"
      ) {
        endVideoCall();
      }
    };
  }

  // End video call
  function endVideoCall() {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }

    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    // Reset video elements
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;

    // Update UI
    isCallActive = false;
    toggleVideoBtn.classList.remove("active");
    toggleAudioBtn.classList.remove("active");
    endCallBtn.style.display = "none";

    // Notify others about call status
    socket.emit("videoStatus", {
      roomId: currentRoomId,
      isActive: false,
    });
  }

  // Toggle video
  function toggleVideo() {
    if (!localStream) return;

    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    isVideoEnabled = !isVideoEnabled;
    videoTracks.forEach((track) => {
      track.enabled = isVideoEnabled;
    });

    toggleVideoBtn.classList.toggle("disabled", !isVideoEnabled);
  }

  // Toggle audio
  function toggleAudio() {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    isAudioEnabled = !isAudioEnabled;
    audioTracks.forEach((track) => {
      track.enabled = isAudioEnabled;
    });

    toggleAudioBtn.classList.toggle("disabled", !isAudioEnabled);
  }

  // Socket event for video signals
  socket.on("videoSignal", async ({ senderId, signal }) => {
    try {
      if (signal.type === "offer") {
        // If we received an offer, we need to create a peer connection
        if (!peerConnection) {
          // Get user media
          localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

          // Display local video
          localVideo.srcObject = localStream;

          // Create peer connection
          createPeerConnection();

          // Add local stream to peer connection
          localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
          });
        }

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(signal)
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Send answer to remote peer
        socket.emit("videoSignal", {
          roomId: currentRoomId,
          signal: peerConnection.localDescription,
          recipientId: senderId,
        });

        // Update UI to show call is active
        isCallActive = true;
        toggleVideoBtn.classList.add("active");
        toggleAudioBtn.classList.add("active");
        endCallBtn.style.display = "flex";

        // Play call sound
        playSound("call");
      } else if (signal.type === "answer") {
        // If we received an answer, we need to set the remote description
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(signal)
        );
      } else if (signal.type === "ice-candidate") {
        // If we received an ICE candidate, we need to add it to the peer connection
        if (peerConnection) {
          await peerConnection.addIceCandidate(
            new RTCIceCandidate(signal.candidate)
          );
        }
      }
    } catch (error) {
      console.error("Error handling video signal:", error);
    }
  });

  // Socket event for video status updates
  socket.on("videoStatusUpdate", ({ playerId, playerName, isActive }) => {
    if (isActive) {
      // Add notification that the player started a video call
      const notification = document.createElement("div");
      notification.className = "system-message";
      notification.textContent = `${playerName} đã bắt đầu cuộc gọi video. Nhấn vào tab "Video Call" để tham gia.`;
      chatMessages.appendChild(notification);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Play notification sound
      playSound("call");
    }
  });

  // Add event listeners for video controls
  toggleVideoBtn.addEventListener("click", () => {
    if (!isCallActive) {
      startVideoCall();
    } else {
      toggleVideo();
    }
  });

  toggleAudioBtn.addEventListener("click", toggleAudio);
  endCallBtn.addEventListener("click", endVideoCall);

  // Clean up video call when leaving room
  function cleanupVideoCall() {
    endVideoCall();
    chatMessages.innerHTML = "";
  }

  // Clean up video call when window is closed or refreshed
  window.addEventListener("beforeunload", () => {
    endVideoCall();
  });

  // Hiển thị thông báo lượt chơi ở đầu màn hình
  function showTurnNotification() {
    const turnNotification = document.getElementById("turn-notification");
    const playerSymbol = currentPlayer.toUpperCase();
    const playerName =
      playersInfo[currentPlayer]?.name || `Người chơi ${playerSymbol}`;

    // Create notification content with colored player symbol
    turnNotification.innerHTML = `Lượt của <span class="player-${currentPlayer}">${playerName}</span>`;

    // Add show class to display the notification
    turnNotification.classList.add("show");

    // Remove show class after 1.5 seconds
    setTimeout(() => {
      turnNotification.classList.remove("show");
    }, 1500);
  }

  // Hiển thị thông báo lượt chơi ở giữa màn hình với hiệu ứng đẹp
  function showCenterTurnNotification() {
    const centerTurnNotification = document.getElementById(
      "center-turn-notification"
    );
    const turnIcon = centerTurnNotification.querySelector(".turn-icon");
    const turnText = centerTurnNotification.querySelector(".turn-text");

    const playerSymbol = currentPlayer.toUpperCase();
    const playerName =
      playersInfo[currentPlayer]?.name || `Người chơi ${playerSymbol}`;
    const isMyTurn = currentPlayer === mySymbol;

    // Set icon based on player
    turnIcon.textContent = currentPlayer === "x" ? "❌" : "⭕";

    // Set text with different messages for own turn vs opponent turn
    if (isMyTurn) {
      turnText.innerHTML = `<strong>Đến lượt bạn!</strong><br/><span style="font-size: 0.8em; opacity: 0.9;">Hãy đặt quân ${playerSymbol}</span>`;
    } else {
      turnText.innerHTML = `<strong>Lượt của ${playerName}</strong><br/><span style="font-size: 0.8em; opacity: 0.9;">Đang chờ đối thủ đặt quân...</span>`;
    }

    // Reset classes
    centerTurnNotification.className = "center-turn-notification";

    // Add player-specific class for colors
    centerTurnNotification.classList.add(`player-${currentPlayer}`);

    // Show notification with animation
    centerTurnNotification.classList.add("show");

    // Hide after 1 second
    setTimeout(() => {
      centerTurnNotification.classList.remove("show");
    }, 1000);

    // Add more particles for spectacular effect
    setTimeout(() => {
      createTurnParticles(centerTurnNotification);
    }, 200);
  }

  // Tạo hiệu ứng particles cho thông báo lượt
  function createTurnParticles(container) {
    // Skip on mobile for performance
    if (isMobileDevice()) return;

    const colors =
      currentPlayer === "x"
        ? ["#ff5252", "#ff6b6b", "#ff8a80"]
        : ["#22c55e", "#4ade80", "#86efac"];

    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        const particle = document.createElement("div");
        particle.style.position = "absolute";
        particle.style.width = "4px";
        particle.style.height = "4px";
        particle.style.backgroundColor =
          colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = "50%";
        particle.style.pointerEvents = "none";
        particle.style.zIndex = "1";

        // Random position around the notification
        const angle = (i / 12) * Math.PI * 2;
        const distance = 60 + Math.random() * 40;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        particle.style.left = `calc(50% + ${x}px)`;
        particle.style.top = `calc(50% + ${y}px)`;
        particle.style.transform = "scale(0)";
        particle.style.transition =
          "all 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

        container.appendChild(particle);

        // Animate particle
        requestAnimationFrame(() => {
          particle.style.transform = `scale(1) translate(${
            (Math.random() - 0.5) * 100
          }px, ${-50 - Math.random() * 50}px)`;
          particle.style.opacity = "0";
        });

        // Remove particle
        setTimeout(() => {
          if (particle.parentNode) {
            particle.parentNode.removeChild(particle);
          }
        }, 1500);
      }, i * 50);
    }
  }

  // Function to show win/loss notification
  function showWinLossNotification(type, winner, details = {}) {
    // Clear previous classes
    winLossNotification.className = "win-loss-notification";

    // Clear previous effects
    winLossEffects.innerHTML = "";

    let icon, title, subtitle;

    if (type === "win") {
      const isMyWin = winner === mySymbol;
      icon = isMyWin ? "🏆" : "😢";
      title = isMyWin ? "CHIẾN THẮNG!" : "THẤT BẠI!";
      subtitle = isMyWin
        ? `Chúc mừng! Bạn đã thắng!`
        : `${playersInfo[winner]?.name || "Đối thủ"} đã thắng!`;

      winLossNotification.classList.add(isMyWin ? "win" : "loss");

      // Add confetti effect for win
      if (isMyWin) {
        createConfetti();
      }
    } else if (type === "draw") {
      icon = "🤝";
      title = "HÒA!";
      subtitle = "Trận đấu kết thúc với tỷ số hòa";
      winLossNotification.classList.add("draw");

      // Add sparkle effect for draw
      createSparkles();
    } else if (type === "timeout") {
      const isMyTimeout = details.timeoutPlayer === mySymbol;
      icon = isMyTimeout ? "⏰😢" : "⏰🏆";
      title = isMyTimeout ? "HẾT GIỜ!" : "CHIẾN THẮNG!";
      subtitle = isMyTimeout
        ? "Bạn đã hết thời gian!"
        : `${
            playersInfo[details.timeoutPlayer]?.name || "Đối thủ"
          } hết thời gian!`;

      winLossNotification.classList.add(isMyTimeout ? "loss" : "win");

      if (!isMyTimeout) {
        createConfetti();
      }
    }

    // Set content
    winLossIcon.textContent = icon;
    winLossTitle.textContent = title;
    winLossSubtitle.textContent = subtitle;

    // Show notification
    winLossNotification.classList.add("show");

    // Hide after 4 seconds
    setTimeout(() => {
      winLossNotification.classList.remove("show");

      // Clean up effects after hide animation
      setTimeout(() => {
        winLossEffects.innerHTML = "";
      }, 500);
    }, 4000);

    // Add click to close
    winLossNotification.addEventListener(
      "click",
      () => {
        winLossNotification.classList.remove("show");
        setTimeout(() => {
          winLossEffects.innerHTML = "";
        }, 500);
      },
      { once: true }
    );
  }

  // Function to create confetti effect
  function createConfetti() {
    const colors = [
      "#ffd700",
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#96ceb4",
      "#feca57",
    ];
    const numConfetti = isMobileDevice() ? 30 : 60;

    for (let i = 0; i < numConfetti; i++) {
      setTimeout(() => {
        const confetti = document.createElement("div");
        confetti.className = "confetti";
        confetti.style.left = Math.random() * 100 + "%";
        confetti.style.backgroundColor =
          colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + "s";
        confetti.style.animationDuration = Math.random() * 2 + 2 + "s";

        winLossEffects.appendChild(confetti);

        // Remove confetti after animation
        setTimeout(() => {
          if (confetti.parentNode) {
            confetti.parentNode.removeChild(confetti);
          }
        }, 5000);
      }, i * 50);
    }
  }

  // Function to create sparkle effect
  function createSparkles() {
    const numSparkles = isMobileDevice() ? 15 : 30;

    for (let i = 0; i < numSparkles; i++) {
      setTimeout(() => {
        const sparkle = document.createElement("div");
        sparkle.className = "sparkle";
        sparkle.style.left = Math.random() * 100 + "%";
        sparkle.style.top = Math.random() * 100 + "%";
        sparkle.style.animationDelay = Math.random() * 2 + "s";
        sparkle.style.animationDuration = Math.random() * 1 + 1.5 + "s";

        winLossEffects.appendChild(sparkle);

        // Remove sparkle after animation
        setTimeout(() => {
          if (sparkle.parentNode) {
            sparkle.parentNode.removeChild(sparkle);
          }
        }, 4000);
      }, i * 100);
    }
  }
});
