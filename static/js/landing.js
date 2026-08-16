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

    // ----- Mobiles Menü (Hamburger) -----------------------------------------
    // Auf schmalen Screens ist die Nav eingeklappt; der Button oben rechts
    // öffnet/schließt sie. Ein Klick auf einen Link oder außerhalb schließt sie.
    var navToggle = document.querySelector(".nav-toggle");
    if (navToggle && topbar) {
        var topnav = document.getElementById("topnav");
        function setNav(open) {
            topbar.classList.toggle("nav-open", open);
            navToggle.setAttribute("aria-expanded", open ? "true" : "false");
        }
        navToggle.addEventListener("click", function (e) {
            e.stopPropagation();
            setNav(!topbar.classList.contains("nav-open"));
        });
        if (topnav) {
            topnav.querySelectorAll("a").forEach(function (a) {
                a.addEventListener("click", function () { setNav(false); });
            });
        }
        document.addEventListener("click", function (e) {
            if (topbar.classList.contains("nav-open") && !topbar.contains(e.target)) {
                setNav(false);
            }
        });
        window.addEventListener("resize", function () {
            if (window.innerWidth > 960) setNav(false);
        });
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
            ["td1", 680], ["td2", 680], ["td3", 680], ["td4", 680], ["td5", 2400],
            ["td4", 680], ["td3", 680], ["td2", 680], ["td1", 2400],
            ["td6", 680], ["td7", 680], ["td8", 680], ["td9", 2400],
            ["td8", 680], ["td7", 680], ["td6", 680], ["td1", 680]
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

    // ----- E-Mail-Adresse in die Zwischenablage kopieren -------------------
    var COPY_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    var CHECK_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    document.querySelectorAll("[data-copy]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var text = btn.getAttribute("data-copy");

            function feedback() {
                btn.classList.add("is-copied");
                btn.innerHTML = CHECK_ICON;
                btn.setAttribute("title", "Kopiert!");
                setTimeout(function () {
                    btn.classList.remove("is-copied");
                    btn.innerHTML = COPY_ICON;
                    btn.setAttribute("title", "Adresse kopieren");
                }, 1600);
            }

            function fallback() {
                var ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.focus(); ta.select();
                try { document.execCommand("copy"); feedback(); } catch (e) {}
                document.body.removeChild(ta);
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(feedback).catch(fallback);
            } else {
                fallback();
            }
        });
    });
})();
