# Pazi! Ispit — web verzija

Web verzija Android aplikacije [`pazi-ispit`](https://github.com/dzenanramic/pazi-ispit).
Radi u browseru na telefonu, instalira se na početni ekran i radi i offline.

- **Lista ispita** sa odbrojavanjem dana, sortirana tako da je najbliži uvijek prvi
- **Dodavanje i izmjena** ispita uz predlaganje predmeta koje već koristiš
- **Štoperica za učenje** — biraš za koji ispit učiš, sesije se pamte
- **Bez baze i bez naloga** — sve se čuva u `localStorage`, na uređaju

## Kako se koristi

Otvori URL, pa "Dodaj na početni ekran" (Chrome/Android) ili "Dodaj na početni ekran"
(Safari/iPhone). Otvara se bez adresne trake, poput prave aplikacije.

> **Bitan detalj o `localStorage`-u:** podaci su vezani za **preglednik i uređaj**.
> Lista ispita na tvom telefonu i na supruginom su odvojene. Ako se jednom predomisliš
> i zatreba zajednička lista, dorada je lagana — vidi "Sljedeći koraci" na kraju.

## Pokretanje lokalno

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit + UI testovi
npm run build    # produkcijski build u dist/
npm run lint
```

## Deploy na Vercel

Najlakše preko GitHub-a:

1. `git init && git add . && git commit -m "Pazi! Ispit web"` u ovom folderu
2. Napravi prazan repozitorij na GitHub-u i pushaj
3. Na [vercel.com/new](https://vercel.com/new) izaberi taj repo → Vercel sam prepozna Vite
4. Deploy. Link dobiješ za pola minute.

Ili iz terminala: `npx vercel --prod`

`vercel.json` u root-u već podešava build, SPA rewrite (da osvježavanje na bilo kojoj
putanji radi) i keširanje statičnih fajlova.

## Šta je preuzeto iz Android verzije, a šta je popravljeno

Preuzeto 1:1:
- struktura podataka (ispiti `{ id, name, date }`), sortiranje po datumu, `<ime> za N dana`
- brisanje ispita uz potvrdu
- lista predloga predmeta i upisivanje velikog početnog slova

Popravljeno u odnosu na original:
- broj dana se računa po kalendarskim danima, ne po satima (u originalu ispit **danas**
  nije pokazivao 0 dana nakon podneva; datum je išao kroz UTC pa se mogao prikazati dan ranije)
- brisanje ispita sada ide kroz isti izvor stanja kao prikaz, pa lista ne može
  pokazati već obrisani ispit
- štoperica mjeri stvarno proteklo vrijeme (u originalu `+100ms` na interval, što
  laže kad telefon uspava ekran), može se pauzirati, i sesije se pamte
- test suite za datume, čuvanje podataka i glavne tokove u UI-u

## Struktura

```
src/
  App.tsx                 # ekrani: lista i učenje
  lib/
    date.ts               # datumi, "za N dana", sedmica/mjesec
    storage.ts            # tipovi, localStorage, toleriše pokvarene podatke
    store.ts              # akcije + hookovi (useSyncExternalStore)
    useStudyTimer.ts      # štoperica otporna na uspavljivanje ekrana
    useTodayKey.ts        # "danas" koji se sam promijeni u ponoć
  components/
    ExamCard.tsx  ExamSheet.tsx  DateField.tsx  StudyTimer.tsx  Icons.tsx
  styles.css              # cijeli dizajn sistem (svjetla i tamna tema)
public/
  sw.js                   # offline keš
  manifest.webmanifest  icons/
```

Podaci: jedan ključ `pazi-ispit:v1` u `localStorage`, sadržaj
`{ version, exams[], sessions[], seenSubjects[] }`. Ako se format promijeni, dovoljno je
podići verziju u ključu i dodati migraciju u `parseData()`.

## Sljedeći koraci (ako zatreba)

- **Zajednička lista za oboje** — uz Supabase (free tier) ista struktura odlazi u jednu
  tabelu; `lib/store.ts` je jedino mjesto koje se mijenja.
- **Izvezi / uvezi** — JSON fajl ili QR kod, da podaci prelaze između telefona bez baze.
- **Notifikacije** — web push za "ispit je za dva dana".
