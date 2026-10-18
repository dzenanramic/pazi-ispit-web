"""
Regresijski QA za fioku "Novi ispit".

Provjerava da forma staje bez skrolovanja na desktopu, telefonu i u pejzažu,
uključujući mjesec sa šest redova i stanje sa greškom validacije.

Pokretanje (zahtijeva Python Playwright i pokrenut `npm run dev` na 5173):
    python3 qa/verify.py

Slike se čuvaju u qa/shots/.
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:5173/"
OUT = "qa/shots"

SIZES = [
    (1920, 1080, False),
    (1440, 900, False),
    (1280, 800, False),
    (1024, 768, False),
    (1024, 600, False),
    (800, 600, False),
    (768, 1024, False),
    (390, 844, True),
    (360, 640, True),
    (320, 568, True),
    (844, 390, True),
    (812, 375, True),
    (667, 375, True),
    (568, 320, True),
]

failures = []


def check(condition, message):
    if not condition:
        failures.append(message)
        print(f"FAIL  {message}")
    else:
        print(f"ok    {message}")


def sheet_metrics(page):
    return page.evaluate(
        """() => {
        const sheet = document.querySelector('.sheet');
        const dateActions = document.querySelector('.datefield__actions');
        const sheetActions = document.querySelector('.sheet__actions');
        const a = dateActions?.getBoundingClientRect();
        const b = sheetActions?.getBoundingClientRect();
        const overlaps = !!a && !!b && !(
          a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom
        );
        return {
          overflow: sheet.scrollHeight - sheet.clientHeight,
          width: Math.round(sheet.getBoundingClientRect().width),
          formDisplay: getComputedStyle(document.querySelector('.sheet__form')).display,
          toggleHidden: getComputedStyle(document.querySelector('.datefield__toggle')).display === 'none',
          dateActionsOverlap: overlaps,
          sixRows: document.querySelectorAll('.datefield__row').length === 6,
        };
      }"""
    )


def open_sheet(page):
    page.get_by_role("button", name="Novi ispit").click()
    page.wait_for_timeout(350)
    check(page.locator('[role="dialog"]').count() == 1, "dijalog se otvara")


def open_calendar(page):
    page.locator(".datefield__toggle").click()
    page.wait_for_timeout(150)


def shoot(page, name):
    page.screenshot(path=f"{OUT}/{name}.png")


def run_case(browser, width, height, mobile, errors):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        is_mobile=mobile,
        has_touch=mobile,
        device_scale_factor=2 if mobile else 1,
    )
    page = context.new_page()
    page.on("pageerror", lambda exc: errors.append(f"{width}x{height}: {exc}"))
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(300)

    label = f"{width}x{height}"
    open_sheet(page)

    base = sheet_metrics(page)
    check(base["overflow"] <= 1, f"{label}: zatvoren kalendar staje ({base['overflow']}px)")

    open_calendar(page)
    week = sheet_metrics(page)
    check(week["overflow"] <= 1, f"{label}: sedmica staje ({week['overflow']}px)")
    check(not week["dateActionsOverlap"], f"{label}: prečice sedmice nisu prekrivene")

    page.get_by_role("button", name="Mjesec").click()
    page.wait_for_timeout(100)
    month = sheet_metrics(page)
    check(month["overflow"] <= 1, f"{label}: mjesec staje ({month['overflow']}px)")
    check(not month["dateActionsOverlap"], f"{label}: prečice mjeseca nisu prekrivene")

    # Novembar 2026. ima šest sedmica — najviši mogući kalendar.
    page.get_by_role("button", name="Sljedeći mjesec").click()
    page.wait_for_timeout(150)
    six = sheet_metrics(page)
    check(six["sixRows"], f"{label}: prikazan mjesec sa šest redova")
    check(six["overflow"] <= 1, f"{label}: mjesec sa šest redova staje ({six['overflow']}px)")
    check(not six["dateActionsOverlap"], f"{label}: prečice šestorednog mjeseca nisu prekrivene")

    if width >= 800 and height >= 560:
        check(six["formDisplay"] == "grid", f"{label}: desktop koristi dva stupca")
        check(six["width"] > 620, f"{label}: desktop dijalog je proširen ({six['width']}px)")
    if width < 800:
        check(six["toggleHidden"], f"{label}: polje datuma je sklonjeno dok je kalendar otvoren")

    # Greška validacije dodaje još jedan red — i tada ne smije biti skrola.
    page.get_by_role("dialog").get_by_role("button", name="Dodaj ispit").click()
    page.wait_for_timeout(200)
    invalid = sheet_metrics(page)
    check(invalid["overflow"] <= 1, f"{label}: greška validacije ne uvodi skrol ({invalid['overflow']}px)")

    # "Gotovo" vraća polje datuma; Escape zatvara cijeli dijalog.
    page.get_by_role("button", name="Gotovo").click()
    page.wait_for_timeout(150)
    check(page.locator(".datefield__panel").count() == 0, f"{label}: \"Gotovo\" zatvara kalendar")
    check(page.locator(".datefield__toggle").is_visible(), f"{label}: polje datuma se vraća")

    page.keyboard.press("Escape")
    page.wait_for_timeout(250)
    check(page.locator('[role="dialog"]').count() == 0, f"{label}: Escape zatvara dijalog")

    if label in {"1440x900", "390x844", "360x640", "844x390"}:
        # Ponovo otvori za konačnu sliku sa šestorednim mjesecom.
        open_sheet(page)
        open_calendar(page)
        page.get_by_role("button", name="Mjesec").click()
        page.wait_for_timeout(100)
        page.get_by_role("button", name="Sljedeći mjesec").click()
        page.wait_for_timeout(150)
        shoot(page, f"final-{label}-month-six-rows")

    context.close()


def run_dark(browser, errors):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        is_mobile=True,
        has_touch=True,
        device_scale_factor=2,
        color_scheme="dark",
    )
    page = context.new_page()
    page.on("pageerror", lambda exc: errors.append(f"dark: {exc}"))
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(250)
    open_sheet(page)
    open_calendar(page)
    page.get_by_role("button", name="Mjesec").click()
    page.wait_for_timeout(100)
    page.get_by_role("button", name="Sljedeći mjesec").click()
    page.wait_for_timeout(150)
    dark = sheet_metrics(page)
    check(dark["overflow"] <= 1, f"tamna tema: mjesec staje ({dark['overflow']}px)")
    shoot(page, "final-dark-phone-month-six-rows")
    context.close()


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page_errors = []
    for width, height, mobile in SIZES:
        run_case(browser, width, height, mobile, page_errors)
    run_dark(browser, page_errors)
    browser.close()

check(not page_errors, f"nema grešaka u konzoli: {page_errors}")

print()
if failures:
    print(f"{len(failures)} provjera nije prošlo.")
    sys.exit(1)
print(f"Sve provjere su prošle ({len(SIZES)} veličina ekrana + tamna tema).")
