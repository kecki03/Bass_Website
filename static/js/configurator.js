(function () {
    "use strict";

    // Vom Server gesetzte UI-Texte (DE/EN). Fallback auf Deutsch, falls window.I18N fehlt.
    var I18N = window.I18N || {};
    function tr(key, fallback) { return I18N[key] || fallback; }

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
                ? tr("filaments_show_all", "Alle {n} Filamente anzeigen").replace("{n}", total)
                : tr("filaments_show_less", "Weniger anzeigen");
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

    // ----- Rundung ----------------------------------------------------------
    // Alle angezeigten Aufpreise werden auf das naechste 5er-Vielfache
    // aufgerundet; der Gesamtpreis auf die naechste auf 9 endende Zahl.
    function roundUp5(n) { return Math.ceil(n / 5) * 5; }
    function roundUp9(n) {
        n = Math.ceil(n);
        return n + ((9 - (n % 10)) % 10);   // z.B. 1290->1299, 1300->1309
    }

    // ----- Preis-Kalkulation ------------------------------------------------
    // Gesamtpreis = (Metall + Pickups + Potis + Hals + Fix-Teile + Arbeit +
    // Shipping) * Gewinn * USt. Metallpreis haengt von Marke UND Farbe ab.
    function recalcPrice() {
        var P = window.PRICING;
        var el = document.getElementById("totalPrice");
        if (!P || !el) return;

        var brand = (state.metal_brand && state.metal_brand.id) || "harley_benton";
        var color = (state.hardware && state.hardware.id) || "chrome";
        var metalByBrand = P.metal[brand] || P.metal.harley_benton;
        var metal = (color in metalByBrand)
            ? metalByBrand[color]
            : metalByBrand[Object.keys(metalByBrand)[0]];

        var pickups = P.pickups[state.pickups && state.pickups.id];
        if (pickups === undefined) pickups = P.pickups.seymour;
        var potis = P.potis[state.potis && state.potis.id];
        if (potis === undefined) potis = P.potis.allparts;
        var neck = P.neck[state.neck && state.neck.id];
        if (neck === undefined) neck = P.neck.drparts;

        var parts = metal + pickups + potis + neck + P.fixed_parts;
        var vat = P.vat || 1;
        var total = (parts + P.labor + P.finish + P.shipping) * P.profit * vat;  // brutto inkl. USt
        el.textContent = roundUp9(total).toLocaleString(tr("price_locale", "de-DE")) + " €";
        updateExtras();
    }

    // Preis-Beitrag einer Option (bei Metall abhaengig von Marke UND Farbe).
    function contributionFor(group, id) {
        var P = window.PRICING;
        if (!P) return undefined;
        if (group === "pickups") return P.pickups[id];
        if (group === "potis") return P.potis[id];
        if (group === "neck") return P.neck[id];
        if (group === "hardware") {
            var b = (state.metal_brand && state.metal_brand.id) || "harley_benton";
            return P.metal[b] ? P.metal[b][id] : undefined;
        }
        if (group === "metal_brand") {
            var c = (state.hardware && state.hardware.id) || "chrome";
            return (P.metal[id] && (c in P.metal[id])) ? P.metal[id][c] : undefined;
        }
        return undefined;
    }

    // "+ X €" je Option = realer Mehrpreis gegenueber der guenstigsten (Standard-)
    // Option derselben Gruppe – inkl. Gewinnaufschlag, auf 5er aufgerundet. So
    // entspricht der Aufpreis dem tatsaechlichen Anstieg des Richtpreises.
    function updateExtras() {
        var P = window.PRICING;
        if (!P) return;
        ["metal_brand", "hardware", "pickups", "potis", "neck"].forEach(function (group) {
            var btns = Array.prototype.slice.call(
                document.querySelectorAll('.choice[data-group="' + group + '"]'));
            var contribs = [];
            btns.forEach(function (b) {
                var c = contributionFor(group, b.dataset.id);
                if (c !== undefined) contribs.push(c);
            });
            if (!contribs.length) return;
            var base = Math.min.apply(null, contribs);
            btns.forEach(function (b) {
                var ex = b.querySelector("[data-extra]");
                if (!ex) return;
                var c = contributionFor(group, b.dataset.id);
                var d = (c === undefined) ? 0 : (c - base) * P.profit * (P.vat || 1);
                ex.textContent = d > 0 ? ("+ " + roundUp5(d) + " €") : "";
            });
        });
    }

    // Metall-Farben je nach Marke ein-/ausblenden: Gold gibt es nur bei Gotoh.
    // Ist eine nicht verfuegbare Farbe aktiv, wird auf Chrom zurueckgeschaltet.
    function updateMetalColorAvailability() {
        var P = window.PRICING;
        if (!P) return;
        var brand = (state.metal_brand && state.metal_brand.id) || "harley_benton";
        var allowed = P.metal[brand] || {};
        var needSwitch = false;
        document.querySelectorAll('.choice[data-group="hardware"]').forEach(function (btn) {
            var ok = Object.prototype.hasOwnProperty.call(allowed, btn.dataset.id);
            var wrap = btn.closest(".choice-wrap") || btn;
            wrap.style.display = ok ? "" : "none";
            btn.disabled = !ok;
            if (btn.classList.contains("is-active") && !ok) needSwitch = true;
        });
        if (needSwitch) {
            var fallback = document.querySelector('.choice[data-group="hardware"][data-id="chrome"]')
                || document.querySelector('.choice[data-group="hardware"]:not([disabled])');
            if (fallback) selectChoice(fallback);
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
            // Hintergrund-Glow bleibt bewusst fest (in CSS definiert) und wechselt
            // nicht mehr je Metallteil.
        }
        // Bei Marken-Wechsel Metall-Farben-Verfuegbarkeit anpassen (Gold nur Gotoh),
        // danach immer den Preis neu berechnen.
        if (group === "metal_brand") updateMetalColorAvailability();
        recalcPrice();
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

    // Startzustand konsistent machen: Metall-Farben-Verfuegbarkeit + Preis.
    updateMetalColorAvailability();
    recalcPrice();

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
        submitBtn.textContent = tr("form_sending", "Senden …");
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
                    msg.textContent = res.d.error || tr("form_error_generic", "Etwas ist schiefgelaufen. Bitte später erneut versuchen.");
                    msg.classList.add("is-error");
                    submitBtn.disabled = false;
                    submitBtn.textContent = original;
                }
            })
            .catch(function () {
                msg.textContent = tr("form_error_network", "Verbindung fehlgeschlagen. Bitte später erneut versuchen.");
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
