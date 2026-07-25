// 3D-Viewer fuer den Nebula Bass mit Dual-Color-Fresnel-Shader am Korpus.
// Laedt das GLB per three.js, richtet Beleuchtung/Steuerung ein und stellt
// window.BassViewer bereit, ueber das der Konfigurator (configurator.js) die
// Farben setzt.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const mount = document.getElementById("bassViewer");
if (mount) init(mount);

function init(mount) {
    const modelUrl = mount.dataset.model;
    const loadingEl = mount.querySelector("[data-viewer-loading]");

    // --- Renderer -----------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 5000);

    // --- Umgebung (weiche Studio-Reflexionen wie bei model-viewer) ----------
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Zusaetzliches Licht fuer etwas mehr Plastizitaet
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-4, 1, -3);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    // --- Steuerung ----------------------------------------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = false;
    controls.rotateSpeed = 0.9;
    // Leichter zoombar und verschiebbar, um den Korpus in den Fokus zu ruecken
    controls.enableZoom = true;
    controls.zoomSpeed = 1.5;
    controls.enablePan = true;
    controls.screenSpacePanning = true; // Verschieben in der Bildebene (intuitiver)
    controls.panSpeed = 0.8;

    // --- Zustand ------------------------------------------------------------
    const bodyColors = { a: "#e21d93", b: "#1c4fd6" }; // Farbe 1 / Farbe 2 (Silk Blue Magenta)
    const bodyUniforms = [];   // Referenzen auf alle Shader-Uniforms der Korpus-Materialien
    // Raeumlicher Verlauf ueber das Modell: entlang der Achse uMask, von uMin bis uMax.
    // Wird nach dem Laden aus der Bounding-Box gesetzt (laengste Achse).
    const gradient = { mask: new THREE.Vector3(1, 0, 0), min: -1, max: 1 };
    let hardwareMats = [];
    let neckMats = [];
    const bodyMeshes = []; // Meshes des Korpus (fuer die Verlaufs-Bounding-Box)

    // --- Dual-Color-Shader auf ein Material legen ---------------------------
    // Der Korpus bekommt einen echten Orts-Verlauf ueber das Bauteil (eine Seite
    // Farbe 1, andere Seite Farbe 2) plus einen leichten Blickwinkel-Schimmer,
    // damit es wie Silk-Filament wirkt.
    function makeDualColor(material) {
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uColA = { value: new THREE.Color(bodyColors.a) };
            shader.uniforms.uColB = { value: new THREE.Color(bodyColors.b) };
            shader.uniforms.uGradMask = { value: gradient.mask.clone() };
            shader.uniforms.uGradMin = { value: gradient.min };
            shader.uniforms.uGradMax = { value: gradient.max };
            // Silk-Effekt: view-abhaengige Farbverschiebung.
            // uSilkMix   = Anteil Silk-Shift vs. Orts-Verlauf
            // uSilkScale = Kontrast der Verschiebung ueber die Flaechenneigung
            // uEdge      = zusaetzlicher Fresnel-/Kantenglanz
            shader.uniforms.uSilkMix = { value: 0.55 };
            shader.uniforms.uSilkScale = { value: 1.4 };
            shader.uniforms.uEdge = { value: 0.25 };

            shader.vertexShader = shader.vertexShader
                .replace(
                    "#include <common>",
                    "#include <common>\nvarying vec3 vDcNormal;\nvarying vec3 vDcView;\nvarying vec3 vDcWorld;"
                )
                .replace(
                    "#include <begin_vertex>",
                    "#include <begin_vertex>\n" +
                    "vec4 dcMV = modelViewMatrix * vec4( transformed, 1.0 );\n" +
                    "vDcView = -dcMV.xyz;\n" +
                    "vDcNormal = normalize( normalMatrix * objectNormal );\n" +
                    "vDcWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;"
                );

            shader.fragmentShader = shader.fragmentShader
                .replace(
                    "#include <common>",
                    "#include <common>\n" +
                    "uniform vec3 uColA;\nuniform vec3 uColB;\n" +
                    "uniform vec3 uGradMask;\nuniform float uGradMin;\nuniform float uGradMax;\n" +
                    "uniform float uSilkMix;\nuniform float uSilkScale;\nuniform float uEdge;\n" +
                    "varying vec3 vDcNormal;\nvarying vec3 vDcView;\nvarying vec3 vDcWorld;"
                )
                .replace(
                    "#include <color_fragment>",
                    "#include <color_fragment>\n" +
                    "{\n" +
                    "  vec3 V = normalize( vDcView );\n" +
                    "  vec3 nV = normalize( vDcNormal );\n" +
                    "  // Basis: Orts-Verlauf ueber den Korpus (garantiert beide Farben)\n" +
                    "  float g = dot( vDcWorld, normalize( uGradMask ) );\n" +
                    "  float baseT = clamp( ( g - uGradMin ) / max( uGradMax - uGradMin, 0.0001 ), 0.0, 1.0 );\n" +
                    "  // Silk: Farbverschiebung entlang der Flaechenneigung im Blickraum;\n" +
                    "  // verschiebt sich weich beim Drehen, ohne harte Kanten.\n" +
                    "  float silkT = clamp( ( nV.x + 0.35 * nV.y ) * uSilkScale + 0.5, 0.0, 1.0 );\n" +
                    "  // Fresnel-Glanz an den Kanten\n" +
                    "  float fres = pow( 1.0 - clamp( dot( nV, V ), 0.0, 1.0 ), 2.0 );\n" +
                    "  float t = mix( baseT, silkT, uSilkMix );\n" +
                    "  t = clamp( t + ( fres - 0.5 ) * uEdge, 0.0, 1.0 );\n" +
                    "  diffuseColor.rgb = mix( uColA, uColB, t );\n" +
                    "}"
                );

            bodyUniforms.push({
                a: shader.uniforms.uColA,
                b: shader.uniforms.uColB,
                mask: shader.uniforms.uGradMask,
                min: shader.uniforms.uGradMin,
                max: shader.uniforms.uGradMax
            });
        };
        // Eigener Cache-Key, damit three.js dieses Shader-Programm nicht mit
        // einem gleich aufgebauten Material ohne Shader-Injektion verwechselt.
        material.customProgramCacheKey = () => "dualcolor-gradient";
        // Etwas glaenzender Lack-Look
        material.metalness = 0.0;
        material.roughness = 0.35;
        material.needsUpdate = true;
    }

    // Verlaufs-Achse festlegen (aus Bounding-Box) und an alle Korpus-Shader
    // weitergeben. axis kann fest vorgegeben werden ("x"/"y"/"z"); ohne Angabe
    // wird die laengste Ausdehnung genommen.
    function setGradientFromBox(box, axis) {
        if (!axis) {
            const size = box.getSize(new THREE.Vector3());
            axis = "x";
            let m = size.x;
            if (size.y > m) { axis = "y"; m = size.y; }
            if (size.z > m) { axis = "z"; m = size.z; }
        }
        gradient.mask.set(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
        gradient.min = box.min[axis];
        gradient.max = box.max[axis];
        bodyUniforms.forEach((u) => {
            u.mask.value.copy(gradient.mask);
            u.min.value = gradient.min;
            u.max.value = gradient.max;
        });
    }

    // Erkennung der Bauteile anhand der Material-Eigenschaften (unabhaengig von
    // der Reihenfolge im GLB):
    //   Korpus  = knallmagenta Platzhalterfarbe [1,0,1]
    //   Metall  = metalness ~ 1 (Bridge, Regler, Schrauben, Gurtpins)
    //   Hals    = Material mit Holz-Textur (map gesetzt)
    function isMagenta(c) {
        return c && c.r > 0.85 && c.g < 0.2 && c.b > 0.85;
    }

    function luminance(c) {
        return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    }

    function classifyMaterial(mat) {
        if (!mat) return;
        if (isMagenta(mat.color)) {
            makeDualColor(mat);
        } else if (mat.metalness !== undefined && mat.metalness >= 0.9) {
            hardwareMats.push(mat);
        } else if (mat.map) {
            neckMats.push(mat);
        } else if (luminance(mat.color) < 0.35) {
            // Dunkle Kunststoffteile (Pickup-Gehaeuse + dunkle Halsteile, nicht
            // das Holz) noch etwas abdunkeln, damit sie satter wirken.
            mat.color.multiplyScalar(0.4);
            mat.needsUpdate = true;
        }
    }

    // --- Oeffentliche API (von configurator.js genutzt) ---------------------
    const BassViewer = {
        setBody(a, b) {
            bodyColors.a = a;
            bodyColors.b = b;
            bodyUniforms.forEach((u) => {
                u.a.value.set(a);
                u.b.value.set(b);
            });
        },
        setHardware(color, metallic, rough) {
            hardwareMats.forEach((m) => {
                if (color) m.color.set(color);
                if (metallic !== undefined) m.metalness = metallic;
                if (rough !== undefined) m.roughness = rough;
                m.needsUpdate = true;
            });
        },
        setNeck(color) {
            neckMats.forEach((m) => {
                if (color) m.color.set(color);
                m.needsUpdate = true;
            });
        }
    };

    // Bereits im Konfigurator gewaehlte Werte anwenden
    function applyInitialConfig() {
        const cfg = window.bassConfig || {};
        if (cfg.body) BassViewer.setBody(cfg.body.a, cfg.body.b);
        if (cfg.hardware) BassViewer.setHardware(cfg.hardware.color, cfg.hardware.metallic, cfg.hardware.rough);
        if (cfg.neck) BassViewer.setNeck(cfg.neck.color);
    }

    // --- Modell laden -------------------------------------------------------
    new GLTFLoader().load(
        modelUrl,
        (gltf) => {
            const model = gltf.scene;

            const seen = new Set();
            model.traverse((o) => {
                if (!o.isMesh) return;
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                let isBody = false;
                mats.forEach((m) => {
                    if (m && !seen.has(m)) {
                        seen.add(m);
                        classifyMaterial(m);
                    }
                    if (m && isMagenta(m.color)) isBody = true;
                });
                if (isBody) bodyMeshes.push(o);
            });

            scene.add(model);

            // Kamera auf das Modell einpassen
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            // Dual-Color-Verlauf ueber die Bounding-Box NUR des Korpus aufspannen,
            // damit beide Farben ueber den ganzen Body sichtbar sind (nicht nur
            // ein Ausschnitt des Gesamtmodell-Verlaufs).
            // Verlauf entlang der X-Achse des Korpus (auf dem Screen "unten-oben").
            const bodyBox = new THREE.Box3();
            bodyMeshes.forEach((m) => bodyBox.expandByObject(m));
            setGradientFromBox(bodyMeshes.length ? bodyBox : box, "x");

            controls.target.copy(center);
            camera.near = maxDim / 100;
            camera.far = maxDim * 100;
            camera.updateProjectionMatrix();

            const dist = maxDim * 1.9;
            camera.position.set(
                center.x - dist * 0.45,
                center.y + dist * 0.28,
                center.z + dist * 0.85
            );
            controls.minDistance = maxDim * 0.18; // deutlich naeher heranzoomen
            controls.maxDistance = maxDim * 4;
            controls.update();

            applyInitialConfig();
            window.BassViewer = BassViewer;

            if (loadingEl) loadingEl.remove();
            resize();
        },
        undefined,
        (err) => {
            console.error("GLB konnte nicht geladen werden:", err);
            if (loadingEl) loadingEl.textContent = "3D-Modell konnte nicht geladen werden.";
        }
    );

    // --- Groesse / Render-Loop ---------------------------------------------
    function resize() {
        const w = mount.clientWidth || 1;
        const h = mount.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(mount);
    resize();

    renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
    });
}
