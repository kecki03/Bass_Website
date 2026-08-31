# ---------------------------------------------------------------------------
# Mehrsprachigkeit (Deutsch / Englisch).
#
# Umfang bewusst auf die Marketing-Seiten begrenzt: Startseite, Konfigurator und
# Team-Detailseiten. Impressum & Datenschutz bleiben deutsch (rechtlich fuer
# DE/AT massgeblich).
#
# Sprachwahl pro Request: Session ("lang") > Browser (Accept-Language) > "de".
# Der manuelle Umschalter setzt die Session ueber /lang/<code>.
#
# UI    = alle sichtbaren Template-Strings je Sprache (per {{ t.key }}).
# JS    = Strings, die das Frontend-JS zur Laufzeit setzt (per window.I18N).
# API   = Server-Antworttexte der Formular-Endpunkte (Newsletter/Interesse).
# Dazu Overlays fuer die Konfigurator-Optionen (OPTION_*) und das Team.
# ---------------------------------------------------------------------------

SUPPORTED = ("de", "en")
DEFAULT = "de"


def match_accept_language(header):
    """Erste unterstuetzte Sprache aus dem Accept-Language-Header; sonst DEFAULT.

    Beispiel-Header: "en-US,en;q=0.9,de;q=0.8". q-Gewichte werden der Einfachheit
    halber in Reihenfolge des Auftretens ausgewertet (reicht fuer 2 Sprachen).
    """
    if not header:
        return DEFAULT
    for part in header.split(","):
        code = part.split(";")[0].strip().lower()
        primary = code.split("-")[0]
        if primary in SUPPORTED:
            return primary
    return DEFAULT


