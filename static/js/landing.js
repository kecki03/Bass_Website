(function () {
    "use strict";

    // Navigationsleiste bekommt beim Scrollen einen Hintergrund
    var topbar = document.querySelector(".topbar--fixed");
    function onScroll() {
        if (window.scrollY > 40) topbar.classList.add("is-scrolled");
        else topbar.classList.remove("is-scrolled");
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Elemente sanft einblenden, sobald sie in den Sichtbereich scrollen
    var reveals = document.querySelectorAll(".reveal");

    // Screenshot-Modus (?shot): Hero fest, alles sofort sichtbar (fuer Ganzseiten-Foto)
    if (location.search.indexOf("shot") !== -1) {
        document.body.classList.add("shot");
        reveals.forEach(function (el) { el.classList.add("is-visible"); });
        return;
    }

    if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        reveals.forEach(function (el) { io.observe(el); });
    } else {
        reveals.forEach(function (el) { el.classList.add("is-visible"); });
    }

    // Newsletter-Anmeldung fuer die Release-Benachrichtigung
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
