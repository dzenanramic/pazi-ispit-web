import { act, render, screen, within } from '@testing-library/react';
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

async function addExam(user: ReturnType<typeof userEvent.setup>, name: string, offsetDays: number) {
  await user.click(screen.getByRole('button', { name: 'Novi ispit' }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText('Predmet'), name);

  // Kalendar je prema zadanim postavkama na današnjem danu; za drugi datum
  // odabiremo konkretan dan po aria-labelu.
  if (offsetDays !== 0) {
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
});