# ---------------------------------------------------------------------------
# UI-Strings der Templates.
# ---------------------------------------------------------------------------
UI = {
    "de": {
        # --- gemeinsam: Navigation / Footer ---
        "nav_modular": "Modularität",
        "nav_process": "Prozess",
        "nav_about": "Über uns",
        "nav_config": "Konfigurator",
        "nav_menu": "Menü öffnen",
        "footer_note": "3D-gedruckt · Ein Studentenprojekt",
        "footer_imprint": "Impressum",
        "footer_privacy": "Datenschutz",
        "lang_switch": "English",         # Label des Umschalters = Ziel-Sprache
        "lang_switch_short": "EN",        # Kurzform (Konfigurator-Header)
        "lang_switch_aria": "Switch to English",

        # --- index: <head> ---
        "home_title": "Layer Instruments — Ein Bass aus dem 3D-Drucker",
        "home_meta_desc": "Layer Instruments – modulare, 3D-gedruckte Bässe. Konfiguriere deinen individuellen Chisel Bass: einzigartige dreidimensionale Oberfläche, austauschbare Korpusteile und unendliche Farbkombinationen.",
        "home_og_title": "Layer Instruments — Modulare Bässe aus dem 3D-Drucker",
        "home_og_desc": "Konfiguriere deinen individuellen Chisel Bass: einzigartige 3D-Oberfläche, modularer Aufbau, unendliche Farbkombinationen.",

        # --- index: Hero ---
        "hero_cta": "Konfigurieren",

        # --- index: Modularität ---
        "mod_title_1": "Modularität.",
        "mod_title_2_pre": "Dein ",
        "mod_title_2_accent": "individueller",
        "mod_title_2_post": " Look.",
        "mod_how": "So funktioniert´s",
        "mod_text": "Die Besonderheit an unserem Bass: Die Teile werden mittels 3D-Druck gefertigt. Dies ermöglicht einen modularen Aufbau sowie eine Vielzahl an Farbkombinationen. Im robusten Mittelteil aus carbonfaserverstärktem ABS steckt die komplette Technik. Die austauschbaren Korpusteile werden mit wenigen Schrauben befestigt und ermöglichen es, den Look deiner Gitarre jederzeit individuell anzupassen.",

        # --- index: Prozess ---
        "process_title": "Der Prozess",

        # --- index: Über uns ---
        "about_title": "Über uns",
        "about_p1": "Warum sind alle Bässe so ähnlich und unpersönlich? Wir sind Maschinenbauer, Designer und Musiker aus Leidenschaft und haben mit unserem Produkt eine Antwort auf diese Frage geschaffen.",
        "about_p2": "Eine Woche lang verschanzten wir uns in unserer Wohnung. Wir haben gezeichnet, diskutiert und experimentiert. Die Idee war es, eine noch nie gesehene dreidimensionale Oberfläche zu erstellen. Sie verleiht dem Bass Tiefe, Textur und Charakter sowie unendlich mögliche Farbkombinationen.",

        # --- index: Kontakt ---
        "contact_title": "Kontaktanfrage",
        "contact_lead": "Du willst einen Bass, hast Fragen zum Projekt oder magst uns Feedback geben? Melde dich gerne bei uns per E-Mail oder Instagram-Privatnachricht!",
        "contact_copy_aria": "E-Mail-Adresse kopieren",
        "contact_copy_title": "Adresse kopieren",

        # --- index: Galerie ---
        "gallery_title": "Galerie",

        # --- configurator: <head> / Topbar ---
        "config_title": "Layer Instruments — Konfigurator",
        "config_topbar_right": "Chisel · Konfigurator",

        # --- configurator: Panel ---
        "config_eyebrow": "Dein Instrument",
        "config_desc": "Stell dir deinen Bass zusammen. Jede Änderung siehst du sofort links am Instrument. Bitte Beachte, dass der Konfigurator noch in Entwicklung ist und sich verfügbare Teile sowie Farben beim Verkaufsstart ändern können.",
        "config_hardware_default": "Chrom",

        # --- configurator: Steuerungs-Tooltip ---
        "ctrl_title": "Steuerung",
        "ctrl_rotate_mouse": "linke Maustaste ziehen",
        "ctrl_pan_mouse": "rechte Maustaste ziehen",
        "ctrl_zoom_mouse": "Scrollrad",
        "ctrl_rotate_touch": "mit 1 Finger ziehen",
        "ctrl_zoom_touch": "mit 2 Fingern auf-/zuziehen",
        "ctrl_pan_touch": "mit 2 Fingern ziehen",
        "ctrl_rotate": "Drehen",
        "ctrl_pan": "Verschieben",
        "ctrl_zoom": "Zoom",

        # --- configurator: Preis / Dev-Banner / Interesse ---
        "price_label": "Richtpreis · inkl. Aufbau, Versand & USt",
        "dev_tag": "In Entwicklung",
        "dev_text": "Der CHISEL Bass ist noch nicht im Verkauf. Der Preis ist ein Richtwert je nach Konfiguration. Zeig uns, dass dir das Design gefällt, und wir melden uns zum Verkaufsstart bei dir.",
        "interest_btn": "Interesse bekunden",

        # --- configurator: Interesse-Modal ---
        "modal_title": "Interesse bekunden",
        "modal_lead": "Trag deine E-Mail ein und wir benachrichtigen dich, sobald dein konfigurierter Bass bestellbar ist. Deine Konfiguration schicken wir mit.",
        "modal_email": "E-Mail",
        "modal_email_ph": "du@beispiel.de",
        "modal_consent_pre": "Ich bin einverstanden, zu Release-Infos kontaktiert zu werden. (",
        "modal_consent_link": "Datenschutz",
        "modal_consent_post": ")",
        "modal_submit": "Absenden",
        "modal_close": "Schließen",

        # --- configurator: Intro-Onboarding (vor dem Konfigurator) ---
        # Slide-Texte enthalten <span class="intro-hl">…</span> (Lila-Buzzwords)
        # und werden im Template mit |safe gerendert.
        "intro_skip": "Überspringen",
        "intro_back": "Zurück",
        "intro_next": "Weiter",
        "intro_start": "Jetzt konfigurieren",
        "intro_start_short": "Konfigurieren",
        "intro_label_base": "Basis",
        "intro_label_parts": "Korpusteile",
        "intro_label_click": "Klick mich!",
        "intro_label_hover": "Hover drüber!",
        "intro_s1_title": "Unsere Bässe sind <span class=\"intro-hl\">modular</span> aufgebaut. Bevor du deinen Bass konfigurierst, wollen wir dir gerne das Konzept erklären!",
        "intro_s1_sub": "Es dauert höchstens 2 Minuten und du kannst jederzeit überspringen.",
        "intro_s2_top": "Dein Bass besteht aus einer <span class=\"intro-hl\">Basis</span> und <span class=\"intro-hl\">4 Korpusteilen</span>.",
        "intro_s2_bottom": "Beim Kauf kannst du wählen, ob du alle Teile brauchst oder bereits eine <span class=\"intro-hl\">Basis</span> besitzt und nur die Korpusteile zukaufen möchtest.",
        "intro_s3_top": "Die Korpusteile kannst du mit wenigen <span class=\"intro-hl\">Schrauben</span> an der Basis befestigen.",
        "intro_s3_sub": "Keine Sorge, dein Bass kommt standardmäßig fertig zusammengebaut!",
        "intro_s3_bottom": "Besitzt du einmal eine Basis, kannst du also verschiedene <span class=\"intro-hl\">Farben</span> und <span class=\"intro-hl\">Designs</span> an deine Basis schrauben.",
        "intro_s3_bottom_sub": "Die Teile lassen sich in etwa 15–20 min vollständig austauschen.",
        # Kaufoptionen-Screen (nach dem Durchklicken)
        "choose_title": "Was möchtest du bestellen?",
        "choose_full_title": "Basis + Korpusteile",
        "choose_full_desc": "Der komplette Bass inklusive Hals, Elektronik, Hardware und allen vier Korpusteilen.",
        "choose_parts_title": "Nur Korpusteile",
        "choose_parts_desc": "Ich habe bereits eine Basis und möchte nur die Korpusteile dazukaufen.",
        "choose_soon": "Bald verfügbar",

        # --- founder ---
        "founder_back": "Zurück zu „Über uns“",
        "founder_eyebrow": "Layer Instruments",
    },
    "en": {
        # --- shared: navigation / footer ---
        "nav_modular": "Modularity",
        "nav_process": "Process",
        "nav_about": "About",
        "nav_config": "Configurator",
        "nav_menu": "Open menu",
        "footer_note": "3D-printed · A student project",
        "footer_imprint": "Imprint",
        "footer_privacy": "Privacy",
        "lang_switch": "Deutsch",
        "lang_switch_short": "DE",
        "lang_switch_aria": "Auf Deutsch umschalten",

        # --- index: <head> ---
        "home_title": "Layer Instruments — A Bass from the 3D Printer",
        "home_meta_desc": "Layer Instruments – modular, 3D-printed basses. Configure your individual Chisel Bass: a unique three-dimensional surface, interchangeable body parts and endless color combinations.",
        "home_og_title": "Layer Instruments — Modular Basses from the 3D Printer",
        "home_og_desc": "Configure your individual Chisel Bass: a unique 3D surface, modular build, endless color combinations.",

        # --- index: hero ---
        "hero_cta": "Configure",

        # --- index: modularity ---
        "mod_title_1": "Modularity.",
        "mod_title_2_pre": "Your ",
        "mod_title_2_accent": "individual",
        "mod_title_2_post": " look.",
        "mod_how": "How it works",
        "mod_text": "What makes our bass special: the parts are produced using 3D printing. This enables a modular build as well as a huge variety of color combinations. All the electronics sit inside the robust center section made of carbon-fibre-reinforced ABS. The changeable body parts are fixed with just a few screws, letting you restyle your instrument individually at any time.",

        # --- index: process ---
        "process_title": "The Process",

        # --- index: about ---
        "about_title": "About us",
        "about_p1": "Why do all basses look so alike and impersonal? We are mechanical engineers, designers and musicians by passion, and with our product we created an answer to that question.",
        "about_p2": "For a whole week we holed up in our apartment. We sketched, debated and experimented. The idea was to create a three-dimensional surface never seen before. It gives the bass depth, texture and character along with endless possible color combinations.",

        # --- index: contact ---
        "contact_title": "Get in touch",
        "contact_lead": "Want a bass, have questions about the project or some feedback for us? Reach out anytime by email or Instagram DM!",
        "contact_copy_aria": "Copy email address",
        "contact_copy_title": "Copy address",

        # --- index: gallery ---
        "gallery_title": "Gallery",

        # --- configurator: <head> / topbar ---
        "config_title": "Layer Instruments — Configurator",
        "config_topbar_right": "Chisel · Configurator",

        # --- configurator: panel ---
        "config_eyebrow": "Your instrument",
        "config_desc": "Put together your bass. You'll see every change instantly on the instrument to the left. Please note that the configurator is still in development and the available parts and colors may change by launch.",
        "config_hardware_default": "Chrome",

        # --- configurator: controls tooltip ---
        "ctrl_title": "Controls",
        "ctrl_rotate_mouse": "drag left mouse button",
        "ctrl_pan_mouse": "drag right mouse button",
        "ctrl_zoom_mouse": "scroll wheel",
        "ctrl_rotate_touch": "drag with 1 finger",
        "ctrl_zoom_touch": "pinch with 2 fingers",
        "ctrl_pan_touch": "drag with 2 fingers",
        "ctrl_rotate": "Rotate",
        "ctrl_pan": "Pan",
        "ctrl_zoom": "Zoom",

        # --- configurator: price / dev banner / interest ---
        "price_label": "Guide price · incl. assembly, shipping & VAT",
        "dev_tag": "In development",
        "dev_text": "The CHISEL bass is not on sale yet. The price is a guide value depending on your configuration. Show us you like the design and we'll get in touch at launch.",
        "interest_btn": "Register interest",

        # --- configurator: interest modal ---
        "modal_title": "Register interest",
        "modal_lead": "Enter your email and we'll notify you as soon as your configured bass can be ordered. We'll include your configuration.",
        "modal_email": "Email",
        "modal_email_ph": "you@example.com",
        "modal_consent_pre": "I agree to be contacted with release info. (",
        "modal_consent_link": "Privacy",
        "modal_consent_post": ")",
        "modal_submit": "Submit",
        "modal_close": "Close",

        # --- configurator: intro onboarding (before the configurator) ---
        # Slide texts contain <span class="intro-hl">…</span> (purple buzzwords)
        # and are rendered with |safe in the template.
        "intro_skip": "Skip",
        "intro_back": "Back",
        "intro_next": "Next",
        "intro_start": "Start configuring",
        "intro_start_short": "Configure",
        "intro_label_base": "Base",
        "intro_label_parts": "Body parts",
        "intro_label_click": "Click me!",
        "intro_label_hover": "Hover over it!",
        "intro_s1_title": "Our basses have a <span class=\"intro-hl\">modular</span> build. Before you configure your bass, we'd love to walk you through the concept!",
        "intro_s1_sub": "It takes 2 minutes at most and you can skip anytime.",
        "intro_s2_top": "Your bass is made of one <span class=\"intro-hl\">base</span> and <span class=\"intro-hl\">4 body parts</span>.",
        "intro_s2_bottom": "When you buy, you can choose whether you need all the parts or already own a <span class=\"intro-hl\">base</span> and only want to add the body parts.",
        "intro_s3_top": "You attach the body parts to the base with just a few <span class=\"intro-hl\">screws</span>.",
        "intro_s3_sub": "No worries — you can also order your bass fully assembled ;)",
        "intro_s3_bottom": "Once you own a base, you can screw on different <span class=\"intro-hl\">colors</span> and <span class=\"intro-hl\">designs</span> whenever you like.",
        "intro_s3_bottom_sub": "The parts can be fully swapped out in about 15–20 min.",
        # Purchase-options screen (after the walkthrough)
        "choose_title": "What would you like to order?",
        "choose_full_title": "Base + body parts",
        "choose_full_desc": "The complete bass including neck, electronics, hardware and all four body parts.",
        "choose_parts_title": "Body parts only",
        "choose_parts_desc": "I already own a base and only want to add the body parts.",
        "choose_soon": "Coming soon",

        # --- founder ---
        "founder_back": "Back to “About us”",
        "founder_eyebrow": "Layer Instruments",
    },
}


