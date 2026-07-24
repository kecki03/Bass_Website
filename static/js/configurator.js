(function () {
    "use strict";

    var bassImg = document.getElementById("bassImg");
    var glow = document.querySelector(".stage__glow");
    var stageName = document.getElementById("stageName");
    var stageHardware = document.getElementById("stageHardware");

    // Aktuelle Auswahl je Gruppe (Start = jeweils erste Option)
    var state = {};

    // Metall-Farbwerte fuer den weichen Glow-Schein hinter dem Bass
    var hardwareGlow = {
        chrome: "rgba(139,108,255,0.28)",
        black: "rgba(90,90,110,0.28)",
        gold: "rgba(255,197,90,0.30)"
    };

    // Weicher Schlagschatten bleibt bei jeder Farbe erhalten
    var SHADOW = " drop-shadow(0 30px 45px rgba(0,0,0,0.6))";

    // Faerbt den Bass per CSS-Filter passend zur gewaehlten Korpus-Farbe um
    function applyBodyFilter(hue, sat) {
        if (sat === 0) {
            // Graphite: entsaettigen statt Farbe drehen
            bassImg.style.filter = "grayscale(1) brightness(0.92) contrast(1.05)" + SHADOW;
        } else {
            bassImg.style.filter = "hue-rotate(" + hue + "deg) saturate(" + sat + ")" + SHADOW;
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

        // Live-Effekte je nach Gruppe
        if (group === "body") {
            applyBodyFilter(
                parseFloat(btn.dataset.hue) || 0,
                btn.dataset.sat === undefined ? 1 : parseFloat(btn.dataset.sat)
            );
            stageName.textContent = btn.dataset.name;
        }
        if (group === "hardware") {
            stageHardware.textContent = btn.dataset.name;
            glow.style.background =
                "radial-gradient(circle, " +
                (hardwareGlow[btn.dataset.id] || hardwareGlow.chrome) +
                ", rgba(0,0,0,0) 65%)";
        }
    }

    // Alle Buttons verdrahten + Startzustand aus den .is-active Buttons lesen
    document.querySelectorAll(".choice").forEach(function (btn) {
        btn.addEventListener("click", function () { selectChoice(btn); });
    });
    document.querySelectorAll(".choice.is-active").forEach(function (btn) {
        selectChoice(btn);
    });

    // ----- Modals: Interesse / Unterstuetzer -------------------------------

    function openModal(modal) {
        modal.hidden = false;
        document.body.classList.add("modal-open");
        var first = modal.querySelector("input, button");
        if (first) first.focus();
    }

    function closeModal(modal) {
        modal.hidden = true;
        if (!document.querySelector(".modal:not([hidden])")) {
            document.body.classList.remove("modal-open");
        }
    }

    var interestModal = document.getElementById("interestModal");
    var supporterModal = document.getElementById("supporterModal");

    document.getElementById("interestBtn").addEventListener("click", function () {
        openModal(interestModal);
    });
    document.getElementById("supporterBtn").addEventListener("click", function () {
        openModal(supporterModal);
    });

    // Schliessen ueber X, Backdrop oder Escape
    document.querySelectorAll("[data-close]").forEach(function (el) {
        el.addEventListener("click", function () {
            closeModal(el.closest(".modal"));
        });
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal:not([hidden])").forEach(closeModal);
        }
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

    document.getElementById("interestForm").addEventListener("submit", function (e) {
        e.preventDefault();
        submitInterest(this, "interest");
    });
    document.getElementById("supporterForm").addEventListener("submit", function (e) {
        e.preventDefault();
        submitInterest(this, "supporter");
    });
})();
