# QA izvještaj 2 — dubinska revizija

Datum: 19. 10. 2026.
Opseg: svi tokovi iz prvog izvještaja + **Pomodoro modul** (u prvom izvještaju
nije bio pokriven), štoperica, pristupačnost, PWA/offline, testna infrastruktura.
Nalazi ispod su prvo zabilježeni kao revizija, a zatim **svi visoki (H) i
srednji (M) nalazi popravljeni** — status i verifikacija su u poglavlju
„Popravke“ na kraju.

## Sažetak

Osnovna aplikacija (ispiti, kalendar, brisanje/vraćanje, offline, tamna tema,
responzivnost) je u dobrom stanju. Novi Pomodoro modul ima **grupaciju ozbiljnih
grešaka u upravljanju stanjem** i praktično je netestiran.

| Oblast | Stanje |
|---|---|
| Ispiti, kalendar, sortiranje, undo, offline | dobro |
| Tamna tema, raspored na 14 veličina ekrana | dobro |
| Pristupačnost glavnih dijaloga | dobro |
| **Pomodoro (faze, pauza, čuvanje, odlazak sa ekrana)** | **6 visokih grešaka** |
| Pristupačnost novih Pomodoro dijaloga | 3 nalaza |
| Testovi | 52/52 prolazi, ali datumi su hardkodirani; Pokrivenost `StudyTimer` 34,5 % |

## Baseline (prije popravki)

```
npm test             52/52 prolazi (~10 s)
npm run build        prolazi (tsc + vite)
npm run lint         2 upozorenja (oba u StudyTimer.tsx)
npm audit            0 ranjivosti
python3 qa/verify.py sve provjere prolaze (14 veličina + tamna tema)
offline reload       prolazi (SW aktivan, ispit sačuvan)
coverage             76,91 % naredbi / 78,69 % linija
                     StudyTimer 35,66 % naredbi / 34,48 % linija
axe-core             home: 0; timer/kalendar/podešavanja: 1–3 (light); 1 (dark)
```

Dodatno provjereno Playwright-om sa kontrolisanim satom (`page.clock`) i
produkcijskim buildom:

- prelaz faze učenja/odmora, auto-start, brojanje ciklusa
- pauza/nastavak, „Sačuvaj“ i „Reset“ usred faze
- odlazak na listu ispita i povratak
- uključivanje/isključivanje Pomodora poslije proteklog vremena
- promjena trajanja dok je faza pauzirana
- više faza zaredom (praćenje `AudioContext` instanci)
- ponoć, dvije kartice, offline, neispravni podaci u `localStorage`
- axe-core (WCAG 2.0/2.1 A + AA) na svim ekranima i dijalozima

## Visoki nalazi

### H1. Vrijeme učenja se gubi na kraju Pomodoro faze

`handlePhaseComplete` poziva `timer.reset()` i **ne upisuje sesiju**. Cijela
faza učenja (npr. 30 min) nestaje, a brojač ciklusa se ipak poveća.

- Dokaz: Pomodoro 1 min → poslije 65 s faza je „Odmor“, ciklusa 1,
  `sessions: []`.
- Lokacija: `src/components/StudyTimer.tsx:144–173` (`timer.reset()` na 152).
- Popravka: prije `reset()` pozvati `addSession({ examId, startedAt, endedAt, seconds })`
  za fazu učenja; odmor nikad ne upisivati kao učenje.

### H2. „Sačuvaj“ i „Reset“ usred faze trajno pokvare Pomodoro

`save()` koristi `timer.take()`, a `take()` **zaustavlja štopericu**. Prikazani
countdown se nastavlja jer visi o `phaseEndTime`, ali `timer.elapsed` ostaje 0,
pa se faza više nikad ne završi. Prsten se resetuje, a sat nastavi da se
smanjuje — dva prikaza istog stanja se razilaze.

- Dokaz: 10 s učenja → „Sačuvaj“ → `sessions: [10]`, sat `00:00:50`, prsten
  na 100 %. Poslije još 55 s sat je `00:00:00`, faza je i dalje „Učenje“,
  bez ciklusa; ni poslije dodatnih 10 s faza ne prelazi.
- „Reset“ usred faze: sat se zamrzne na `00:00:40` i tako ostane i poslije 65 s.
- Lokacija: `StudyTimer.tsx:130–142` (`save`), `:365` i `:415` (`reset`),
  `:102` (`phaseEndTime`).
