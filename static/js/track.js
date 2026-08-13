// Winziges, cookieloses Reichweiten-Beacon fuer die Eigen-Analytics.
// Schickt nur den aktuellen Pfad + Referrer an /api/track. Der Server berechnet
// daraus anonymisiert Land/Geraet/Besucher-Hash (keine IP-Speicherung, kein Cookie).
(function () {
    try {
        var payload = JSON.stringify({
            path: location.pathname,
            referrer: document.referrer || ""
        });
        var url = "/api/track";
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
        } else {
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
                keepalive: true
            });
        }
    } catch (e) { /* Analytics darf die Seite niemals stoeren */ }
})();
