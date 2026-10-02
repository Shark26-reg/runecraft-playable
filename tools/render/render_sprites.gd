extends SceneTree
## Рендер спрайтов плейбла из 3D-моделей основной игры (KayKit, Kenney).
##
## Запуск из папки основной игры RuneCraft Survivor (нужен обычный запуск с видеокартой, не --headless):
##   tools/godot/Godot_v4.7.2-stable_win64_console.exe --path game --script <путь>/render_sprites.gd -- --out=<папка>
##
## Камера ортогональная, с тем же наклоном, что в портретном режиме игры, свет — как в биоме «Лес».
## Результат: PNG-кадры и manifest.json. Дальше их собирает в атласы tools/pack_sprites.py.

const PITCH := 40.0        # наклон камеры в градусах (в игре 41° в альбомном режиме и 52° в портретном; при 52° у мага видна одна шляпа)
const SS := 2              # суперсэмплинг: рендер вдвое крупнее, уменьшение — в pack_sprites.py
const FEET_Y := 0.72       # где в кадре стоят ноги (доля высоты сверху)
const GROUND_TILE := 16.0  # сторона бесшовной плитки земли, единиц мира
const GROUND_K := 40       # пикселей на единицу мира у плитки земли

const N := "res://assets/nature/"

# Персонажи. k — пикселей на единицу мира в итоговом атласе, cam — сторона кадра в единицах мира,
# dirs — 8 направлений или 5 (западные зеркалятся с восточных).
# Анимация: n кадров на отрезке [t0, t1]; loop — циклическая; south — только взгляд на камеру.
var CHARACTERS := [
	{"id": "hero", "model": "res://assets/heroes/Mage.glb", "show": ["2H_Staff", "Mage_Hat", "Mage_Cape"], "weapons": {},
		"scale": 1.0, "k": 52, "cam": 4.2, "dirs": 5, "rim": Color("#b58cff", 0.35), "rim_power": 3.0,
		"anims": [
			{"name": "run", "anim": "Running_A", "n": 8, "t0": 0.0, "t1": 0.8, "loop": true},
			{"name": "idle", "anim": "Idle", "n": 4, "t0": 0.0, "t1": 1.07, "loop": true},
			{"name": "cheer", "anim": "Cheer", "n": 10, "t0": 0.0, "t1": 1.67, "loop": true, "south": true},
			{"name": "death", "anim": "Death_A", "n": 7, "t0": 0.0, "t1": 0.8, "loop": false, "south": true},
		]},
	{"id": "minion", "model": "res://assets/skeletons/Skeleton_Minion.glb", "show": [],
		"weapons": {"handslot_r": "res://assets/skeletons/Skeleton_Blade.gltf"},
		"scale": 0.9, "k": 52, "cam": 4.0, "dirs": 5,
		"anims": [
			{"name": "run", "anim": "Running_A", "n": 8, "t0": 0.0, "t1": 0.8, "loop": true},
			{"name": "attack", "anim": "1H_Melee_Attack_Chop", "n": 6, "t0": 0.1, "t1": 0.9, "loop": false},
			{"name": "death", "anim": "Death_C_Skeletons", "n": 6, "t0": 0.0, "t1": 1.3, "loop": false, "south": true},
		]},
	{"id": "rogue", "model": "res://assets/skeletons/Skeleton_Rogue.glb", "show": [],
		"weapons": {"handslot_r": "res://assets/skeletons/Skeleton_Blade.gltf"},
		"scale": 0.85, "k": 52, "cam": 4.0, "dirs": 5,
		"anims": [
			{"name": "run", "anim": "Running_A", "n": 8, "t0": 0.0, "t1": 0.8, "loop": true},
			{"name": "attack", "anim": "1H_Melee_Attack_Stab", "n": 6, "t0": 0.2, "t1": 1.2, "loop": false},
			{"name": "death", "anim": "Death_C_Skeletons", "n": 6, "t0": 0.0, "t1": 1.3, "loop": false, "south": true},
		]},
	{"id": "boss", "model": "res://assets/skeletons/Skeleton_Warrior.glb", "show": [],
		"weapons": {"handslot_r": "res://assets/skeletons/Skeleton_Axe.gltf", "handslot_l": "res://assets/skeletons/Skeleton_Shield_Large_A.gltf"},
		"scale": 2.3, "k": 30, "cam": 9.4, "dirs": 5, "rim": Color("#b06bff", 0.22), "rim_power": 3.0,
		"anims": [
			{"name": "walk", "anim": "Walking_A", "n": 6, "t0": 0.0, "t1": 1.07, "loop": true},
			{"name": "attack", "anim": "2H_Melee_Attack_Chop", "n": 6, "t0": 0.1, "t1": 1.35, "loop": false},
			{"name": "taunt", "anim": "Taunt", "n": 6, "t0": 0.0, "t1": 1.03, "loop": false, "south": true},
			{"name": "death", "anim": "Death_C_Skeletons", "n": 8, "t0": 0.0, "t1": 1.6, "loop": false, "south": true},
		]},
]