- Popravka: u Pomodoro modu „Sačuvaj“ mora ili nastaviti fazu (bez `take()` koji
  zaustavlja) ili resetovati i fazu; „Reset“ mora resetovati i `phaseEndTime`
  ili biti onemogućen tokom faze. Najbolje: jedna funkcija `resetPhase()`.

### H3. Odlazak na listu ispita isključi Pomodoro i izgubi fazu

`StudyTimer` se montira samo na ekranu učenja (`App.tsx:277–292`), a
`pomodoroEnabled`, `currentPhase`, `phaseEndTime` i `completedCycles` su
lokalno stanje te komponente (`StudyTimer.tsx:99–103`). Povratak na listu
unmountuje komponentu: Pomodoro se tiho isključi, ciklusi se izgube, a
countdown postane obična štoperica. Dok je korisnik na listi, faza ne može
ni da se završi (nema zvuka ni prelaza).

- Dokaz: start Pomodora, 5 s, „Ispiti“, pa ponovo „Započni učenje“ →
  `aria-pressed=false`, sat `00:00:05`, nema sažetka ni ciklusa.
- Popravka: podići Pomodoro stanje u `App` (ili u `usePomodoro` hook /
  kontekst) tako da živi dok je aplikacija otvorena; ili držati
  `StudyTimer` montiran i skrivati ga CSS-om.

### H4. Uključivanje/isključivanje Pomodora briše izmjereno vrijeme

- Isključivanje poslije 30 s: `timer.reset()` → `00:00:00`, bez potvrde
  (`StudyTimer.tsx:181–193`).
- Uključivanje poslije 2 min (uz study = 1 min): `phaseEndTime` se postavi
  od sada, ali `elapsed` je već 120 s ≥ 60 s → ista render petlja odmah
  prebaci na „Odmor“ i doda ciklus. Izmjereno vrijeme se izgubi.
- Popravka: ne resetovati `elapsed` pri isključivanju; pri uključivanju
  računati fazu od trenutka uključivanja (nezavisno od `elapsed`) ili
  zahtijevati potvrdu ako je `elapsed > 0`.

### H5. Dva izvora istine za vrijeme faze (`elapsed` vs `phaseEndTime`)

Prikaz koristi `phaseEndTime - Date.now()` (`StudyTimer.tsx:311–315`), a
završetak faze `timer.elapsed >= currentPhaseDuration` (`:128`). Pošto se
`phaseEndTime` ne pomjera pri pauzi/nastavku ni pri promjeni podešavanja,
prikazi se razilaze:

- 10 s učenja → pauza → 30 s pauze → nastavak: sat pokaže `00:00:20`
  umjesto `00:00:50`.
- Promjena trajanja učenja sa 5 na 1 min dok je faza pauzirana: sat i dalje
  pokazuje `00:04:00`, a na nastavak faza odmah pređe na „Odmor“.
- Uključivanje Pomodora poslije 30 s obične štoperice: faza traje 30 s kraće
  od prikazanog countdowna.
- Popravka: jedan izvor istine. Predlog: `phaseEndsAt` (timestamp) + `now` iz
  hooka; `remaining = max(0, phaseEndsAt - now)`; pauza pamti `remaining`,
  nastavak postavlja novi `phaseEndsAt = now + remaining`; završetak se
  okida na `remaining === 0`. `elapsed` koristiti samo za upis sesije.

### H6. `AudioContext` curi na svakoj fazi

`playNotificationSound` pravi **novi** `AudioContext` pri svakom prelazu i
nikad ga ne zatvara (`StudyTimer.tsx:67–92`).

- Dokaz: 10 faza → `{created: 10, closed: 0}`; svi u stanju `running`.
- Rizik: iOS/Safari ograničava broj audio konteksta; poslije nekoliko faza
  zvuk može prestati, a `new AudioContext()` može baciti izuzetak. Pošto
  poziv nije u `try/catch`, izuzetak može prekinuti prelaz faze, a bez error
  boundaryja i srušiti ekran. Uz to, kontekst se pravi van korisničkog
  gestikla i nigdje se ne poziva `resume()`, pa na iOS-u zvuk može biti tiho
  onemogućen.
- Popravka: jedan dijeljeni `AudioContext` (lazy, uz `resume()` u prvom
  korisničkom gestu), zatvaranje na unmount, i `try/catch` oko zvuka da
  prelaz faze nikad ne zavisi od zvuka.

## Srednji nalazi

### M1. Testovi zavise od današnjeg datuma (potvrđen pad)