# ---------------------------------------------------------------------------
# JS-Strings (an das Frontend als window.I18N uebergeben).
# ---------------------------------------------------------------------------
JS = {
    "de": {
        "filaments_show_all": "Alle {n} Filamente anzeigen",
        "filaments_show_less": "Weniger anzeigen",
        "form_sending": "Senden …",
        "form_error_generic": "Etwas ist schiefgelaufen. Bitte später erneut versuchen.",
        "form_error_network": "Verbindung fehlgeschlagen. Bitte später erneut versuchen.",
        "price_locale": "de-DE",
    },
    "en": {
        "filaments_show_all": "Show all {n} filaments",
        "filaments_show_less": "Show less",
        "form_sending": "Sending …",
        "form_error_generic": "Something went wrong. Please try again later.",
        "form_error_network": "Connection failed. Please try again later.",
        "price_locale": "en-IE",
    },
}


# ---------------------------------------------------------------------------
# Server-Antworttexte der Formular-Endpunkte.
# ---------------------------------------------------------------------------
API = {
    "de": {
        "invalid_email": "Bitte gib eine gültige E-Mail-Adresse ein.",
        "consent_required": "Bitte bestätige die Einwilligung.",
        "newsletter_ok": "Danke! Wir melden uns, sobald es losgeht.",
        "fields_required": "Bitte fülle alle Felder aus, dann klappt's mit der Post.",
        "interest_ok": "Danke für dein Interesse! Wir halten dich auf dem Laufenden.",
        "supporter_ok": "Danke! Wir melden uns, wenn es was zu erzählen gibt.",
    },
    "en": {
        "invalid_email": "Please enter a valid email address.",
        "consent_required": "Please confirm your consent.",
        "newsletter_ok": "Thanks! We'll be in touch as soon as we launch.",
        "fields_required": "Please fill in all fields so the mail can reach you.",
        "interest_ok": "Thanks for your interest! We'll keep you posted.",
        "supporter_ok": "Thanks! We'll get in touch when there's news to share.",
    },
}


