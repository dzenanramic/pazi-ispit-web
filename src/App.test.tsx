import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY, emptyData } from './lib/storage';
import { addDays, formatLong, todayISO } from './lib/date';
import { refreshFromStorage, resetStore } from './lib/store';

beforeEach(() => {
  localStorage.clear();
  resetStore(emptyData());
  document.body.style.overflow = '';
});

/** Kartica ispita u listi (ime se pojavljuje i u naslovu "Sljedeće"). */
const examCard = (name: string) => screen.getByRole('button', { name: `Uredi ispit ${name}` });

/**
 * Dugme datuma ima naziv "19. oktobar 2026. danas". Naziv se računa iz
 * današnjeg datuma, da test ne bi padao prvog dana drugog mjeseca.
 */
const dateToggleName = () =>
  new RegExp(formatLong(todayISO()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

async function addExam(user: ReturnType<typeof userEvent.setup>, name: string, offsetDays: number) {
  await user.click(screen.getByRole('button', { name: 'Novi ispit' }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText('Predmet'), name);

  // Kalendar je prema zadanim postavkama na današnjem danu; za drugi datum
  // odabiremo konkretan dan po aria-labelu.
  if (offsetDays !== 0) {
    await user.click(within(dialog).getByRole('button', { name: /danas/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Mjesec' }));
    const target = addDays(todayISO(), offsetDays);
    const [y, m] = target.split('-').map(Number);
    // Pomeri kalendar na ciljni mjesec (max 1 klik za naše testove).
    if (m !== new Date().getMonth() + 1 || y !== new Date().getFullYear()) {
      await user.click(within(dialog).getByRole('button', { name: 'Sljedeći mjesec' }));
    }
    await user.click(within(dialog).getByRole('button', { name: formatLong(target) }));
  }
  await user.click(within(dialog).getByRole('button', { name: 'Dodaj ispit' }));
  // Sačekaj da se fioka zaista zatvori (animacija je 160ms), kao u stvarnom UI-u.
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

describe('Pazi! Ispit — tok korisnika', () => {
  it('prikazuje prazno stanje kad nema ispita', () => {
    render(<App />);
    expect(screen.getByText('Prazna lista')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dodaj ispit/ })).toBeInTheDocument();
  });

  it('dodaje ispit i pamti ga u localStorage-u', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addExam(user, 'anatomija', 0);

    // Predmet se automatski piše velikim početnim slovom.
    expect(examCard('Anatomija')).toBeInTheDocument();
    expect(screen.getByText('Anatomija je danas')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.exams).toHaveLength(1);
    expect(stored.exams[0]).toMatchObject({ name: 'Anatomija', date: todayISO() });
    // Naučeni predmet ulazi u listu za autocomplete.
    expect(stored.seenSubjects).toContain('Anatomija');
  });

  it('dodaje ispit za datum izabran u mjesečnom kalendaru', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addExam(user, 'Fiziologija', 5);

    expect(examCard('Fiziologija')).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.exams[0].date).toBe(addDays(todayISO(), 5));
  });

  it('mijenja naziv ispita kroz formu za uređivanje', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addExam(user, 'Anatomija', 0);

    await user.click(examCard('Anatomija'));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText('Predmet');
    await user.clear(input);
    await user.type(input, 'Patologija');
    await user.click(within(dialog).getByRole('button', { name: 'Sačuvaj' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(examCard('Patologija')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Uredi ispit Anatomija' })).not.toBeInTheDocument();
  });

  it('briše sve podatke iz dijaloga za potvrdu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addExam(user, 'Anatomija', 0);

    await user.click(screen.getByRole('button', { name: 'Obriši sve' }));
    const alert = screen.getByRole('alertdialog');
    await user.click(within(alert).getByRole('button', { name: 'Obriši sve' }));
    await act(() => new Promise(resolve => setTimeout(resolve, 50)));

    expect(screen.getByText('Prazna lista')).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.exams).toHaveLength(0);
    expect(stored.sessions).toHaveLength(0);
  });

  it('prikazuje ispit iz localStorage-a nakon ponovnog učitavanja', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...emptyData(),
        exams: [{ id: 'x', name: 'Fiziologija', date: addDays(todayISO(), 5), createdAt: 0 }],
      }),
    );
    // U aplikaciji se ovo dešava pri prvom renderu ili preko `storage` događaja
    // iz druge kartice; u testu eksplicitno primjenjujemo stanje sa diska.
    refreshFromStorage();
    render(<App />);
    expect(examCard('Fiziologija')).toBeInTheDocument();
    // Naslov iznad liste uvijek pokazuje najbliži rok.
    expect(screen.getByText(/Fiziologija je za 5 dana/)).toBeInTheDocument();
  });

  it('sabira vrijeme učenja za današnji dan (regresija: prazno "Učenje danas")', async () => {
    const now = Date.now();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...emptyData(),
        sessions: [
          { id: 's1', examId: null, startedAt: now - 25 * 60_000, endedAt: now, seconds: 1500 },
          { id: 's2', examId: null, startedAt: now - 86_400_000 * 3, endedAt: now - 86_400_000 * 3, seconds: 3600 },
        ],
      }),
    );
    refreshFromStorage();
    render(<App />);
    // Samo današnja sesija se sabira: 25 min, a ne 1h 25min.
    expect(screen.getByText('Učenje danas').parentElement).toHaveTextContent('25 min');
    // Isti broj se vidi i na dugmetu na dnu ekrana.
    expect(screen.getByRole('button', { name: /^Započni učenje/ })).toHaveTextContent('25 min');
  });

  it('briše ispit uz mogućnost vraćanja', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addExam(user, 'Patologija', 0);

    await user.click(screen.getByRole('button', { name: 'Uredi ispit Patologija' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Obriši' }));

    expect(screen.queryByRole('button', { name: 'Uredi ispit Patologija' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).exams).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Vrati' }));
    expect(examCard('Patologija')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).exams).toHaveLength(1);
  });

  it('predlaže predmete dok se kuca', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Novi ispit' }));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText('Predmet');

    await user.type(input, 'ana');
    const options = within(dialog).getAllByRole('option');
    expect(options.map(o => o.textContent)).toContain('Anatomija');

    // Enter bira označeni predlog, ne dodaje ispit.
    await user.keyboard('{ArrowDown}{Enter}');
    expect(input).toHaveValue('Anatomija');
  });

  it('ne dodaje ispit bez naziva', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Novi ispit' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj ispit' }));
    expect(screen.getByText('Upiši naziv predmeta.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('zatvara fioku na Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Novi ispit' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await act(() => new Promise(r => setTimeout(r, 200)));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('upozorava kad browser ne može sačuvati podatke', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Simuliraj pun localStorage (npr. privatni mod / potpuno pun prostor).
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    try {
      await addExam(user, 'Radiologija', 0);
    } finally {
      spy.mockRestore();
    }
    expect(screen.getByRole('alert')).toHaveTextContent(/ne mogu sačuvati/);
  });

  it('prelazi na timer i mjeri učena sesija', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addExam(user, 'Hirurgija', 0);

    await user.click(screen.getByRole('button', { name: /Započni učenje/ }));
    expect(screen.getByRole('heading', { name: 'Učenje' })).toBeInTheDocument();
    expect(screen.getByText('00:00:00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Započni učenje' }));
    expect(screen.getByRole('button', { name: 'Pauza' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pauza' }));
    expect(screen.getByRole('button', { name: 'Započni učenje' })).toBeInTheDocument();

    // Nazad na listu — ispit i dalje tu.
    await user.click(screen.getByRole('button', { name: /Ispiti/ }));
    expect(examCard('Hirurgija')).toBeInTheDocument();
  });

  it('ne gubi započeto vrijeme kad se vratiš na listu ispita', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addExam(user, 'Hirurgija', 0);

    await user.click(screen.getByRole('button', { name: /Započni učenje/ }));
    await user.click(screen.getByRole('button', { name: 'Započni učenje' }));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });
    await user.click(screen.getByRole('button', { name: /Ispiti/ }));
    await user.click(screen.getByRole('button', { name: /Započni učenje/ }));

    // Štoperica je i dalje u toku, a vrijeme nije vraćeno na nulu.
    expect(screen.getByRole('button', { name: 'Pauza' })).toBeInTheDocument();
    expect(screen.queryByText('00:00:00')).not.toBeInTheDocument();
  });

  it('vraća i sesije učenja kad vratiš obrisani ispit', async () => {
    const now = Date.now();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...emptyData(),
        exams: [{ id: 'x', name: 'Patologija', date: todayISO(), createdAt: 0 }],
        sessions: [
          { id: 's1', examId: 'x', startedAt: now - 60_000, endedAt: now, seconds: 60 },
        ],
      }),
    );
    refreshFromStorage();

    const user = userEvent.setup();
    render(<App />);

    await user.click(examCard('Patologija'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Obriši' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).sessions).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Vrati' }));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.exams).toHaveLength(1);
    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0]).toMatchObject({ examId: 'x', seconds: 60 });
  });

  it('zadržava fokus unutar dijaloga i vraća ga na dugme koje ga je otvorilo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addExam(user, 'Anatomija', 0);

    const trigger = screen.getByRole('button', { name: 'Novi ispit' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog');
    // Sa zadnjeg elementa Tab ide na prvi, a Shift+Tab sa prvog na zadnji.
    const close = within(dialog).getByRole('button', { name: 'Zatvori' });
    const submit = within(dialog).getByRole('button', { name: 'Dodaj ispit' });
    submit.focus();
    fireEvent.keyDown(submit, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(submit);

    await user.keyboard('{Escape}');
    await act(() => new Promise(resolve => setTimeout(resolve, 200)));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('zatvara dijalog za brisanje na Escape i vraća fokus', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addExam(user, 'Anatomija', 0);

    const trigger = screen.getByRole('button', { name: 'Obriši sve' });
    await user.click(trigger);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(document.activeElement).toBe(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Odustani' }),
    );

    await user.keyboard('{Escape}');
    await act(() => new Promise(resolve => setTimeout(resolve, 50)));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('sklanja listu predloga kad fokus ode na datum', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Novi ispit' }));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText('Predmet');

    await user.type(input, 'ana');
    expect(within(dialog).getAllByRole('option').length).toBeGreaterThan(0);

    await user.tab();
    expect(within(dialog).queryByRole('listbox')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: dateToggleName() }));
  });

  it('Escape prvo zatvara kalendar, a ne cijeli dijalog', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Novi ispit' }));
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: dateToggleName() }));
    expect(within(dialog).getByRole('group', { name: 'Kalendar' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(within(dialog).queryByRole('group', { name: 'Kalendar' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ne dodaje isti ispit dvaput na dvostruki klik ili dvostruki Enter', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Novi ispit' }));
    let dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Predmet'), 'Anatomija');
    const submit = within(dialog).getByRole('button', { name: 'Dodaj ispit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Novi ispit' }));
    dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Predmet'), 'Fiziologija{Enter}{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.exams.map((e: { name: string }) => e.name)).toEqual(['Anatomija', 'Fiziologija']);
  });

  it('nudi sve predstojeće ispite u štoperici, ne samo prva četiri', async () => {
    const exams = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`,
      name: `Predmet ${i + 1}`,
      date: addDays(todayISO(), i + 1),
      createdAt: i,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyData(), exams }));
    refreshFromStorage();

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Započni učenje/ }));

    expect(within(screen.getByRole('listbox', { name: 'Odaberi ispit' })).getAllByRole('option')).toHaveLength(6);
  });

  it('ne mijenja izabrani ispit kad se timer otvori preko donjeg dugmeta', async () => {
    const exams = [
      { id: 'a', name: 'Anatomija', date: todayISO(), createdAt: 0 },
      { id: 'f', name: 'Fiziologija', date: addDays(todayISO(), 3), createdAt: 1 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyData(), exams }));
    refreshFromStorage();

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Uči Fiziologija' }));
    const list = screen.getByRole('listbox', { name: 'Odaberi ispit' });
    expect(within(list).getByRole('option', { name: /Fiziologija/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /Ispiti/ }));
    await user.click(screen.getByRole('button', { name: /Započni učenje/ }));

    // "Dock" otvara timer, ali ne smije prebaciti na najbliži ispit.
    expect(
      within(screen.getByRole('listbox', { name: 'Odaberi ispit' })).getByRole('option', {
        name: /Fiziologija/,
      }),
    ).toHaveAttribute('aria-selected', 'true');
  });
});