`src/App.test.tsx` hardkodira `19. oktobar` (linija 344) i `/oktobar/`
(linija 335). Test je pao kad je isti dan pokrenut u zoni
`TZ=Pacific/Kiritimati` (bilo je 20. oktobar):

```
1 failed | 21 passed  → getByRole('button', { name: /19\. oktobar/ })
```

Popravka: `vi.useFakeTimers()` + `vi.setSystemTime(...)` u `beforeEach`, ili
izračunati očekivani naziv kroz `formatLong(todayISO())`. Isto važi za
`qa/verify.py`: provjera „šest redova“ je postala besmislena jer `DateField`
**uvijek** dodaje šest redova (`DateField.tsx:59–66`), pa tvrdnja prolazi za
svaki mjesec. Umjesto broja redova provjeravati da visina kalendara ne skače
između mjeseci sa 5 i 6 sedmica.

### M2. „Učenje danas“ i značka na dnu ne rade dok si na listi

Interval štoperice se vrti samo kad je ekran učenja otvoren
(`App.tsx:40`, `useStudyTimer.ts:25–40`). Ako pokreneš učenje pa se vratiš na
listu, `timer.elapsed` se zamrzne — i pored toga što timer realno radi.

- Dokaz: timer na 3 s → lista pokazuje „manje od minute“; +60 s na listi i
  dalje „manje od minute“.
- Popravka: interval vezati za `running` (ili dodati tihi 1 s interval na
  listi dok je timer pokrenut), a ne za vidljivost ekrana.

### M3. Novi Pomodoro dijalozi nemaju fokus, `Escape` ni zaključavanje skrola

Dijalog za reset (`StudyTimer.tsx:401–419`) i podešavanja (`:421–500`) su
obični `div`-ovi sa `aria-modal`, bez `useDialogFocus`.

- Dokaz: fokus ostaje na dugmetu iza dijaloga; `Escape` ne zatvara ni jedan
  dijalog; Tab može otići na sadržaj ispod; `body.overflow` se ne zaključava.
- Popravka: iskoristiti postojeći `useDialogFocus` (kao u `App` i
  `ExamSheet`), dodati `role="alertdialog"` za reset, početni fokus na
  „Odustani“ i `document.body.style.overflow` obrazac.

### M4. Brojčana polja u podešavanjima nemaju pristupačan naziv

`<label class="field__label">Trajanje učenja</label>` nije povezan sa
`<input>` (nema `htmlFor`/`id`, nije omotač). axe: **critical** —
„Form elements must have labels“ za oba polja (`StudyTimer.tsx:438–461`).

### M5. Kontrast ispod WCAG AA (axe, ozbiljno)

| Element | Kontrast | Uslov |
|---|---|---|
| `.chip__date` (neaktivni chip, svijetla tema) | 3,09:1 | 4,5:1 |
| `.chip__date` (aktivni chip, tamna tema) | 3,12:1 | 4,5:1 |
| `.timer__mode-btn.is-active` (Pomodoro) | 4,33:1 | 4,5:1 |
| `.datefield__weekdays span` (svijetla tema) | 3,32:1 | 4,5:1 |

Lokacije: `src/styles.css:1721`, `:1986–1990`, `:2041–2044`.
Popravka: podići `opacity`/boju datuma na chipu, koristiti `--ink-2` za
neaktivni datum; za aktivni chip u tamnoj temi tamni tekst pune
neprozirnosti; za aktivno Pomodoro dugme tamniji akcenat ili bijeli tekst;
weekday zaglavlja na `--ink-3`.

### M6. Vrijeme odmora se upisuje kao učenje

Ako se klikne „Sačuvaj“ tokom odmora, u `sessions` ide sesija sa trajanjem
odmora (dokaz: 10 s odmora → `sessions: [10]`) i ulazi u „Danas“/„Ukupno“.
Popravka: u fazi odmora onemogućiti čuvanje ili čuvati odvojen tip sesije.

### M7. Neispravni datumi prolaze validaciju

`isExam` provjerava samo regex `^\d{4}-\d{2}-\d{2}$` (`storage.ts:83–92`),
pa `2026-02-31` i `2026-13-01` ulaze u stanje.

- Dokaz: kartica „31 FEB“ uz „utorak, 03.03.2026.“ i „−230 dana“; za
  `2026-13-01` datumski blok ostane bez mjeseca, a meta pokaže 01.01.2027.
- Popravka: round-trip provjera `toISODate(fromISODate(date)) === date`;
  uz to provjeriti `seconds >= 0` i `examId` tip u `isSession`.