# Декор и препятствия леса: [id, модель, масштаб, поворот, перекраска или ""]. Масштабы — середина диапазонов из arena.gd.
var DECOR := [
	["tree_oak", N + "tree_oak.glb", 4.8, 20.0, ""], ["tree_default", N + "tree_default.glb", 4.6, 70.0, ""],
	["tree_pine", N + "tree_pineTallA_detailed.glb", 5.0, 10.0, ""], ["tree_fat", N + "tree_fat.glb", 4.7, 40.0, ""],
	["tree_oak_dark", N + "tree_oak_dark.glb", 4.8, 110.0, ""], ["tree_pine_round", N + "tree_pineRoundC.glb", 4.7, 30.0, ""],
	["bush_large", N + "plant_bushLarge.glb", 4.5, 0.0, "#3f7433"],
	["stone_large", N + "stone_largeA.glb", 4.3, 30.0, ""], ["stone_tall", N + "stone_tallA.glb", 3.7, 15.0, ""],
	["obelisk", N + "statue_obelisk.glb", 3.6, 25.0, ""], ["log", N + "log_large.glb", 3.6, 60.0, "#6e4b2f"],
	["grass_large", N + "grass_large.glb", 3.5, 0.0, "#5c9443"], ["grass", N + "grass.glb", 3.5, 45.0, "#679e4a"],
	["grass_leafs", N + "grass_leafsLarge.glb", 3.5, 30.0, "#4f8a3c"],
	["flower_red", N + "flower_redA.glb", 3.4, 0.0, ""], ["flower_yellow", N + "flower_yellowB.glb", 3.4, 40.0, ""],
	["flower_purple", N + "flower_purpleA.glb", 3.4, 80.0, ""], ["mushrooms", N + "mushroom_redGroup.glb", 3.5, 20.0, ""],
	["bush", N + "plant_bush.glb", 4.0, 0.0, "#467d38"], ["stone_small", N + "stone_smallA.glb", 3.5, 50.0, ""],
	["stump", N + "stump_round.glb", 3.8, 0.0, "#6e4b2f"],
]
const DECOR_K := 40

const PALETTE := {"leafsGreen": "#4f9a3a", "leafsDark": "#2f6d36", "grass": "#5c9443", "woodBark": "#7a5236",
	"woodBarkDark": "#5a3b28", "woodInner": "#c9a27a", "stone": "#9aa3a6", "stoneDark": "#6f777b"}

const GROUND_SHADER := """
shader_type spatial;
render_mode specular_disabled;
uniform sampler2D noise_a : repeat_enable, filter_linear_mipmap;
uniform sampler2D noise_b : repeat_enable, filter_linear_mipmap;
uniform vec3 col_a : source_color;
uniform vec3 col_b : source_color;
uniform vec3 col_c : source_color;
uniform float tile = 16.0;
varying vec3 wpos;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	// Та же формула, что у земли арены в игре, но все шумы периодичны с шагом tile — плитка бесшовная.
	vec2 p = wpos.xz / tile;
	float n1 = texture(noise_a, p).r;
	float n2 = texture(noise_b, p).r;
	float n3 = texture(noise_b, p * 5.0 + 0.37).r;
	vec3 c = mix(col_a, col_b, smoothstep(0.35, 0.75, n1 + (n2 - 0.5) * 0.45));
	c = mix(c, col_c, smoothstep(0.68, 0.8, n2) * 0.6);
	c *= 0.92 + n3 * 0.16;
	ALBEDO = c;
	ROUGHNESS = 0.95;
}
"""

