(function () {
    "use strict";

    // ===== Modals ZUERST und abgesichert verdrahten =====================
    // Bewusst ganz oben, damit "Interesse bekunden"/"Unterstuetzung" auch dann
    // funktionieren, wenn weiter unten etwas anderes einen Fehler wirft.
    function openModal(modal) {
        if (!modal) return;
        modal.hidden = false;
        document.body.classList.add("modal-open");
        var first = modal.querySelector("input, button");
        if (first) first.focus();
    }
    function closeModal(modal) {
        if (!modal) return;
        modal.hidden = true;
        if (!document.querySelector(".modal:not([hidden])")) {
            document.body.classList.remove("modal-open");
        }
    }
    var interestModal = document.getElementById("interestModal");
    var supporterModal = document.getElementById("supporterModal");
    var interestBtn = document.getElementById("interestBtn");
    var supporterBtn = document.getElementById("supporterBtn");
    if (interestBtn) interestBtn.addEventListener("click", function () { openModal(interestModal); });
    if (supporterBtn) supporterBtn.addEventListener("click", function () { openModal(supporterModal); });
    document.querySelectorAll("[data-close]").forEach(function (el) {
        el.addEventListener("click", function () { closeModal(el.closest(".modal")); });
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal:not([hidden])").forEach(closeModal);
        }
    });

    var glow = document.querySelector(".stage__glow");
    var stageName = document.getElementById("stageName");
    var stageHardware = document.getElementById("stageHardware");

    // ----- Geraete-Erkennung: Maus- oder Touch-Steuerung im Info-Tooltip -----
    var infoBox = document.querySelector(".stage__info");
    if (infoBox) {
        var setMode = function (touch) {
            infoBox.classList.toggle("is-touch", touch);
            infoBox.classList.toggle("is-mouse", !touch);
        };
        // Startzustand aus dem primaeren Zeiger ableiten (Handy/Tablet = coarse)
        var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
        setMode(!!coarse);
        // Bei jeder Eingabe die tatsaechlich genutzte Art anzeigen. pointerType
        // unterscheidet sauber touch/mouse (auch auf Hybrid-Geraeten).
        window.addEventListener("pointerdown", function (e) {
            if (e.pointerType) setMode(e.pointerType === "touch");
        }, { passive: true });
    }

    // ----- Filament-Liste auf-/zuklappen (ab dem 7. Eintrag) -----------------
    var bodyToggle = document.getElementById("bodyToggle");
    var bodyChoices = document.getElementById("bodyChoices");
    if (bodyToggle && bodyChoices) {
        var total = bodyToggle.dataset.count || bodyChoices.querySelectorAll(".choice-wrap").length;
        bodyToggle.addEventListener("click", function () {
            var collapsed = bodyChoices.classList.toggle("is-collapsed");
            bodyToggle.setAttribute("aria-expanded", String(!collapsed));
            bodyToggle.textContent = collapsed
                ? "Alle " + total + " Filamente anzeigen"
                : "Weniger anzeigen";
        });
    }

    // Aktuelle Auswahl je Gruppe (Start = jeweils erste Option)
    var state = {};

    // Gewuenschte Konfiguration global ablegen. Das 3D-Modul (configurator3d.js)
    // laedt als ES-Modul spaeter und liest diesen Stand beim Modell-Load aus.
    // Bei spaeteren Klicks ist window.BassViewer schon da und wird direkt gerufen.
    window.bassConfig = window.bassConfig || {};

    // Metall-Farbwerte fuer den weichen Glow-Schein hinter dem Bass
    var hardwareGlow = {
        chrome: "rgba(139,108,255,0.28)",
        black: "rgba(90,90,110,0.28)",
        gold: "rgba(255,197,90,0.30)"
    };

    // Auswahl an den 3D-Viewer weiterreichen (bzw. puffern, bis er bereit ist)
    function pushToViewer(group, btn) {
        if (group === "body") {
            var a = btn.dataset.color;
            var b = btn.dataset.color2 || a;
            window.bassConfig.body = { a: a, b: b };
            if (window.BassViewer) window.BassViewer.setBody(a, b);
        } else if (group === "hardware") {
            var hw = {
                color: btn.dataset.color,
                metallic: btn.dataset.metallic !== undefined ? parseFloat(btn.dataset.metallic) : undefined,
                rough: btn.dataset.rough !== undefined ? parseFloat(btn.dataset.rough) : undefined
            };
            window.bassConfig.hardware = hw;
            if (window.BassViewer) window.BassViewer.setHardware(hw.color, hw.metallic, hw.rough);
        } else if (group === "neck") {
            window.bassConfig.neck = { color: btn.dataset.color };
            if (window.BassViewer) window.BassViewer.setNeck(btn.dataset.color);
        }
    }

    function selectChoice(btn) {
        var group = btn.dataset.group;

        // Aktiven Zustand innerhalb der Gruppe umsetzen
        document
            .querySelectorAll('.choice[data-group="' + group + '"]')
            .forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");

        state[group] = {
            id: btn.dataset.id,
            name: btn.dataset.name
        };

        // Modell einfaerben
        pushToViewer(group, btn);

        // Bildunterschrift + Glow
        if (group === "body") {
            if (stageName) stageName.textContent = btn.dataset.name;
            // "Hier geht's zum Filament"-Leiste auf das aktive Filament setzen
            var filamentLink = document.getElementById("filamentLink");
            var filamentName = document.getElementById("filamentName");
            if (filamentLink && btn.dataset.url) filamentLink.href = btn.dataset.url;
            if (filamentName) filamentName.textContent = btn.dataset.name;
        }
        if (group === "hardware") {
            if (stageHardware) stageHardware.textContent = btn.dataset.name;
            if (glow) {
                glow.style.background =
                    "radial-gradient(circle, " +
                    (hardwareGlow[btn.dataset.id] || hardwareGlow.chrome) +
                    ", rgba(0,0,0,0) 65%)";
            }
        }
    }

    // ----- Info-Tooltips: Tap-Toggle (v.a. Mobile) -------------------------
    // Auf Touch oeffnet/schliesst ein Tipp per Klick (statt Hover). Ein Klick
    // woanders schliesst offene Tooltips wieder.
    function wireTapToggle(el) {
        if (!el) return;
        el.addEventListener("click", function (e) {
            e.stopPropagation();
            var willOpen = !el.classList.contains("is-open");
            document.querySelectorAll(".stage__info.is-open, .filament-info.is-open")
                .forEach(function (o) { o.classList.remove("is-open"); });
            if (willOpen) el.classList.add("is-open");
        });
    }
    wireTapToggle(document.querySelector(".stage__info"));
    document.querySelectorAll(".filament-info").forEach(wireTapToggle);
    document.addEventListener("click", function () {
        document.querySelectorAll(".stage__info.is-open, .filament-info.is-open")
            .forEach(function (el) { el.classList.remove("is-open"); });
    });

    // Alle Buttons verdrahten + Startzustand aus den .is-active Buttons lesen
    document.querySelectorAll(".choice").forEach(function (btn) {
        btn.addEventListener("click", function () { selectChoice(btn); });
    });
    document.querySelectorAll(".choice.is-active").forEach(function (btn) {
        selectChoice(btn);
    });

    // ----- Formulare absenden ----------------------------------------------

    // Sendet ein Formular als JSON an /api/interest und zeigt eine Rueckmeldung
    function submitInterest(form, kind) {
        var msg = form.querySelector("[data-msg]");
        var submitBtn = form.querySelector('button[type="submit"]');

        var payload = { kind: kind, config: state };
        new FormData(form).forEach(function (value, key) {
            if (key !== "consent") payload[key] = value;
        });

        submitBtn.disabled = true;
        var original = submitBtn.textContent;
        submitBtn.textContent = "Senden …";
        msg.textContent = "";
        msg.className = "form__msg";

        fetch("/api/interest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (res) {
                if (res.ok && res.d.ok) {
                    form.innerHTML = '<p class="form__success">✓ ' + res.d.message + "</p>";
                } else {
                    msg.textContent = res.d.error || "Etwas ist schiefgelaufen. Bitte später erneut versuchen.";
                    msg.classList.add("is-error");
                    submitBtn.disabled = false;
                    submitBtn.textContent = original;
                }
            })
            .catch(function () {
                msg.textContent = "Verbindung fehlgeschlagen. Bitte später erneut versuchen.";
                msg.classList.add("is-error");
                submitBtn.disabled = false;
                submitBtn.textContent = original;
            });
    }

    var interestForm = document.getElementById("interestForm");
    var supporterForm = document.getElementById("supporterForm");
    if (interestForm) interestForm.addEventListener("submit", function (e) {
        e.preventDefault();
        submitInterest(this, "interest");
    });
    if (supporterForm) supporterForm.addEventListener("submit", function (e) {
        e.preventDefault();
        submitInterest(this, "supporter");
    });

    // "Adresse hinterlegen" bleibt gesperrt, bis alle Pflichtfelder (inkl.
    // Consent-Haken) ausgefuellt sind. checkValidity() prueft alle required-Felder.
    if (supporterForm) {
        var supporterSubmit = supporterForm.querySelector('button[type="submit"]');
        var syncSupporterBtn = function () {
            if (supporterSubmit) supporterSubmit.disabled = !supporterForm.checkValidity();
        };
        supporterForm.addEventListener("input", syncSupporterBtn);
        supporterForm.addEventListener("change", syncSupporterBtn);
        syncSupporterBtn(); // Startzustand: gesperrt
    }
})();