### M8. Podešavanja Pomodora se ne validiraju pri učitavanju

`loadSettings` radi `{ ...DEFAULT, ...JSON.parse(stored) }` bez provjere
(`StudyTimer.tsx:47–57`). Sa `"studyMinutes": "abc"` i `"restMinutes": null`
sat pokaže **`NaN:NaN:NaN`**, a sažetak „Učenjeabc min / Odmor min“. Ako je
vrijednost 0 i uključen auto-start, prelaz faze može ući u petlju.
Popravka: normalizovati na broj, zaokružiti i klampovati (`1–120`, `1–60`),
zanemariti nepoznate tipove.

### M9. Podešavanja se mogu mijenjati dok je faza pauzirana

Dugme je onemogućeno samo kada `pomodoroEnabled && timer.running`
(`StudyTimer.tsx:274`). Dok je faza pauzirana, promjena trajanja ostavlja
stari `phaseEndTime`; na nastavak faza odmah prelazi (dokaz: 5 → 1 min,
sat i dalje `00:04:00`, pa skok na „Odmor“). Popravka: onemogućiti izmjenu
dok je faza aktivna (i pauzirana), ili nakon izmjene resetovati fazu.

### M10. Lint nije čist, suprotno prvom izvještaju

`npm run lint` daje 2 upozorenja, oba u novom kodu:

- `react(purity)`: `Date.now()` u renderu (`StudyTimer.tsx:312`) — upravo
  uzrok H5.
- `react(set-state-in-effect)`: `handlePhaseComplete()` u efektu
  (`StudyTimer.tsx:175–179`).

`QA-IZVJESTAJ.md:131` tvrdi „0 upozorenja, 0 grešaka“; to više nije tačno.
Popravka: izračunati preostalo vrijeme iz stanja hooka (ne `Date.now()` u
renderu) i prelaz faze raditi u događaju/izvedenom stanju, ne u efektu.

### M11. `useSortedExams` nije memoizovan

```ts
return useCallback(() => sortExams(exams), [exams])();
```

`useCallback` vraća funkciju, ali se ona poziva na svakom renderu, pa
`sortExams` i filtriranja u `App`/`StudyTimer` rade 4×/s dok timer radi.
Popravka: `useMemo(() => sortExams(exams), [exams, today])`. Ako se doda
`today`, riješi se i rub ponoći u `StudyTimer` (`upcoming` se ne osvježi
poslije ponoći jer zavisi samo od `exams`).

### M12. Pokrivenost najkompleksnije komponente je najniža

`StudyTimer.tsx` (503 linije, cijeli Pomodoro) ima 34,48 % linija i nema
nijedan test. Ukupno: 78,69 % linija. Prvi izvještaj navodi 52 testa, ali
Pomodoro nije među njima — zato su H1–H6 prošli neopaženo.

## Niski nalazi i poboljšanja

1. **„Za mjesec“ dodaje 30 dana, ne jedan mjesec** (`DateField.tsx:213–218`):
   26.10. → 25.11. Koristiti `shiftMonth(value, 1)`.
2. **Copy greške**: „Ponistiti učenje?“, dugme „Ponisti“ (nedostaje „š“;
   ispravno „Poništi“), „Automatski pokreni odmora“ → „odmor“
   (`StudyTimer.tsx:411, 415, 479`).
3. **„Ukupno: <ispit>“ se skraćuje na 320 px** („UKUPNO: INTERN…“)
   (`styles.css:2187–2195`). Predlog: naziv ispita u drugi red ili kraća
   oznaka „Ukupno“.
4. **Kartica ispita ne izgovara datum ni broj dana**: `aria-label` na
   glavnom dugmetu (`ExamCard.tsx:26–31`) zamjenjuje sav unutrašnji tekst,
   pa čitač ekrana čuje samo „Uredi ispit X“. Dodati datum i „za N dana“ u
   naziv ili ukloniti `aria-label` i ostaviti vidljivi tekst.
5. **Nekorišćene ikone**: `IconCog`, `IconVolume`, `IconVolumeOff`,
   `IconCalendar`, `IconTrash` (`Icons.tsx:78–156`) — mrtav kod.
6. **Duplikat CSS bloka** `.timer__pomodoro-summary` (`styles.css:2011` i
   `:2047`) — identična dva bloka.
