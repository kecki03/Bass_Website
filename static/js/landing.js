(function () {
    "use strict";

    var isShot = location.search.indexOf("shot") !== -1;
    if (isShot) document.body.classList.add("shot");

    // Topbar bleibt transdurchsichtig, aber die Schriftfarbe passt sich an:
    // über hellen Sektionen dunkel, über dunklen hell.
    var topbar = document.querySelector(".topbar");
    var navSections = Array.prototype.slice.call(document.querySelectorAll("[data-nav]"));
    if (topbar && navSections.length) {
        function updateNav() {
            var probe = 34;  // ungefähre vertikale Mitte der Topbar
            for (var i = 0; i < navSections.length; i++) {
                var r = navSections[i].getBoundingClientRect();
                if (r.top <= probe && r.bottom > probe) {
                    topbar.classList.toggle("is-dark", navSections[i].getAttribute("data-nav") === "dark");
                    // Konfigurator-Link erst zeigen, sobald der Hero verlassen ist
                    topbar.classList.toggle("past-hero", navSections[i].id !== "top");
                    return;
                }
            }
        }
        window.addEventListener("scroll", updateNav, { passive: true });
        window.addEventListener("resize", updateNav, { passive: true });
        updateNav();
    }

    // Ausklapp-Box (Modularität): Tap-Toggle für Touch (Desktop nutzt :hover)
    document.querySelectorAll(".dropbox").forEach(function (box) {
        function toggle() {
            var open = box.classList.toggle("is-open");
            box.setAttribute("aria-expanded", open ? "true" : "false");
        }
        box.addEventListener("click", toggle);
        box.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        });
    });

    // Modularitäts-Animation: freigestellte Frames als Daumenkino, aber mit
    // weichem Crossfade (CSS-Transition) statt hartem Schnitt. Reihenfolge &
    // Haltezeiten exakt nach Vorgabe: lila baut auf (628 hält), ab, dann grau
    // (636 hält), zurück – Endlosschleife.
    var modAnim = document.getElementById("modAnim");
    if (modAnim) {
        var frames = {};
        modAnim.querySelectorAll(".mod-frame").forEach(function (img) {
            frames[img.getAttribute("data-frame")] = img;
        });
        var SEQ = [
            ["633", 1000], ["632", 820], ["631", 820], ["630", 820], ["628", 3000],
            ["630", 780], ["631", 780], ["632", 780], ["633", 1000],
            ["634", 950], ["636", 3000], ["634", 950]
        ];
        var mi = -1, mprev = null, zc = 1;
        function modStep() {
            mi = (mi + 1) % SEQ.length;
            var f = SEQ[mi][0], hold = SEQ[mi][1];
            var next = frames[f];
            if (next && next !== mprev) {
                next.style.zIndex = ++zc;          // neuer Frame liegt oben -> sauberes Überblenden
                next.classList.add("is-active");
                if (mprev) {
                    var old = mprev;
                    // alten Frame erst ausblenden, wenn der neue vollständig da ist (matcht CSS .8s)
                    setTimeout(function () { old.classList.remove("is-active"); }, 800);
                }
                mprev = next;
            }
            setTimeout(modStep, hold);
        }
        // Erst alle Frames vorladen/dekodieren, dann starten (kein Flackern)
        var imgEls = Array.prototype.slice.call(modAnim.querySelectorAll(".mod-frame"));
        Promise.all(imgEls.map(function (img) {
            if (img.complete && img.naturalWidth) return Promise.resolve();
            if (img.decode) return img.decode().catch(function () {});
            return new Promise(function (res) { img.onload = img.onerror = res; });
        })).then(function () {
            modAnim.classList.add("is-ready");
            modStep();
        });
    }

    // Newsletter-Anmeldung für die Release-Benachrichtigung
    var newsletter = document.getElementById("newsletterForm");
    if (newsletter) {
        newsletter.addEventListener("submit", function (e) {
            e.preventDefault();
            var msg = newsletter.querySelector("[data-msg]");
            var btn = newsletter.querySelector('button[type="submit"]');
            var email = newsletter.querySelector('input[name="email"]').value.trim();
            var consent = newsletter.querySelector('input[name="consent"]').checked;

            msg.textContent = "";
            msg.className = "form__msg";
            btn.disabled = true;

            fetch("/api/newsletter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email, consent: consent })
            })
                .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
                .then(function (res) {
                    if (res.ok && res.d.ok) {
                        newsletter.innerHTML = '<p class="form__success">✓ ' + res.d.message + "</p>";
                    } else {
                        msg.textContent = res.d.error || "Etwas ist schiefgelaufen.";
                        msg.classList.add("is-error");
                        btn.disabled = false;
                    }
                })
                .catch(function () {
                    msg.textContent = "Verbindung fehlgeschlagen. Bitte später erneut versuchen.";
                    msg.classList.add("is-error");
                    btn.disabled = false;
                });
        });
    }
})();
