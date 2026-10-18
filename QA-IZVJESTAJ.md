# QA izvještaj — Pazi! Ispit (web)

Datum: 19. 10. 2026.
Opseg: dodavanje/izmjena ispita, kalendar, lista, štoperica, brisanje i vraćanje,
offline rad, tamna tema, desktop i telefon (portret + pejzaž), pristupačnost.

## Sažetak

Prijavljeni problem — **modal za ispit se skroluje na monitoru** — je potvrđen i
popravljen. Uzrok je bio što se kalendar otvarao unutar modala i gurao sadržaj
preko `max-height` granice, a `sticky` dugmad su prekrivala donji dio kalendara.
Sada se na desktopu otvoreni kalendar prikazuje **u drugom stupcu**, a na telefonu
u kompaktnom obliku; ni mjesec sa šest redova ni greška validacije ne uvode skrol.

Osim toga nađeno je i popravljeno nekoliko ozbiljnijih grešaka: dvostruki klik je
dodavao isti ispit dvaput, „Vrati“ je trajno gubio sesije učenja, štoperica je
gubila započeto vrijeme pri povratku na listu, a browser „nazad“ je izlazio iz
aplikacije.

## Kako je testirano

- **Playwright (Chromium)** na 14 veličina ekrana:
  desktop 1920×1080, 1440×900, 1280×800, 1024×768, 1024×600, 800×600;
  tablet 768×1024;
  telefon 390×844, 360×640, 320×568;
  pejzaž 844×390, 812×375, 667×375, 568×320.
- Svjetla i tamna tema (`prefers-color-scheme`).
- Mjesec sa **pet i šest redova** (oktobar/novembar 2026) i stanje sa greškom
  validacije.
- Produkcijski build + service worker: ponovno učitavanje **offline** sa podacima
  u `localStorage`.
- Vitest/Testing Library: 52 testa.
- Ručna provjera fokusa, tastature, `Escape`, Tab ciklusa i čitača ekrana
  (ARIA atributi).

Reprodukcija: `npm run dev`, pa `python3 qa/verify.py` (potreban Python
Playwright). Skripta pada sa exit kodom 1 ako bilo koja provjera ne prođe.

## Pronađene i popravljene greške

| # | Težina | Problem | Status |
|---|--------|---------|--------|
| 1 | visoka | Modal za ispit se skroluje na desktopu kada se otvori kalendar; mjesec sa šest redova posebno. Donje prečice kalendara su bile sakrivene ispod `sticky` dugmadi. | popravljeno |
| 2 | visoka | Dvostruki klik na „Dodaj ispit“ ili dva brza Entera dodaju isti ispit dva puta. | popravljeno |
| 3 | visoka | „Vrati“ nakon brisanja vraća ispit, ali ne i njegove sesije učenja — vrijeme se trajno gubi. | popravljeno |
| 4 | visoka | Prelazak sa štoperice na listu i nazad vraća vrijeme na `00:00:00`. | popravljeno |
| 5 | srednja | Donje dugme „Započni učenje“ prebacuje izabrani ispit na najbliži, iako je sesija već u toku. | popravljeno |
| 6 | srednja | Browser/sistemsko „nazad“ sa ekrana učenja izlazi iz aplikacije umjesto da vrati listu. | popravljeno |
| 7 | srednja | Fokus nije ostajao u modalima, a nakon zatvaranja nije vraćan na dugme koje ih je otvorilo. Dijalog „Obriši sve“ nije reagovao na `Escape` i nije zaključavao skrol. | popravljeno |
| 8 | srednja | Lista predloga je ostajala otvorena nakon prelaska na datum; svi predlozi su bili u Tab redu. | popravljeno |
| 9 | srednja | U tamnoj temi ikona pauze je bila bijela na svijetloj podlozi (kontrast 1,99:1), a primarna dugmad, izabrani datum i „danger“ dugmad takođe nedovoljno čitljivi. | popravljeno |
| 10 | srednja | Sekundarni tekst u svjetloj temi imao je kontrast 3,30–3,66:1; placeholder 4,28:1. | popravljeno |
| 11 | srednja | Štoperica je nudila samo prva četiri predstojeća ispita. | popravljeno |
| 12 | niska | Veoma dugi nazivi ispita razvlačili su karticu i „Sljedeće“ blok na više redova. | popravljeno (dva reda + pun naziv u `title`) |
| 13 | niska | Prazna lista i podnožje su se preklapali sa donjim „dock“-om na kratkim telefonima (360×640). | popravljeno |
| 14 | niska | Mjesec „avgust“ je na kartici bio skraćen kao `AVG` umjesto `AUG`. | popravljeno |
| 15 | niska | Štoperica je pisala „pauza“ i prije nego što je uopšte pokrenuta. | popravljeno („spremno“) |
| 16 | niska | `Escape` u otvorenom kalendaru je zatvarao cijeli modal, a ne samo kalendar. | popravljeno |
| 17 | niska | Na telefonu su se u kalendaru ponavljali datum i polje datuma, trošeći visinu. | popravljeno (kompaktni prikaz + „Gotovo“) |
| 18 | niska | „Učenje danas“ nije uključivalo sesiju koja je upravo u toku. | popravljeno |
| 19 | niska | Manifest je zaključavao aplikaciju na portret, iako je pejzaž sada podržan. | popravljeno |
| 20 | niska | Combobox i segmenat „Sedmica/Mjesec“ nisu imali potpunu ARIA semantiku; greška validacije nije bila povezana sa poljem. | popravljeno |