7. **README i prvi QA izvještaj su zastarjeli**: README ne spominje Pomodoro,
   podešavanja, `useKeyboard.ts`, `useDialogFocus.ts` ni `qa/`; QA izvještaj
   ne pokriva Pomodoro i tvrdi čist lint.
8. **Nema CI-ja**: nema GitHub Actions za `lint` + `tsc` + `test` + `build`.
   Nema `engines` u `package.json`, nema skripte `test:coverage`, nema
   `typecheck`.
9. **Service worker**: `CACHE = 'pazi-ispit-v1'` se nikad ne mijenja
   (`public/sw.js:10`), a stari heširani asseti se ne brišu na `activate` —
   keš raste sa svakim deployem. Predlog: ime keša sa build hash-om i
   čišćenje starih assetа.
10. **Google Fonts preko `@import`** (`styles.css:12`) blokira prvi render
    i traži mrežu; offline je potvrđen samo nakon prvog online učitavanja.
    Self-hostovati fontove za potpuno offline build.
11. **Tekuća sesija ne preživi osvježavanje/zatvaranje** (poznato
    ograničenje iz prvog izvještaja). Predlog: čuvati
    `{ startedAt, accumulated, examId }` na `visibilitychange`/`pagehide`,
    vratiti pri učitavanju i dodati `beforeunload` upozorenje.
12. **Nema izvoza/uvoza, zajedničke liste, historije sesija, notifikacija**
    (README „Sljedeći koraci“) — i dalje otvoreno.
13. **Pomodoro nema upozorenje kad je tab u pozadini**: interval je
    usporen, faza se završi tek pri povratku; nema `Notification`,
    vibracije ni wake locka.
14. **`role="listbox"` za izbor ispita nema strelice**: opcije su dugmad,
    ali strelice ne rade (`StudyTimer.tsx:339–355`). Dodati roving tabindex
    ili koristiti grupu dugmadi bez `listbox` role.
15. **Nema ograničenja dužine naziva ispita** — veoma dug naziv se skraćuje
    u kartici, ali ulazi u podatke i u naziv dugmadi.
16. **`parseData` ne deduplikuje `seenSubjects`** i ne provjerava
    `createdAt`; `isSession` ne provjerava `examId` ni negativne sekunde.
17. **Dvostruki `undo` ne postoji**: dva brisanja u roku od 6 s — vraća se
    samo posljednje. Nije greška, ali je korisnički gubitak.
18. **Nema ručnog izbora teme** (samo `prefers-color-scheme`) i nema
    `aria-live` najave promjene faze za korisnike bez zvuka.

## Šta je urađeno dobro

- Datumi su rješeni pažljivo: lokalna ponoć, bez UTC parsiranja, testovi za
  DST i prelaz mjeseca (`date.ts`, 97 % pokrivenosti).
- Tolerantno parsiranje `localStorage`-a ne ruši aplikaciju; `save()` vraća
  `false` i UI upozori kad upis ne uspije.
- Glavni dijalozi (`ExamSheet`, „Obriši sve“) imaju fokus-trap, `Escape`,
  vraćanje fokusa i zaključan skrol — `useDialogFocus` je solidan.
- Ispravljene su ranije greške: dvostruki submit, gubitak sesija pri
  „Vrati“, gubitak vremena pri prelasku ekrana, browser „nazad“.
- Nema horizontalnog prelivanja na 320/390/1280 px; offline reload radi;
  dvije kartice se sinhronizuju; nema grešaka u konzoli; `npm audit` čist.

## Predloženi redoslijed popravki

Sve tačke osim 7 i 9 su urađene u ovom prolazu (vidi „Popravke“); 7 i 9
ostaju kao sljedeći koraci.

| # | Popravka | Težina | Status |
|---|---|---|---|
| 1 | Jedan izvor istine za Pomodoro fazu (`phaseEndsAt` + `remaining`), završetak na `remaining === 0` | M | urađeno |
| 2 | Auto-upis sesije učenja na kraju faze; nikad odmor | S | urađeno |
| 3 | Podići Pomodoro stanje u `App`/hook da preživi odlazak sa ekrana | M | urađeno |
| 4 | Definisati „Sačuvaj“/„Reset“/uključivanje/isključivanje bez gubitka vremena (`resetPhase`, potvrde) | M | urađeno |
| 5 | Jedan `AudioContext`, `resume()`, `close()`, `try/catch` | S | urađeno |
| 6 | `useDialogFocus` + labele + kontrast za nove dijaloge | S | urađeno |
| 7 | Persistirati tekuću sesiju + `beforeunload` | M | ostaje |
| 8 | Ukloniti datumsku zavisnost testova, dodati Pomodoro testove sa lažnim satom | M | urađeno |
| 9 | CI (lint, tsc, test, build), `engines`, `test:coverage` | S | ostaje |
| 10 | Validacija datuma/sesija, `useMemo` u `useSortedExams`, copy i sitnice | S | urađeno |