var out_dir := ""
var vp: SubViewport
var cam: Camera3D
var stage: Node3D
var manifest := {"pitch": PITCH, "ss": SS, "feet_y": FEET_Y, "characters": {}, "decor": {}, "ground": {}}


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
	if out_dir == "":
		push_error("Нужен аргумент --out=<папка>")
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(out_dir)
	root.size = Vector2i(320, 240)
	_run.call_deferred()


func _run() -> void:
	_build_stage()
	for c in CHARACTERS:
		await _render_character(c)
	for d in DECOR:
		await _render_decor(d)
	await _render_ground()
	var f := FileAccess.open(out_dir.path_join("manifest.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(manifest, "\t"))
	f.close()
	print("Готово: ", out_dir)
	quit()


func _build_stage() -> void:
	vp = SubViewport.new()
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_8X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	var e := Environment.new()
	# Свет и цветокоррекция как у биома «Лес» в arena.gd (без тумана и свечения — они ломают прозрачность).
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color("#6f8fb0")
	e.ambient_light_energy = 0.75
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	e.adjustment_enabled = true
	e.adjustment_saturation = 1.08
	e.adjustment_contrast = 1.06
	var we := WorldEnvironment.new()
	we.environment = e
	vp.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -38, 0)
	sun.light_color = Color("#fff0d6")
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	sun.shadow_blur = 1.5
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 80.0
	vp.add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-30, 150, 0)
	fill.light_color = Color("#7aa8ff")
	fill.light_energy = 0.35
	vp.add_child(fill)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.near = 0.05
	cam.far = 120.0
	vp.add_child(cam)
	cam.current = true
	stage = Node3D.new()
	vp.add_child(stage)


## Камера под наклоном PITCH; ноги (начало координат) — на FEET_Y высоты кадра.
func _aim(size_world: float, k: int) -> void:
	vp.size = Vector2i.ONE * int(round(size_world * k * SS))
	cam.size = size_world
	var p := deg_to_rad(PITCH)
	cam.rotation_degrees = Vector3(-PITCH, 0, 0)
	cam.position = Vector3(0, sin(p), cos(p)) * 40.0
	cam.h_offset = 0.0
	cam.v_offset = (FEET_Y - 0.5) * size_world


func _capture(path: String) -> void:
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	vp.get_texture().get_image().save_png(out_dir.path_join(path))


func _clear_stage() -> void:
	for ch in stage.get_children():
		ch.free()


func _render_character(c: Dictionary) -> void:
	_clear_stage()
	_aim(c.cam, c.k)
	var m := CharacterModel.new()
	stage.add_child(m)
	m.setup(c.model, c.show, c.weapons, false, "Idle")
	m.scale = Vector3.ONE * c.scale
	if c.has("rim"):
		m.set_rim(c.rim, c.rim_power)
	m.anim.speed_scale = 0.0
	var dirs: Array = range(8) if c.dirs == 8 else range(5)
	var info := {"k": c.k, "cam": c.cam, "px": vp.size.x, "dirs": c.dirs, "scale": c.scale, "anims": {}, "frames": []}
	for a in c.anims:
		var south: bool = a.get("south", false)
		var adirs: Array = [0] if south else dirs
		var n: int = a.n
		info.anims[a.name] = {"n": n, "loop": a.loop, "south": south, "len": a.t1 - a.t0, "first": info.frames.size()}
		for d in adirs:
			m.rotation.y = deg_to_rad(45.0 * d)
			for i in n:
				var t: float = a.t0 + (a.t1 - a.t0) * (float(i) / n if a.loop else float(i) / maxf(1.0, n - 1))
				m.anim.play(a.anim, 0.0)
				m.anim.seek(t, true)
				var file := "%s_%s_%d_%d.png" % [c.id, a.name, d, i]
				await _capture(file)
				info.frames.append(file)
	manifest.characters[c.id] = info
	print("  ", c.id, ": ", info.frames.size(), " кадров")