## Modal: prije i poslije

Izmjereno kao `scrollHeight − clientHeight` na `.sheet` (0 = nema skrola):

| Ekran | Prije — sedmica | Prije — mjesec | Poslije |
|-------|-----------------|----------------|---------|
| 1440×900 | 9 px | 222 px | 0 px (i šest redova: 0 px) |
| 1280×800 | 25 px | 238 px | 0 px (i šest redova: 0 px) |
| 390×844 | 0 px | 72 px | 0 px (i šest redova: 0 px) |
| 360×640 | 73 px | 206 px | 0 px (i šest redova: 0 px) |
| 320×568 | 119 px | — | 0 px (i šest redova: 0 px) |
| 844×390 (pejzaž) | 405 px | — | 0 px (i šest redova: 0 px) |

Rješenje:

- **Desktop ≥ 800 px:** kada je kalendar otvoren, dijalog se širi na do 900 px i
  koristi dva stupca — forma lijevo, kalendar desno. Visina više ne zavisi od
  dužine forme.
- **Telefon:** fioka koristi skoro cijelu vidljivu visinu (`100dvh`), kalendar je
  kompaktan, a dok je otvoren sklanja se ponovljeni natpis/polje datuma. Dugme
  **Gotovo** vraća polje datuma i fokus.
- **Pejzaž:** dva stupca i posebno kompaktne dimenzije za niske ekrane.
- **Mjesec sa šest redova** i **greška validacije** su uključeni u regresijske
  provjere, jer su ranije bili najgori slučajevi.

## Vizuelna poboljšanja

- Desktop dijalog sa dva stupca djeluje namjerno, umjesto rastegnute forme.
- Kalendar ima kompaktnije ćelije na telefonu i u pejzažu; prečice „Danas“,
  „Za sedmicu/mjesec“ i „Gotovo“ su uvijek vidljive.
- Dugmad u tamnoj temi sada imaju tamnu tintu na svijetlim akcentima (čitljivost),
  a svjetla tema ima tamniji sekundarni tekst.
- Prazno stanje je kompaktnije na niskim ekranima, pa se podnožje i „dock“ ne
  preklapaju.
- Nazivi ispita se skraćuju na dva reda, uz pun naziv u `title` i formi.
- Štoperica prikazuje sve predstojeće ispite, ima jasnije stanje („spremno“) i
  uključuje tekuće vrijeme u „Učenje danas“.
- Ispravljena je skraćenica mjeseca (`AUG`) i ARIA semantika comboboxa,
  segmenata i greške validacije.

## Preostala ograničenja (nije popravljeno)

1. **Nesačuvana sesija štoperice ne preživi osvježavanje/zatvaranje stranice.**
   Prelazak između ekrana je popravljen, ali podaci o tekućoj sesiji nisu
   perzistentni. Preporuka: `sessionStorage` ili IndexedDB uz oprez pri prelasku
   ponoći.
2. **Reset štoperice nema potvrdu.** Slučajan dodir na „Reset“ briše izmjereno
   vrijeme. Preporuka: potvrda ili „poništi“ toast kada je > 1 min.
3. **Kružni progres štoperice se resetuje svakih sat vremena** (`elapsed % 3600`).
   Nije greška ako je to namjerno, ali može zbuniti; bolje prikazati sate ili
   ukupni cilj.
4. **Nema ručnog unosa datuma** (samo kalendar). Namjerno, ali nedostaje za
   tastaturu orijentisane korisnike.
5. **Ekstremno mali pejzaž (npr. 480×320)** još zahtijeva skrol u mjesečnom
   prikazu; podržani pejzaž počinje od 560 px širine.
6. **Nema dijeljene liste** — podaci su po pregledniku/uređaju, kako README i
   navodi. Za dijeljenje je potreban backend (Supabase i sl.).
7. **Google Fonts se učitavaju sa mreže.** Offline rad je potvrđen nakon prvog
   online učitavanja; za potpuno samostalan offline build fontove treba
   self-hostovati.
8. **Nema ekrana sa historijom sesija/statistikom** po ispitu — postoji samo
   ukupno vrijeme.

## Verifikacija

```
npm test          # 52 testa, svi prolaze
npm run lint      # 0 upozorenja, 0 grešaka
npm run build     # uspješan produkcijski build
python3 qa/verify.py
# Sve provjere su prošle (14 veličina ekrana + tamna tema).
```

Offline provjera: produkcijski build, service worker aktivan, mreža isključena,
stranica se ponovo učita sa sačuvanim ispitom — bez grešaka u konzoli.

Slike završnog stanja su u `qa/shots/`:
`final-1440x900-month-six-rows.png`, `final-390x844-month-six-rows.png`,
`final-360x640-month-six-rows.png`, `final-844x390-month-six-rows.png`,
`final-tablet-768-month-six.png`,
`final-dark-phone-month-six-rows.png`.