## Popravke (19. 10. 2026)

### Šta je promijenjeno

- **Novi `useStudyTimer` je jedan hook za štopericu i Pomodoro** i živi u
  `App`-u. Faza ima svoj brojač `remainingMs`; `elapsed` je odvojeno vrijeme
  sesije učenja. Time su H1–H5 riješeni u korijenu, a ne zakrpljeni.
- **Kraj faze učenja automatski upisuje sesiju**, pa se više ne gubi 25/30
  minuta rada. Odmor se nikad ne upisuje.
- **„Sačuvaj“ upisuje dio sesije i nastavlja fazu**; „Reset“ zaustavlja i
  vraća fazu na punu dužinu (uz postojeću potvrdu).
- **Pomodoro preživljava odlazak na listu ispita**; faza se završi i tamo,
  a značka „Učenje danas“ se osvježava dok timer radi.
- **Jedan dijeljeni `AudioContext`** sa `resume()` i `try/catch`; zvuk više
  ne može prekinuti prelaz faze niti curiti po fazi.
- **Reset i podešavanja** koriste `useDialogFocus`: fokus ulazi u dijalog,
  `Escape` zatvara, fokus se vraća, pozadina ne skroluje.
- **Brojčana polja imaju labele**, kontrast je popravljen (chip datum,
  zaglavlja dana, aktivno Pomodoro dugme), a `aria-live` je dodat samo tamo
  gdje ne može da spamuje čitač ekrana.
- **Validacija**: nemogući datumi (`2026-02-31`, `2026-13-01`) i sesije sa
  negativnim trajanjem/pogrešnim `examId` se odbacuju; podešavanja se
  normalizuju (nema više `NaN:NaN:NaN`).
- **`useSortedExams` je stvarno memoizovan** i osvježava se u ponoć;
  `useToday` daje i ključ dana i ISO datum.
- **„Za mjesec“** sada pomjera jedan kalendarski mjesec, ne 30 dana.
- Uklonjen je duplikat CSS bloka, ispravljene copy greške („Poništi“,
  „pokreni odmor“) i `qa/verify.py` sada provjerava **stabilnu visinu**
  kalendara umjesto trivijalnog „šest redova“.

### Verifikacija poslije popravki

```
npm test             68/68 prolazi (13 hook testova + 1 integracioni)
npm run lint         0 upozorenja, 0 grešaka
npm run build        prolazi
TZ=Pacific/Kiritimati npx vitest run src/App.test.tsx   prolazi (22/22)
python3 qa/verify.py sve provjere (uključujući visinu kalendara)
Playwright, lažni sat    43/43 provjere (H1–H6, M2, M3, M4, M6, M8, M9)
axe-core (light/dark)     0 prekršaja na svim ekranima i dijalozima
coverage                  84,7 % linija (useStudyTimer 82,4 %)
```

### Šta je ostalo (nije H/M)

- Persistiranje tekuće sesije i `beforeunload` (tačka 7) — najvrednija
  sljedeća popravka.
- CI, `engines`, `test:coverage` skripta (tačka 9).
- Niski nalazi iz prve liste: izvoz/uvoz, historija sesija, notifikacije,
  wake lock, self-host fontova, verzionisan SW keš, `listbox` strelice,
  ograničenje dužine naziva, čišćenje nekorišćenih ikona.

## Reprodukcija

```bash
npm test
TZ=Pacific/Kiritimati npx vitest run src/App.test.tsx
npm run lint
npm run build
npm run dev &
python3 qa/verify.py
```

Pomodoro scenariji su provjereni Playwright-om sa `page.clock` (1 min
učenje / 1 min odmor) i produkcijskim buildom; skripte i snimci su u
`qa/shots/` (folder je u `.gitignore`).

## Zaključak

Aplikacija za ispite je stabilna i dobro testirana za svoj opseg. Pomodoro
je sada zasnovan na jednom vremenskom modelu, preživljava odlazak na listu,
automatski upisuje učenje i ima testove sa lažnim satom. **H1–H6 i M1–M12
su popravljeni i verifikovani**; preostale preporuke su poboljšanja, ne
greške koje blokiraju korištenje.