func _render_decor(d: Array) -> void:
	_clear_stage()
	var src: Node3D = (load(d[1]) as PackedScene).instantiate()
	_recolor(src, d[4])
	src.scale = Vector3.ONE * float(d[2])
	src.rotation_degrees.y = float(d[3])
	stage.add_child(src)
	# Размер кадра — по габаритам модели с запасом (деревья высокие, трава маленькая).
	var aabb := _aabb(src)
	var extent := maxf(maxf(aabb.size.x, aabb.size.z) * 1.15, aabb.size.y * 1.1) + 0.6
	_aim(extent * 1.25, DECOR_K)
	var file := "decor_%s.png" % d[0]
	await _capture(file)
	manifest.decor[d[0]] = {"file": file, "k": DECOR_K, "cam": cam.size, "px": vp.size.x,
		"height": aabb.size.y, "radius": maxf(aabb.size.x, aabb.size.z) * 0.5}


func _render_ground() -> void:
	_clear_stage()
	var mat := ShaderMaterial.new()
	mat.shader = Shader.new()
	mat.shader.code = GROUND_SHADER
	var na := _noise_tex(11, 0.003)
	var nb := _noise_tex(37, 0.02)
	mat.set_shader_parameter("noise_a", na)
	mat.set_shader_parameter("noise_b", nb)
	mat.set_shader_parameter("col_a", Color("#355f2c"))
	mat.set_shader_parameter("col_b", Color("#4a7a34"))
	mat.set_shader_parameter("col_c", Color("#5b4a33"))
	mat.set_shader_parameter("tile", GROUND_TILE)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(GROUND_TILE * 3.0, GROUND_TILE * 3.0)
	mi.mesh = pm
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	stage.add_child(mi)
	# Сверху, ровно на одну плитку: свет у земли матовый, от угла камеры не зависит.
	vp.size = Vector2i.ONE * int(GROUND_TILE * GROUND_K)
	cam.size = GROUND_TILE
	cam.rotation_degrees = Vector3(-90, 0, 0)
	cam.position = Vector3(0, 30, 0)
	cam.v_offset = 0.0
	var msaa := vp.msaa_3d
	vp.msaa_3d = Viewport.MSAA_DISABLED
	# Шумовые текстуры генерируются в фоновом потоке — ждём, пока будут готовы.
	for i in 300:
		if na.get_image() != null and nb.get_image() != null:
			break
		await process_frame
	for i in 5:
		await process_frame
	await _capture("ground.png")
	vp.msaa_3d = msaa
	manifest.ground = {"file": "ground.png", "tile": GROUND_TILE, "k": GROUND_K}


func _noise_tex(seed_: int, freq: float) -> NoiseTexture2D:
	var n := FastNoiseLite.new()
	n.seed = seed_
	n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n.frequency = freq
	n.fractal_octaves = 4
	var t := NoiseTexture2D.new()
	t.width = 512
	t.height = 512
	t.seamless = true
	t.noise = n
	return t


func _recolor(root_: Node, tint: String) -> void:
	for mi in root_.find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = (mi as MeshInstance3D).mesh
		if mesh == null:
			continue
		if tint != "":
			var tm := StandardMaterial3D.new()
			tm.albedo_color = Color(tint)
			tm.roughness = 0.95
			(mi as MeshInstance3D).material_override = tm
			continue
		for i in mesh.get_surface_count():
			var m := mesh.surface_get_material(i)
			if m is StandardMaterial3D and PALETTE.has(m.resource_name):
				var dup := (m as StandardMaterial3D).duplicate() as StandardMaterial3D
				dup.albedo_color = Color(PALETTE[m.resource_name])
				(mi as MeshInstance3D).set_surface_override_material(i, dup)


func _aabb(n: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var g := (mi as MeshInstance3D)
		var b: AABB = g.global_transform * g.get_aabb()
		if first:
			box = b
			first = false
		else:
			box = box.merge(b)
	return box
