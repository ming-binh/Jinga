var jengaGame = (function(){

	"use strict";
	
	Physijs.scripts.worker = 'physijs_worker.js';
	Physijs.scripts.ammo = 'ammo.js';

	var scene = new Physijs.Scene({ fixedTimeStep: 1 / 120 }),
	renderer = new THREE.WebGLRenderer({antialias: true}),
    amb_light,
    dir_light,
	camera,
	controls,
	table,
	rectangle,
	tower,
	blocks = [],
	posx = -13,
	loader = new THREE.TextureLoader(),
	_vector = new THREE.Vector3,
	_i,
	_v3 = new THREE.Vector3,
	gameOver = false,
	hoveredBlock = null,

	// --- Dynamic Players State ---
	players = [],
	currentPlayerIndex = 0,
	isTurnActive = false,
	hasAnsweredCorrectly = false,
	isGameOverPending = false,
	activeZoneStart = -1,
	clickedBlock = null,
	hitPoint = null,
	turnFallenBlocksCount = 0,
	currentQuestion = null,
	turnTimer = null,
	questions = [],
	lastShootingPlayerIndex = -1,
	lastClickedBlock = null,
	quizTimerInterval = null,
	quizTimeRemaining = 15;

	function initScene(){

		scene.setGravity(new THREE.Vector3(0,-150,0));
		scene.addEventListener(
			'update',
			function() {
				scene.simulate( undefined, 1 );
			}
		);

		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.shadowMap.enabled = true;
        renderer.shadowMapSoft = true;
		renderer.setClearColor(0x000000, 1);
		document.getElementById("jenga-container").appendChild(renderer.domElement);

		camera = new THREE.PerspectiveCamera(
			40,
			window.innerWidth/window.innerHeight,
			1,
			1000
			);

		
		camera.position.set( 115, 75, 115 );
		camera.lookAt(new THREE.Vector3( 0, 35, 0 ));
        scene.add(camera);

        // ambient light
		amb_light = new THREE.AmbientLight( 0x444444 );
		scene.add( amb_light );

        // directional light
		dir_light = new THREE.DirectionalLight( 0xFFFFFF  );
		dir_light.position.set( 100, 100, -20 );
        dir_light.target.position.copy( scene.position );
        dir_light.castShadow = true;
        dir_light.shadow.camera.left = -300;
		dir_light.shadow.camera.top = -300;
		dir_light.shadow.camera.right = 300;
		dir_light.shadow.camera.bottom = 300;
		dir_light.shadow.camera.near = 20;
		dir_light.shadow.camera.far = 500;
		dir_light.shadow.bias = -.001;
		dir_light.shadow.mapSize.width = dir_light.shadow.mapSize.height = 2048;

        scene.add(dir_light);
		
		// Table (Dark Mahogany Wood)
		var tableTexture = Physijs.createMaterial(
				new THREE.MeshLambertMaterial({
					map: loader.load('texture/wood7.jpg'),
					color: 0x3a2312
				}),
				.9,
				.2
			);
	         
	 	table = new Physijs.BoxMesh(
	 		new THREE.BoxGeometry(160, 1, 150, 5, 5, 5),
	 		tableTexture,
	 		0,
	 		{ restitution: .2, friction: .8}
	 	);

        table.receiveShadow = true;
	  	table.name = "table"; 
	  	table.position.y = -3;
	 	scene.add(table);
		

	 	// Build Jenga tower
		for(var i=0; i<16; i++)
		{
			for(var j=0; j<3; j++)
			{
				tower = jengaPiece();
				tower.position.x = posx;
				posx += 10;
				tower.position.y += 5*i;

				if(i%2 === 0)
				{
					tower.rotation.x = 0;
					tower.rotation.y = 0;
					rectangle.rotation.z = Math.PI/2;
					tower.position.x = -3;
					tower.translateZ(10*j);
					tower.position.z -= 10;
				}

				tower.castShadow = true;
				tower.receiveShadow = true;
				scene.add(tower);
				blocks.push(tower);

				// Store initial state for scoring and restart
				tower.initialPosition = tower.position.clone();
				tower.initialRotation = tower.rotation.clone();
				tower.isRemoved = false;

			}

			tower.name = "jenga";
			
			posx = -13;
		}

		// Background texture removed for solid black background

		// Camera orbit controls (right-click drag to rotate, scroll to zoom)
		controls = new THREE.OrbitControls( camera, renderer.domElement );
		controls.rotateSpeed = 1.0;
		controls.zoomSpeed = 1.2;
		controls.enablePan = false;       // disable panning
		controls.enableZoom = true;
		controls.enableRotate = true;
		controls.mouseButtons = {
			ORBIT: THREE.MOUSE.RIGHT,
			ZOOM: THREE.MOUSE.MIDDLE,
			PAN: -1
		};
		controls.target.set( 0, 35, 0 );
		controls.minDistance = 60;
		controls.maxDistance = 250;

		// Block interaction: left-click directly fires impulse
		renderer.domElement.addEventListener( 'mousedown', function(evt) {
			if (evt.button !== 0) return; // only left-click
			handleBlockClick(evt);
		}, false);

		// Hover interaction
		renderer.domElement.addEventListener( 'mousemove', handleBlockHover, false );

		// Window resize handler
		window.addEventListener('resize', function() {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		});

		// Fetch questions from CNXHKH JSON
		fetch('cau_hoi_chuong_3_CNXHKH.json')
			.then(function(response) { return response.json(); })
			.then(function(data) {
				questions = data.map(function(q) {
					return {
						q: q.question,
						options: q.options,
						correct: q.options.indexOf(q.answer)
					};
				});
			})
			.catch(function(err) {
				console.error("Lỗi khi tải tệp câu hỏi:", err);
			});

        render();
	}
		
	function jengaPiece(){

		// Create a light warm wood color with slight organic variation for each block
		var blockColor = new THREE.Color(0xffe8d6);
		var variation = (Math.random() - 0.5) * 0.08;
		blockColor.r = Math.min(1.0, Math.max(0.0, blockColor.r + variation));
		blockColor.g = Math.min(1.0, Math.max(0.0, blockColor.g + variation * 0.8));
		blockColor.b = Math.min(1.0, Math.max(0.0, blockColor.b + variation * 0.6));

		var blockTexture = Physijs.createMaterial(
			new THREE.MeshLambertMaterial({
				map: loader.load('texture/wood7.jpg'),
				color: blockColor
			}),
			.4,
			.4
		);

		rectangle = new Physijs.BoxMesh(
			new THREE.BoxGeometry(5,28,8),
			blockTexture,
			10 // Set mass to 10 so it interacts realistically with the force
		);

		rectangle.rotation.x = Math.PI/2;
		rectangle.rotation.y = Math.PI/2;
		rectangle.castShadow = true;
		rectangle.receiveShadow = true;

		// Store original color on creation
		rectangle.originalColor = blockColor.clone();

		// Add borders/edges to make each block easily visible
		var edgesGeometry = new THREE.EdgesGeometry( rectangle.geometry );
		var borderMaterial = new THREE.LineBasicMaterial({
			color: 0x4d3222, // Dark brown border by default
			linewidth: 1
		});
		var border = new THREE.LineSegments( edgesGeometry, borderMaterial );
		// Scale slightly to prevent z-fighting
		border.scale.set( 1.005, 1.005, 1.005 );
		rectangle.add( border );
		rectangle.borderLine = border;

		return rectangle;
	}

	// Click handler: shoot block only if player has answered correctly and block is in active zone
	function handleBlockClick( evt ) {
		if ( gameOver || isTurnActive || !hasAnsweredCorrectly ) return;

		// Ensure camera matrices are up to date for raycasting
		camera.updateMatrixWorld();

		var mouse = new THREE.Vector2(
			( evt.clientX / window.innerWidth ) * 2 - 1,
			-( evt.clientY / window.innerHeight ) * 2 + 1
		);

		var raycaster = new THREE.Raycaster();
		raycaster.setFromCamera( mouse, camera );

		var intersections = raycaster.intersectObjects( blocks );

		if ( intersections.length > 0 ) {
			var block = intersections[0].object;
			var floor = Math.round(block.initialPosition.y / 5);

			// Enforce zone rule: must click blocks inside [activeZoneStart, activeZoneStart + 4]
			if ( floor < activeZoneStart || floor > activeZoneStart + 4 ) {
				return;
			}

			// Save reference to the target block and hit point
			clickedBlock = block;
			hitPoint = intersections[0].point;

			lastShootingPlayerIndex = currentPlayerIndex;
			lastClickedBlock = block;

			isTurnActive = true;
			turnFallenBlocksCount = 0;

			// Apply physics push
			applyImpulseToBlock();

			// Wait 3 seconds for physics simulation to settle
			turnTimer = setTimeout(function() {
				endTurn();
			}, 3000);
		}
	}

	function applyImpulseToBlock() {
		if ( !clickedBlock || !hitPoint ) return;

		// Get force value from slider
		var forceSlider = document.getElementById('force-slider');
		var forceMagnitude = forceSlider ? parseFloat(forceSlider.value) : 60;

		// Calculate push direction: from camera toward the hit point (horizontal)
		var pushDir = new THREE.Vector3();
		pushDir.subVectors( hitPoint, camera.position );
		pushDir.y = 0;
		pushDir.normalize();

		// Set linear factor to allow movement in all directions
		var ones = new THREE.Vector3(1, 1, 1);
		clickedBlock.setLinearFactor( ones );
		clickedBlock.setAngularFactor( ones );

		// Use setLinearVelocity to wake up and push the block
		var velocity = pushDir.clone().multiplyScalar( forceMagnitude * 0.15 );
		velocity.y = forceMagnitude * 0.05; // slight upward kick to make it fly nicely
		clickedBlock.setLinearVelocity( velocity );

		// Also apply impulse for extra impact
		var impulse = pushDir.clone().multiplyScalar( forceMagnitude * 0.5 );
		clickedBlock.applyCentralImpulse( impulse );
	}

	// Hover handler: highlight blocks only inside the active zone, otherwise show not-allowed cursor
	function handleBlockHover( evt ) {
		if ( gameOver || isTurnActive || !hasAnsweredCorrectly ) {
			if ( hoveredBlock ) {
				resetBlockHighlight( hoveredBlock );
				hoveredBlock = null;
			}
			document.body.style.cursor = 'default';
			return;
		}

		// Ensure camera matrices are up to date for raycasting
		camera.updateMatrixWorld();

		var mouse = new THREE.Vector2(
			( evt.clientX / window.innerWidth ) * 2 - 1,
			-( evt.clientY / window.innerHeight ) * 2 + 1
		);

		var raycaster = new THREE.Raycaster();
		raycaster.setFromCamera( mouse, camera );

		var intersections = raycaster.intersectObjects( blocks );

		if ( intersections.length > 0 ) {
			var block = intersections[0].object;
			var floor = Math.round(block.initialPosition.y / 5);

			if ( floor >= activeZoneStart && floor <= activeZoneStart + 4 ) {
				if ( hoveredBlock !== block ) {
					if ( hoveredBlock ) {
						resetBlockHighlight( hoveredBlock );
					}
					hoveredBlock = block;
					highlightBlock( hoveredBlock );
				}
				document.body.style.cursor = 'pointer';
			} else {
				if ( hoveredBlock ) {
					resetBlockHighlight( hoveredBlock );
					hoveredBlock = null;
				}
				document.body.style.cursor = 'not-allowed';
			}
		} else {
			if ( hoveredBlock ) {
				resetBlockHighlight( hoveredBlock );
				hoveredBlock = null;
			}
			document.body.style.cursor = 'default';
		}
	}

	function highlightBlock( block ) {
		if ( block && block.material ) {
			// Warm orange/yellow glow
			block.material.emissive.setHex( 0x3d281a ); 
			block.material.color.setHex( 0xffffff ); // brighter tone on hover
			
			if ( block.borderLine && block.borderLine.material ) {
				block.borderLine.material.color.setHex( 0xffaa00 ); // glowing orange border
			}
		}
	}

	function resetBlockHighlight( block ) {
		if ( block && block.material ) {
			var floor = Math.round(block.initialPosition.y / 5);
			if ( activeZoneStart !== -1 && (floor < activeZoneStart || floor >= activeZoneStart + 5) ) {
				// Outside active zone: revert to dark charred color
				block.material.color.setHex( 0x221a14 );
			} else {
				// Inside active zone: restore original bright wood color
				if ( block.originalColor ) {
					block.material.color.copy( block.originalColor );
				} else {
					block.material.color.setHex( 0xffe8d6 );
				}
			}
			block.material.emissive.setHex( 0x000000 );
			
			if ( block.borderLine && block.borderLine.material ) {
				if ( activeZoneStart !== -1 && (floor < activeZoneStart || floor >= activeZoneStart + 5) ) {
					block.borderLine.material.color.setHex( 0x110d0a ); // Dim/faded border
				} else {
					block.borderLine.material.color.setHex( 0x4d3222 ); // back to original dark brown border
				}
			}
		}
	}

	function highlightActiveZone() {
		// Randomly choose 5 adjacent levels out of the 16 total levels (levels 0 to 15)
		// Random activeZoneStart can range from 0 to 11
		activeZoneStart = Math.floor(Math.random() * 12);

		// Brighten active zone blocks, and darken inactive zone blocks
		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];
			var floor = Math.round(block.initialPosition.y / 5);
			if ( floor >= activeZoneStart && floor < activeZoneStart + 5 ) {
				// Active blocks: restore original bright color
				if ( block.material && block.originalColor ) {
					block.material.color.copy( block.originalColor );
				}
				if ( block.borderLine && block.borderLine.material ) {
					block.borderLine.material.color.setHex( 0x4d3222 ); // normal dark brown border
				}
			} else {
				// Inactive blocks: dark charred color
				if ( block.material ) {
					block.material.color.setHex( 0x221a14 );
				}
				if ( block.borderLine && block.borderLine.material ) {
					block.borderLine.material.color.setHex( 0x110d0a ); // dim border
				}
			}
		}

		// Show banner instructions
		var hintEl = document.getElementById("hint");
		if ( hintEl ) {
			hintEl.textContent = "HÃY BẮN khối gỗ ở 5 tầng nổi bật [" + (activeZoneStart + 1) + " - " + (activeZoneStart + 5) + "]!";
			hintEl.classList.remove("hidden");
		}
	}

	function resetAllBlockBorders() {
		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];
			if ( block.material && block.originalColor ) {
				block.material.color.copy( block.originalColor );
			}
			if ( block.borderLine && block.borderLine.material ) {
				block.borderLine.material.color.setHex( 0x4d3222 ); // Restore original dark brown border
			}
		}
		var hintEl = document.getElementById("hint");
		if ( hintEl ) {
			hintEl.textContent = "Click vào khối gỗ để trả lời câu hỏi · Kéo chuột phải để xoay camera";
		}
	}

	// Show quiz modal immediately when turn starts
	function showQuiz() {
		if ( gameOver || questions.length === 0 ) return;

		// Clear any existing quiz timer
		if ( quizTimerInterval ) {
			clearInterval( quizTimerInterval );
			quizTimerInterval = null;
		}

		// Select a random question
		var randomIndex = Math.floor(Math.random() * questions.length);
		currentQuestion = questions[randomIndex];

		// Disable orbit controls while quiz is open
		if ( controls ) controls.enabled = false;

		// Set player turn text
		var currentPlayerName = players[currentPlayerIndex].name;
		document.getElementById("quiz-current-player").textContent = currentPlayerName;
		document.getElementById("quiz-question").textContent = currentQuestion.q;

		// Fill option button texts and show only active buttons
		var optionButtons = document.querySelectorAll("#quiz-options .option-btn");
		for (var i = 0; i < optionButtons.length; i++) {
			if ( i < currentQuestion.options.length ) {
				optionButtons[i].style.display = "block";
				optionButtons[i].textContent = currentQuestion.options[i];
				optionButtons[i].disabled = false;
				optionButtons[i].style.background = "";
				optionButtons[i].style.borderColor = "";
			} else {
				optionButtons[i].style.display = "none";
			}
		}

		// Clear feedback text
		var feedbackEl = document.getElementById("quiz-feedback");
		feedbackEl.textContent = "";
		feedbackEl.className = "feedback";

		// Reset and start countdown timer
		quizTimeRemaining = 15;
		var timerValEl = document.getElementById("quiz-timer-value");
		if ( timerValEl ) {
			timerValEl.textContent = quizTimeRemaining;
		}

		// Show Modal
		document.getElementById("quiz-modal").classList.add("visible");

		quizTimerInterval = setInterval(function() {
			quizTimeRemaining--;
			if ( timerValEl ) {
				timerValEl.textContent = quizTimeRemaining;
			}

			if ( quizTimeRemaining <= 0 ) {
				clearInterval( quizTimerInterval );
				quizTimerInterval = null;
				handleQuizTimeout();
			}
		}, 1000);
	}

	// Handle option selection from index.html
	function selectOption( index ) {
		if ( !currentQuestion ) return;

		if ( quizTimerInterval ) {
			clearInterval( quizTimerInterval );
			quizTimerInterval = null;
		}

		var optionButtons = document.querySelectorAll("#quiz-options .option-btn");
		for (var i = 0; i < optionButtons.length; i++) {
			optionButtons[i].disabled = true;
		}

		var feedbackEl = document.getElementById("quiz-feedback");

		if ( index === currentQuestion.correct ) {
			feedbackEl.textContent = "Chính xác! 🎉 Hãy chọn 1 khối gỗ để bắn.";
			feedbackEl.className = "feedback correct";
			optionButtons[index].style.background = "rgba(74, 222, 128, 0.2)";
			optionButtons[index].style.borderColor = "#4ade80";

			// Highlight active shooting zone
			highlightActiveZone();

			setTimeout(function() {
				document.getElementById("quiz-modal").classList.remove("visible");
				if ( controls ) controls.enabled = true;

				hasAnsweredCorrectly = true; // allow shooting a block
			}, 1500);

		} else {
			feedbackEl.textContent = "Sai rồi! ❌ Lượt chuyển cho người tiếp theo.";
			feedbackEl.className = "feedback incorrect";
			optionButtons[index].style.background = "rgba(248, 113, 113, 0.2)";
			optionButtons[index].style.borderColor = "#f87171";
			
			var correctIndex = currentQuestion.correct;
			optionButtons[correctIndex].style.background = "rgba(74, 222, 128, 0.2)";
			optionButtons[correctIndex].style.borderColor = "#4ade80";

			setTimeout(function() {
				document.getElementById("quiz-modal").classList.remove("visible");
				if ( controls ) controls.enabled = true;
				
				clickedBlock = null;
				hitPoint = null;

				nextTurn();
			}, 2000);
		}
	}

	function initializePlayers( names ) {
		stopGame();

		// Populate players array
		players = names.map(function(name) {
			return { name: name, score: 0 };
		});
		currentPlayerIndex = 0;
		gameOver = false;
		isTurnActive = false;
		hasAnsweredCorrectly = false;
		isGameOverPending = false;
		activeZoneStart = -1;
		clickedBlock = null;
		hitPoint = null;
		lastShootingPlayerIndex = -1;
		lastClickedBlock = null;

		// Build Scoreboard DOM dynamically
		var scoreboardList = document.getElementById("scoreboard-list");
		if ( scoreboardList ) {
			scoreboardList.innerHTML = "";
			for (var i = 0; i < players.length; i++) {
				var pRow = document.createElement("div");
				pRow.className = "player-score";
				if ( i === 0 ) {
					pRow.className += " active";
				}
				pRow.id = "player-" + i;
				pRow.innerHTML = '<span class="player-name">' + players[i].name + '</span>' +
				                 '<span class="score-val" id="score-' + i + '">0</span>';
				scoreboardList.appendChild(pRow);
			}
		}

		resetTowerBlocks();
		showQuiz();
	}

	function resetTowerBlocks() {
		if ( hoveredBlock ) {
			resetBlockHighlight( hoveredBlock );
			hoveredBlock = null;
		}

		// Reset camera
		camera.position.set( 115, 75, 115 );
		camera.lookAt(new THREE.Vector3( 0, 35, 0 ));
		if (controls) {
			controls.enabled = true;
			controls.target.set( 0, 35, 0 );
		}

		// Reset each block's state in Physijs
		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];
			block.isRemoved = false;

			block.position.copy(block.initialPosition);
			block.rotation.copy(block.initialRotation);

			block.__dirtyPosition = true;
			block.__dirtyRotation = true;

			var zero = new THREE.Vector3(0, 0, 0);
			block.setLinearVelocity(zero);
			block.setAngularVelocity(zero);
			
			var ones = new THREE.Vector3(1, 1, 1);
			block.setLinearFactor(ones);
			block.setAngularFactor(ones);
		}

		resetAllBlockBorders();
	}

	function nextTurn() {
		currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

		// Update UI active player styling
		for (var i = 0; i < players.length; i++) {
			var playerRow = document.getElementById("player-" + i);
			if (playerRow) {
				if ( i === currentPlayerIndex ) {
					playerRow.classList.add("active");
				} else {
					playerRow.classList.remove("active");
				}
			}
		}

		hasAnsweredCorrectly = false;
		showQuiz();
	}

	function handleQuizTimeout() {
		var optionButtons = document.querySelectorAll("#quiz-options .option-btn");
		for (var i = 0; i < optionButtons.length; i++) {
			optionButtons[i].disabled = true;
		}

		// Highlight correct answer in green
		if ( currentQuestion ) {
			var correctIndex = currentQuestion.correct;
			if ( optionButtons[correctIndex] ) {
				optionButtons[correctIndex].style.background = "rgba(74, 222, 128, 0.2)";
				optionButtons[correctIndex].style.borderColor = "#4ade80";
			}
		}

		var feedbackEl = document.getElementById("quiz-feedback");
		if ( feedbackEl ) {
			feedbackEl.textContent = "Hết giờ! ⏰ Lượt chuyển cho người tiếp theo.";
			feedbackEl.className = "feedback incorrect";
		}

		setTimeout(function() {
			document.getElementById("quiz-modal").classList.remove("visible");
			if ( controls ) controls.enabled = true;
			
			clickedBlock = null;
			hitPoint = null;

			nextTurn();
		}, 2000);
	}

	function stopGame() {
		if ( quizTimerInterval ) {
			clearInterval( quizTimerInterval );
			quizTimerInterval = null;
		}
		if ( turnTimer ) {
			clearTimeout( turnTimer );
			turnTimer = null;
		}
		// Also hide modal just in case
		var quizModal = document.getElementById("quiz-modal");
		if ( quizModal ) {
			quizModal.classList.remove("visible");
		}
	}

	function endTurn() {
		if ( turnTimer ) {
			clearTimeout( turnTimer );
			turnTimer = null;
		}

		isTurnActive = false;
		clickedBlock = null;
		hitPoint = null;

		// Reset borders and active zone
		resetAllBlockBorders();
		activeZoneStart = -1;

		if ( !gameOver && !isGameOverPending ) {
			nextTurn();
		}
	}

	function updateScoreboardUI() {
		for (var i = 0; i < players.length; i++) {
			var scoreValEl = document.getElementById("score-" + i);
			if (scoreValEl) {
				scoreValEl.textContent = players[i].score;
			}
		}
	}

	function updateScoreAndStatus() {
		if (gameOver) return;

		var maxUnremovedHeight = 0;

		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];
			if (!block.isRemoved) {
				var distFromCenter = Math.sqrt(block.position.x * block.position.x + block.position.z * block.position.z);
				if (distFromCenter > 18 || block.position.y < 2) {
					block.isRemoved = true;

					if ( lastShootingPlayerIndex !== -1 ) {
						if ( block === lastClickedBlock ) {
							players[lastShootingPlayerIndex].score += 1;
						} else {
							players[lastShootingPlayerIndex].score -= 1;
							turnFallenBlocksCount++;
						}
						updateScoreboardUI();
					}

				} else {
					maxUnremovedHeight = Math.max(maxUnremovedHeight, block.position.y);
				}
			}
		}

		// Game over conditions
		if ( !gameOver && !isGameOverPending ) {
			if ( maxUnremovedHeight < 32 ) {
				isGameOverPending = true;
				// Cancel turn timer if active to freeze turns
				if ( turnTimer ) {
					clearTimeout( turnTimer );
					turnTimer = null;
				}
				setTimeout(function() {
					triggerGameOver("Tháp Jenga đã bị sập hoàn toàn!");
				}, 4000);
			} else if ( lastShootingPlayerIndex !== -1 && turnFallenBlocksCount >= 5 ) {
				isGameOverPending = true;
				if ( turnTimer ) {
					clearTimeout( turnTimer );
					turnTimer = null;
				}
				setTimeout(function() {
					triggerGameOver(players[lastShootingPlayerIndex].name + " đã làm đổ quá nhiều thanh gỗ (" + turnFallenBlocksCount + " thanh)!");
				}, 4000);
			}
		}
	}

	function triggerGameOver( reason ) {
		gameOver = true;
		
		document.getElementById("quiz-modal").classList.remove("visible");

		var gameOverPanel = document.getElementById('game-over-panel');
		if (gameOverPanel) {
			gameOverPanel.classList.add('visible');
		}

		var reasonEl = document.getElementById("game-over-reason");
		if (reasonEl) {
			reasonEl.textContent = reason || "Tháp Jenga đã bị đổ!";
		}

		// Calculate winner (highest score)
		var maxScore = -999;
		var winnerName = "";
		for (var i = 0; i < players.length; i++) {
			if (players[i].score > maxScore) {
				maxScore = players[i].score;
				winnerName = players[i].name;
			}
		}

		var winnerBanner = document.getElementById("winner-banner");
		if (winnerBanner) {
			winnerBanner.textContent = winnerName + " Thắng cuộc! 🏆 (" + maxScore + " điểm)";
		}

		// Populate final scoreboard
		var finalScoresList = document.getElementById("final-scores-list");
		if (finalScoresList) {
			finalScoresList.innerHTML = "";
			var sortedPlayers = [...players].sort((a, b) => b.score - a.score);
			for (var i = 0; i < sortedPlayers.length; i++) {
				var p = sortedPlayers[i];
				var row = document.createElement("div");
				row.className = "final-player-row";
				if (p.name === winnerName) {
					row.className += " winner-row";
				}
				row.innerHTML = "<span>" + p.name + "</span><span>" + p.score + " điểm</span>";
				finalScoresList.appendChild(row);
			}
		}
	}

	function restartGame() {
		stopGame();
		gameOver = false;
		
		currentPlayerIndex = 0;
		isTurnActive = false;
		hasAnsweredCorrectly = false;
		isGameOverPending = false;
		activeZoneStart = -1;
		clickedBlock = null;
		hitPoint = null;
		turnFallenBlocksCount = 0;
		currentQuestion = null;
		lastShootingPlayerIndex = -1;
		lastClickedBlock = null;
		if ( turnTimer ) {
			clearTimeout( turnTimer );
			turnTimer = null;
		}

		for (var i = 0; i < players.length; i++) {
			players[i].score = 0;
		}

		updateScoreboardUI();

		for (var i = 0; i < players.length; i++) {
			var playerRow = document.getElementById("player-" + i);
			if (playerRow) {
				if ( i === 0 ) {
					playerRow.classList.add("active");
				} else {
					playerRow.classList.remove("active");
				}
			}
		}

		document.getElementById('game-over-panel').classList.remove('visible');
		document.getElementById('quiz-modal').classList.remove('visible');

		resetTowerBlocks();
		showQuiz();
	}

	function render(){

		requestAnimationFrame(render);

		if (controls) controls.update();

		updateScoreAndStatus();

		scene.simulate();
		renderer.render(scene, camera);
	}

	window.onload = initScene;

	return {
		scene: scene,
		restartGame: restartGame,
		selectOption: selectOption,
		initializePlayers: initializePlayers,
		stopGame: stopGame
	}

})();