# ---------------------------------------------------------------------------
# Overlays fuer die Konfigurator-Optionen (nur die uebersetzbaren Felder).
# Gruppen-Label je Sprache; Farb-/Produktnamen wie "Silk Blue Magenta" bleiben
# als Eigennamen unveraendert. name/desc nur dort, wo deutscher Text steckt.
# ---------------------------------------------------------------------------
OPTION_LABELS = {
    "de": {
        "body": "Korpus · Dual-Color-Filament",
        "metal_brand": "Metallteile",
        "hardware": "Farbe der Metallteile",
        "pickups": "Pick-Ups",
        "potis": "Potentiometer",
        "neck": "Hals",
    },
    "en": {
        "body": "Body · Dual-Color Filament",
        "metal_brand": "Metal Parts",
        "hardware": "Metal Parts Color",
        "pickups": "Pickups",
        "potis": "Potentiometers",
        "neck": "Neck",
    },
}

# Pro Choice-ID: uebersetzte name/desc. Nur Eintraege mit deutschem Text.
OPTION_CHOICES = {
    "en": {
        "drparts": {"name": "Dr. Parts: Rosewood",
                    "desc": "Solid standard neck made of rosewood."},
        "whitestork": {"desc": "Premium maple neck · Indian rosewood fretboard · 20 frets · clear high-gloss nitro finish."},
        "chrome": {"name": "Chrome"},
        "black": {"name": "Black"},
        "gold": {"name": "Gold"},
    },
    "de": {},   # Original ist bereits Deutsch
}


# ---------------------------------------------------------------------------
# Team: role + facts je Sprache (Name/Bild bleiben gleich).
# ---------------------------------------------------------------------------
TEAM = {
    "en": {
        "perotin": {
            "role": "Co-founder of Layer Instruments",
            "facts": [
                "Born in Vorarlberg, Austria",
                "Lives in Graz",
                "Studies industrial design at FH Joanneum Graz",
                "Hobby drummer",
            ],
        },
        "clemens": {
            "role": "Co-founder of Layer Instruments",
            "facts": [
                "Born in Vorarlberg, Austria",
                "Lives in Berlin",
                "Studies rail vehicle engineering at TU Berlin",
                "Hobby bassist",
            ],
        },
    },
}
