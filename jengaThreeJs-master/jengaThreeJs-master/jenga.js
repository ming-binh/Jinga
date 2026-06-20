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
	score = 0,
	highScore = localStorage.getItem('jenga-highscore') ? parseInt(localStorage.getItem('jenga-highscore')) : 0,
	gameOver = false,
	hoveredBlock = null;

	function initScene(){

		scene.setGravity(new THREE.Vector3(0,-50,0));
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

	// Click handler: apply impulse force to knock block away
	function handleBlockClick( evt ) {
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
			var hitPoint = intersections[0].point;

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
			block.setLinearFactor( ones );
			block.setAngularFactor( ones );

			// Use setLinearVelocity to wake up and push the block
			var velocity = pushDir.clone().multiplyScalar( forceMagnitude * 0.15 );
			velocity.y = forceMagnitude * 0.05; // slight upward kick to make it fly nicely
			block.setLinearVelocity( velocity );

			// Also apply impulse for extra impact
			var impulse = pushDir.clone().multiplyScalar( forceMagnitude * 0.5 );
			block.applyCentralImpulse( impulse );
		}
	}

	// Hover handler: highlight blocks when mouse rolls over them
	function handleBlockHover( evt ) {
		if ( gameOver ) {
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
			document.body.style.cursor = 'default';
		}
	}

	function highlightBlock( block ) {
		if ( block && block.material ) {
			if ( !block.originalColor ) {
				block.originalColor = block.material.color.clone();
			}
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
			if ( block.originalColor ) {
				block.material.color.copy( block.originalColor );
			} else {
				block.material.color.setHex( 0xffe8d6 );
			}
			block.material.emissive.setHex( 0x000000 );
			
			if ( block.borderLine && block.borderLine.material ) {
				block.borderLine.material.color.setHex( 0x4d3222 ); // back to original dark brown border
			}
		}
	}

	function updateScoreAndStatus() {
		if (gameOver) return;

		var maxUnremovedHeight = 0;

		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];
			if (!block.isRemoved) {
				// Horizontal distance from center (0, 0)
				var distFromCenter = Math.sqrt(block.position.x * block.position.x + block.position.z * block.position.z);
				// If block falls below height 2 (on the table) or is pushed far away horizontally, it is considered removed
				if (distFromCenter > 18 || block.position.y < 2) {
					block.isRemoved = true;
					score++;
					
					// Update score UI
					var scoreDisplay = document.getElementById('score-value');
					if (scoreDisplay) scoreDisplay.textContent = score;

					if (score > highScore) {
						highScore = score;
						localStorage.setItem('jenga-highscore', highScore);
						var highScoreDisplay = document.getElementById('highscore-value');
						if (highScoreDisplay) highScoreDisplay.textContent = highScore;
					}
				} else {
					maxUnremovedHeight = Math.max(maxUnremovedHeight, block.position.y);
				}
			}
		}

		// Game over condition: if the max height of the unremoved tower blocks falls below 32 (approx half the initial height)
		if (maxUnremovedHeight < 32 && !gameOver) {
			triggerGameOver();
		}
	}

	function triggerGameOver() {
		gameOver = true;
		var gameOverPanel = document.getElementById('game-over-panel');
		if (gameOverPanel) {
			gameOverPanel.classList.add('visible');
		}
		var finalScoreElement = document.getElementById('final-score');
		if (finalScoreElement) {
			finalScoreElement.textContent = score;
		}
	}

	function restartGame() {
		gameOver = false;
		score = 0;

		var scoreDisplay = document.getElementById('score-value');
		if (scoreDisplay) scoreDisplay.textContent = score;

		var gameOverPanel = document.getElementById('game-over-panel');
		if (gameOverPanel) {
			gameOverPanel.classList.remove('visible');
		}

		if ( hoveredBlock ) {
			resetBlockHighlight( hoveredBlock );
			hoveredBlock = null;
		}

		// Reset camera
		camera.position.set( 115, 75, 115 );
		camera.lookAt(new THREE.Vector3( 0, 35, 0 ));
		if (controls) {
			controls.target.set( 0, 35, 0 );
		}

		// Reset each block's state in Physijs
		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];
			block.isRemoved = false;

			// Teleport mesh to starting values
			block.position.copy(block.initialPosition);
			block.rotation.copy(block.initialRotation);

			// Mark dirty position & rotation
			block.__dirtyPosition = true;
			block.__dirtyRotation = true;

			// Reset velocities
			var zero = new THREE.Vector3(0, 0, 0);
			block.setLinearVelocity(zero);
			block.setAngularVelocity(zero);
			
			// Reset linear/angular factor
			var ones = new THREE.Vector3(1, 1, 1);
			block.setLinearFactor(ones);
			block.setAngularFactor(ones);
		}
	}

	function render(){

		requestAnimationFrame(render);

		// Update camera controls
		if (controls) controls.update();

		// Update game logic (scoring & game over)
		updateScoreAndStatus();

		// Simulate physics and render scene
		scene.simulate();
		renderer.render(scene, camera);
	}

	window.onload = initScene;

	return {
		scene: scene,
		restartGame: restartGame
	}

})();
