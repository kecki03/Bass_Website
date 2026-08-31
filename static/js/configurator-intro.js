/* Intro-Onboarding fuer den Konfigurator.
   Zeigt vor dem eigentlichen Konfigurator ein Vollbild-Overlay mit 3 Slides,
   das das modulare Bass-Konzept erklaert. Slide 3 baut den Bass animiert
   zusammen (Teile-Reihenfolge 1 -> 3 -> 4 -> 2). Laeuft unabhaengig vom
   restlichen Konfigurator-Code. */
(function () {
    "use strict";

    var intro = document.getElementById("intro");
    if (!intro) return;

    var track = document.getElementById("introTrack");
    var slidesEl = intro.querySelector(".intro__slides");
    var backBtn = document.getElementById("introBack");
    var nextBtn = document.getElementById("introNext");
    var skipBtn = document.getElementById("introSkip");
    var progress = document.getElementById("introProgress");
    var dotsWrap = intro.querySelector(".progress__dots");
    var countEl = intro.querySelector(".progress__count");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Alle Slides. Die letzte kann die Kaufoptionen-Auswahl sein (--choose):
    // sie zaehlt nicht als Erklaerschritt (kein Zaehler, kein "Weiter"-Button).
    var slides = Array.prototype.slice.call(track.children);
    var total = slides.length;
    var chooseIdx = -1;
    for (var s = 0; s < slides.length; s++) {
        if (slides[s].classList.contains("intro-slide--choose")) { chooseIdx = s; break; }
    }
    var explainCount = chooseIdx >= 0 ? chooseIdx : total;   // Anzahl Erklaer-Slides

    var i = 0;
    var timers = [];
    var nextLabel = nextBtn.textContent;   // "Weiter →" (server-gerendert)

    // Fortschritts-Punkte nur fuer die Erklaer-Slides
    for (var d = 0; d < explainCount; d++) {
        var dot = document.createElement("span");
        dot.className = "progress__dot";
        dotsWrap.appendChild(dot);
    }
    var dots = dotsWrap.children;

    // Scroll sperren (html + body), solange das Intro sichtbar ist. Wichtig auch,
    // damit keine Scrollbar die Viewport-Breite verkleinert (sonst Slide-Versatz).
    document.documentElement.classList.add("intro-open");
    document.body.classList.add("intro-open");

    function render() {
        // Pixelgenaue Verschiebung (unabhaengig von Scrollbar-Breite/vw-Rundung)
        track.style.transform = "translateX(" + (-i * slidesEl.clientWidth) + "px)";
        var isChoose = (i === chooseIdx);

        // Fortschritt + Weiter-Button gibt es nur auf den Erklaer-Slides
        progress.style.visibility = isChoose ? "hidden" : "visible";
        nextBtn.style.display = isChoose ? "none" : "";
        if (!isChoose) {
            for (var d = 0; d < explainCount; d++) dots[d].classList.toggle("is-on", d === i);
            if (countEl) countEl.textContent = (i + 1) + " / " + explainCount;
            nextBtn.textContent = nextLabel;
        }
        backBtn.hidden = (i === 0);

        // Assemble-Animation nur auf der letzten Erklaer-Slide
        if (i === explainCount - 1) startAssemble(); else resetAssemble();
    }

    function getAssembly() { return intro.querySelector("[data-assemble]"); }

    // Quadranten-Hotzones: fangen Hover/Klick pro Ecke ab und nehmen das jeweilige
    // Teil wieder ab (die Teil-Bilder selbst sind deckungsgleiche Vollbild-Rechtecke,
    // ueber die man nicht einzeln hovern koennte).
    function setupHotzones() {
        var asm = getAssembly(); if (!asm || asm.__hz) return;
        asm.__hz = true;
        var canHover = !window.matchMedia || window.matchMedia("(hover: hover)").matches;
        // Ecke -> Teil-Nummer (1 oben-links, 2 oben-rechts, 3 unten-rechts, 4 unten-links)
        var zones = [
            { part: 1, css: "top:0;left:0" },
            { part: 2, css: "top:0;right:0" },
            { part: 3, css: "bottom:0;right:0" },
            { part: 4, css: "bottom:0;left:0" }
        ];
        zones.forEach(function (z) {
            var hz = document.createElement("div");
            hz.className = "assembly__hz";
            hz.style.cssText = "position:absolute;width:50%;height:50%;z-index:5;" + z.css;
            var part = asm.querySelector('.assembly__part[data-part="' + z.part + '"]');
            if (canHover) {
                hz.addEventListener("mouseenter", function () {
                    if (asm.classList.contains("is-interactive")) part.classList.add("is-off");
                });
                hz.addEventListener("mouseleave", function () { part.classList.remove("is-off"); });
            } else {
                hz.style.cursor = "pointer";
                hz.addEventListener("click", function () {
                    if (asm.classList.contains("is-interactive")) part.classList.toggle("is-off");
                });
            }
            asm.appendChild(hz);
        });
    }

    function resetAssemble() {
        timers.forEach(clearTimeout); timers = [];
        var asm = getAssembly(); if (!asm) return;
        asm.classList.add("is-exploded");
        asm.classList.remove("is-interactive");
        asm.querySelectorAll(".assembly__part").forEach(function (p) {
            p.classList.remove("is-home", "is-off");
        });
    }

    function startAssemble() {
        resetAssemble();
        var asm = getAssembly(); if (!asm) return;
        setupHotzones();
        var order = [1, 3, 4, 2];        // Aufbaureihenfolge der Korpusteile
        if (reduce) {
            // Ohne Animation: Teile direkt an ihre Endposition setzen
            order.forEach(function (part) {
                var el = asm.querySelector('.assembly__part[data-part="' + part + '"]');
                if (el) el.classList.add("is-home");
            });
            asm.classList.add("is-interactive");
            return;
        }
        var startDelay = 650, step = 560;
        order.forEach(function (part, k) {
            timers.push(setTimeout(function () {
                var el = asm.querySelector('.assembly__part[data-part="' + part + '"]');
                if (el) el.classList.add("is-home");
            }, startDelay + k * step));
        });
        // Interaktion aktivieren, sobald der Bass fertig zusammengebaut ist
        timers.push(setTimeout(function () {
            asm.classList.add("is-interactive");
        }, startDelay + order.length * step + 100));
    }

    function go(n) { i = Math.max(0, Math.min(total - 1, n)); render(); }

    function finish() {
        intro.classList.add("is-hidden");
        document.documentElement.classList.remove("intro-open");
        document.body.classList.remove("intro-open");
        window.setTimeout(function () { intro.remove(); }, 450);
    }

    nextBtn.addEventListener("click", function () {
        if (i < total - 1) go(i + 1); else finish();
    });
    backBtn.addEventListener("click", function () { go(i - 1); });
    skipBtn.addEventListener("click", finish);

    // Bei Groessenaenderung nur neu positionieren (ohne Assemble-Animation neu zu starten)
    window.addEventListener("resize", function () {
        track.style.transition = "none";
        track.style.transform = "translateX(" + (-i * slidesEl.clientWidth) + "px)";
        requestAnimationFrame(function () { track.style.transition = ""; });
    });

    // Kaufoptionen: Klick auf "Basis + Korpusteile" oeffnet den Konfigurator.
    // Die zweite Option ("Nur Korpusteile") ist vorerst deaktiviert.
    var chooseFull = document.getElementById("chooseFull");
    if (chooseFull) chooseFull.addEventListener("click", finish);

    // Tastatur-Navigation
    document.addEventListener("keydown", function (e) {
        if (intro.classList.contains("is-hidden")) return;
        if (e.key === "ArrowRight") { if (i < total - 1) go(i + 1); }
        else if (e.key === "ArrowLeft") { go(i - 1); }
        else if (e.key === "Escape") finish();
    });

    // Touch-Swipe (Mobile): nach links = weiter, nach rechts = zurueck
    var touchX = null, touchY = null;
    intro.addEventListener("touchstart", function (e) {
        touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
    }, { passive: true });
    intro.addEventListener("touchend", function (e) {
        if (touchX === null) return;
        var dx = e.changedTouches[0].clientX - touchX;
        var dy = e.changedTouches[0].clientY - touchY;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            if (dx < 0 && i < total - 1) go(i + 1);
            else if (dx > 0) go(i - 1);
        }
        touchX = touchY = null;
    }, { passive: true });

    render();
    // Nach dem ersten Layout die Position noch einmal exakt setzen (Breite stabil).
    requestAnimationFrame(function () {
        track.style.transition = "none";
        track.style.transform = "translateX(" + (-i * slidesEl.clientWidth) + "px)";
        requestAnimationFrame(function () { track.style.transition = ""; });
    });
})();
