window.addEventListener('DOMContentLoaded', function () {
	let socket;
	const TYPE = {
		MSG_SEND_CONNECTED: 0,
		MSG_SEND_DISCONNECTED: 1,
		MSG_SEND_GUILD_CHANGE: 2,
		SPLITTER: "-->",
		MSG_REC_ONLINE_USERS: 4,
		MSG_REC_TARGET_POSITION: 5,
		MSG_REC_GRID_SIZE: 6,
		MSG_REC_USER_CHAT: 8,
		MSG_REC_CREATE_USERS: 9,
		MSG_REC_ALL_GUILDS: 10,
	}
	Object.freeze(TYPE);

	const GROUNDTYPE = {
		NOTHING: 0,
		GROUND: 1,
		WATER: 2,
		TREE: 3,
	}
	Object.freeze(GROUNDTYPE);

	let ONLINEUSERS = 0;
	let GRIDSIZE = 0;
	let GRID = [];
	let GUILDS = [];
	let BOXES = [];
	let MESHES = [];
	let GROUNDS = [];
	let WATER = [];

	const canvas = document.getElementById('renderCanvas');
	const engine = new BABYLON.Engine(canvas, true);

	const createScene = function () {
		const scene = new BABYLON.Scene(engine);
		scene.clearColor = new BABYLON.Color3(0, 0, 0);

		const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
		camera.setTarget(BABYLON.Vector3.Zero());
		camera.attachControl(canvas, true);

		const light = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(-1, -3, -3), scene);
		light.intensity = 0.7;
		light.position = new BABYLON.Vector3(20, 150, 70);

		const slimeManager = new BABYLON.SpriteManager("slimeManager", "Assets/Slime.png", 2000, { width: 32, height: 32 }, scene);
		slimeManager.isPickable = true;
		const shadowGenerator = new BABYLON.ShadowGenerator(1024, light);

		const earthMesh = new BABYLON.MeshBuilder.CreateGround("ground", { width: 1, height: 1 }, scene);
		earthMesh.receiveShadows = true;
		const earthMat = new BABYLON.StandardMaterial("earthMat", scene);
		earthMat.diffuseTexture = new BABYLON.Texture("assets/ground.png");
		earthMesh.isVisible = false;
		earthMat.freeze();
		earthMesh.material = earthMat;
		earthMesh.doNotSyncBoundingInfo = true;

		const sandMesh = new BABYLON.MeshBuilder.CreateGround("sand", { width: 1, height: 1 }, scene);
		sandMesh.receiveShadows = true;
		const sandMat = new BABYLON.StandardMaterial("sandMat", scene);
		sandMat.diffuseTexture = new BABYLON.Texture("assets/sand.jpg");
		sandMesh.isVisible = false;
		//sandMat.freeze();
		sandMesh.material = sandMat;
		sandMesh.doNotSyncBoundingInfo = true;

		const waterMesh = new BABYLON.Mesh.CreateGround("waterMesh", 1, 1, 32, scene, false);
		const waterMaterial = createWaterMat(true, -10, 0.001, 0.1, 0.1, 50, 0);
		waterMesh.isVisible = false;
		waterMaterial.freeze();
		waterMesh.material = waterMaterial;
		waterMesh.doNotSyncBoundingInfo = true;

		const treeMeshes = [];

		Promise.all([
			BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "tree.obj", scene).then(function (result) {
				result.meshes.forEach((element, index) => {
					element.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
					element.isVisible = false;
					treeMeshes.push(element);
				});
			})
		]).then(() => {
			socket = new WebSocket('ws://127.0.0.1:80');
			//const socket = new WebSocket('wss://link.com');

			socket.addEventListener('open', function (event) {
				console.log("connected succesfully");
				closeLoader();
				showContent();
				socket.send(TYPE.MSG_SEND_CONNECTED);
			});

			socket.addEventListener('close', function (event) {
				console.log("disconnected...");
				showError("connection has been closed");
			});
			socket.addEventListener('error', function (event) {
				console.log("an error has occured!");
				showError("an error has occured while trying to connect to the server");
			});

			socket.addEventListener('message', function (event) {
				const type = parseInt(extractType(event.data, TYPE.SPLITTER));
				const data = extractValue(event.data, TYPE.SPLITTER);
				switch (type) {
					case TYPE.MSG_REC_ONLINE_USERS: {
						//console.log(" TYPE.MSG_REC_ONLINE_USERS");
						ONLINEUSERS = data;
						const count = document.getElementById("userCount");
						count.innerHTML = "";
						count.appendChild(document.createTextNode(ONLINEUSERS));
					}
						break;
					case TYPE.MSG_REC_TARGET_POSITION: {
						//console.log(" TYPE.MSG_REC_TARGET_POSITION");
						const select = document.getElementById("dropdown");
						const user = GUILDS.find((guild) => { return guild.id === select.value });
						if (user) {
							const box = BOXES.find((element) => {
								return element.id === data.id;
							});
							if (box) {
								setTargetPosition(box, data.position.x, data.position.z, GRID);
								box.playAnimationJump();
							}
						}
					}
						break;
					case TYPE.MSG_REC_GRID_SIZE: {
						//console.log(" TYPE.MSG_REC_GRID_SIZE");
						GRID = data;
						GRIDSIZE = GRID.length;
					}
						break;
					case TYPE.MSG_REC_USER_CHAT:
						//console.log(" TYPE.MSG_REC_USER_CHAT");
						setChatMessage(data);
						break;
					case TYPE.MSG_REC_CREATE_USERS: {
						//console.log(" TYPE.MSG_REC_CREATE_USERS");
						box.dispose();
						createGrid();
						createUsers();
					}
						break;
					case TYPE.MSG_REC_ALL_GUILDS: {
						//console.log("TYPE.MSG_REC_ALL_GUILDS");
						const select = document.getElementById("dropdown");
						GUILDS.length = 0;
						let allOptions = [];
						for (const option of select) {
							allOptions.push(option.value);
						}
						data.forEach((element, index) => {
							GUILDS.push(element);
							if (!allOptions.find((optionID) => { return element.id === optionID })) {
								const option = document.createElement("option");
								option.value = element.id;
								option.text = element.name;
								select.appendChild(option);
								allOptions.push(option.value);
							}
						});
						for (const option of select) {
							if (!GUILDS.find((guild) => { return guild.id === option.value }))
								select.remove(option);
						}
						if (!select.value || !GUILDS.find((guild) => { return guild.id === select.value })) {
							select.value = GUILDS[0].id;
							select.dispatchEvent(new Event('change'));
						} else {
							if (GRID.length > 1) {
								oldBoxes = BOXES;
								BOXES.forEach((box, index) => {
									if (box)
										box.dispose();
								});
								BOXES = [];
								createUsers(oldBoxes);
							}
						}
					}
						break;
					default: console.log("type not found", event.data);
				}
			});
		})

		const box = BABYLON.MeshBuilder.CreateBox("", { height: 0.8, width: 0.8, depth: 0.8, updatable: true, sideOrientation: BABYLON.Mesh.DOUBLESIDE });
		box.position.y = 0.5;

		const select = document.getElementById("dropdown");
		select.addEventListener("change", function () {
			const guild = GUILDS.find((guild) => { return guild.id === select.value });
			socket.send(TYPE.MSG_SEND_GUILD_CHANGE + TYPE.SPLITTER + JSON.stringify(guild.id));
			cleanUp();
			GRID = guild.grid;
			createGrid();
			createUsers();
		});

		function cleanUp() {
			GRID.forEach((col, cIndex) => {
				col.forEach((row, rIndex) => {
					if (row)
						row.dispose();
				});
			});
			GRID = [];

			BOXES.forEach((box, index) => {
				if (box)
					box.dispose();
			});
			BOXES = [];

			MESHES.forEach((mesh, index) => {
				if (mesh)
					mesh.dispose();
			});
			MESHES = [];

			GROUNDS.forEach((ground, index) => {
				if (ground)
					ground.dispose();
			});
			GROUNDS = [];

			WATER.forEach((water, index) => {
				if (water)
					water.dispose();
			});
			WATER = [];
		}

		function createGrid() {
			GRID.forEach((col, cIndex) => {
				col.forEach((row, rIndex) => {
					switch (GRID[cIndex][rIndex]) {
						case GROUNDTYPE.NOTHING: { }
							break;
						case GROUNDTYPE.WATER: {
							const g = createGround(sandMesh, cIndex, rIndex, GRIDSIZE);
							const wm = createWaterMesh(waterMesh, cIndex, rIndex, GRIDSIZE, scene);
							GRID[cIndex][rIndex] = wm;
							g.freezeWorldMatrix();
							wm.freezeWorldMatrix();
						}
							break;
						case GROUNDTYPE.GROUND: {
							const g = createGround(earthMesh, cIndex, rIndex, GRIDSIZE);
							GRID[cIndex][rIndex] = g;
							g.freezeWorldMatrix();

						}
							break;
						case GROUNDTYPE.TREE: {
							const g = createGround(earthMesh, cIndex, rIndex, GRIDSIZE);
							GRID[cIndex][rIndex] = g;
							g.freezeWorldMatrix();
							treeMeshes.forEach((element, index) => {
								const instance = element.createInstance(index);
								instance.position = GRID[cIndex][rIndex].position;
								MESHES.push(instance);
								instance.freezeWorldMatrix();
								shadowGenerator.getShadowMap().renderList.push(instance);
							});
						}
							break;
						default: console.log("color not found", GRID[cIndex][rIndex]);
					}
				});
			});

			GROUNDS.forEach((ground) => {
				WATER.forEach((water) => {
					water.material.addToRenderList(ground);
				})
			})
		}

		function createWaterMesh(mesh, cIndex, rIndex, gridsize) {
			const waterMesh = mesh.createInstance();
			waterMesh.position.copyFromFloats(cIndex - gridsize / 2, 0, rIndex - gridsize / 2);
			WATER.push(waterMesh);
			return waterMesh;
		}

		function createWaterMat(culling, windForce, waveHeight, bumpHeight, waveLength, waveSpeed, colorBlend) {
			const water = new BABYLON.WaterMaterial("waterMaterial", scene, new BABYLON.Vector2(1024, 1024));
			water.backFaceCulling = culling;
			water.bumpTexture = new BABYLON.Texture("assets/waterbump.png", scene);
			water.windForce = windForce;
			water.waveHeight = waveHeight;
			water.bumpHeight = bumpHeight;
			water.waveLength = waveLength;
			water.waveSpeed = waveSpeed;
			water.windDirection = new BABYLON.Vector2(1, 1);
			water.colorBlendFactor = colorBlend;
			return water;
		}

		function createGround(mesh, cIndex, rIndex, gridsize) {
			const ground = mesh.createInstance();
			ground.position.copyFromFloats(cIndex - gridsize / 2, 0, rIndex - gridsize / 2);
			GROUNDS.push(ground);
			return ground;
		}

		scene.registerBeforeRender(function () {
			BOXES.forEach((element) => {
				if (isNaN(element.position.x) || isNaN(element.position.z)) {
					element.position = element.targetPosition;
				}
				if (element.position !== element.targetPosition) {
					moveUser(element, engine);
				}
			});
		});

		function createUsers(oldBoxes = []) {
			const select = document.getElementById("dropdown");
			const info = document.getElementById("userInfo");
			GUILDS.find((guild) => {
				return guild.id === select.value;
			}).onlineUsers.forEach((element, index) => {
				const box = new BABYLON.Sprite("user", slimeManager);
				box.playAnimationIdle = function () {
					this.playAnimation(0, 4, true, 100);
				}
				box.playAnimationJump = function () {
					this.playAnimation(12, 18, false, 100, () => { this.playAnimationIdle() });
				}
				box.playAnimationIdle();

				box.name = element.name;
				box.id = element.id;
				box.avatar = element.avatar;
				box.status = element.status;
				box.clientStatus = element.clientStatus;
				box.position.y = 0.5;
				const oldBox = oldBoxes.find((oldBox) => { return oldBox.id === element.id; })
				if (oldBox) {
					box.position.x = oldBox.position.x;
					box.position.z = oldBox.position.z;
				} else {
					box.position.x = GRID[element.position.x][element.position.z].position.x;
					box.position.z = GRID[element.position.x][element.position.z].position.z;
				}
				box.targetPosition = new BABYLON.Vector3(box.position.x, box.position.y, box.position.z);

				box.isPickable = true;
				box.actionManager = new BABYLON.ActionManager(scene);
				box.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, function (obj) {
					info.innerHTML = "";
					const img = document.createElement("IMG");
					img.setAttribute("src", obj.source.avatar);
					img.setAttribute("width", "40");
					img.setAttribute("height", "40");
					img.setAttribute("alt", "User Avatar");
					[
						img,
						document.createTextNode(`Name: ${obj.source.name}`),
						document.createElement("br"),
						document.createTextNode(`Status: ${obj.source.status}`),
					].forEach((element) => {
						info.appendChild(element);
					});

					info.style.visibility = "visible";
				}));
				box.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, function () {
					info.innerHTML = "";
					info.style.left = 0 + "px";
					info.style.top = 0 + "px";
					info.style.visibility = "hidden";
				}));
				BOXES.push(box);
			});

		}

		return scene;

	};

	const scene = createScene();

	engine.runRenderLoop(function () {
		scene.render();
	});

	window.addEventListener('resize', function () {
		engine.resize();
	});

	const info = document.getElementById("userInfo");
	document.addEventListener('mousemove', function (e) {
		if (info.style.visibility !== "visible") return;
		const x = e.clientX;
		const y = e.clientY;
		info.style.left = x - (info.clientWidth / 2) + "px";
		info.style.top = y - info.clientHeight - 10 + "px";
	});

});

function setTargetPosition(user, targetX, targetZ, grid) {
	const target = new BABYLON.Vector3(grid[targetX][targetZ].position.x, 0.5, grid[targetX][targetZ].position.z);

	user.targetPosition = target;
}

function moveUser(user, engine) {
	moveTowards(user, 1 * engine.getDeltaTime());
	if (new BABYLON.Vector3.Distance(user.position, user.targetPosition) < 0.2) {
		user.position = user.targetPosition;
	}
}

function moveTowards(user, step) {
	xDiff = (user.targetPosition.x - user.position.x);
	zDiff = (user.targetPosition.z - user.position.z);
	user.position.x += xDiff / step;
	user.position.z += zDiff / step;
}

function randomNumBetween(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

function extractType(string, splitter) {
	return string.split(splitter)[0];
}

function extractValue(string, splitter) {
	if (!string.split(splitter)[1]) {
		return undefined;
	}
	return JSON.parse(string.split(splitter)[1]);
}

function showError(error) {
	const herokuContainer = document.getElementById("herokuContainer");
	herokuContainer.style.visibility = "visible";
	herokuContainer.style.display = "inline-block";

	const herokuError = document.getElementById("herokuError");
	herokuError.style.visibility = "visible";
	herokuError.style.display = "inline-block";

	const herokuConnecting = document.getElementById("herokuConnecting");
	herokuConnecting.style.visibility = "hidden";
	herokuConnecting.style.display = "none";

	const herokuLoader = document.getElementById("herokuLoader");
	herokuLoader.style.visibility = "hidden";
	herokuLoader.style.display = "none";

	const errorDiv = document.createElement("div");
	errorDiv.setAttribute("class", "errorDiv");
	errorDiv.appendChild(document.createTextNode(error));
	herokuError.appendChild(errorDiv);
}

function closeLoader() {
	const element = document.getElementById("herokuContainer");
	element.style.visibility = "hidden";
	element.style.display = "none";
}

function showContent() {
	const option = document.getElementById("renderCanvas");
	option.style.visibility = "visible";
	option.style.display = "inline-block";

	const container = document.getElementById("UIContainer");
	container.style.visibility = "visible";
}