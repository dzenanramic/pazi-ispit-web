import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY, emptyData } from './lib/storage';
import { refreshFromStorage, resetStore } from './lib/store';
import { todayISO } from './lib/date';

const SETTINGS = {
  studyMinutes: 1,
  restMinutes: 1,
  soundEnabled: false,
  autoStartBreaks: false,
  autoStartStudies: false,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 19, 12, 0, 0));
  localStorage.clear();
  resetStore(emptyData());
  localStorage.setItem('pazi-pomodoro-settings', JSON.stringify(SETTINGS));
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...emptyData(),
      exams: [{ id: 'a', name: 'Anatomija', date: todayISO(), createdAt: 0 }],
    }),
  );
  refreshFromStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Pomodoro kroz ekrane', () => {
  it('preživi odlazak na listu i upiše sesiju na kraju faze', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Započni učenje/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pomodoro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Započni učenje' }));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // Kraj faze učenja: odmor čeka, a sesija je upisana.
    expect(document.querySelector('.timer__phase-label')).toHaveTextContent('Odmor');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0]).toMatchObject({ examId: 'a', seconds: 60 });

    // Odlazak na listu i povratak ne smiju isključiti Pomodoro.
    fireEvent.click(screen.getByRole('button', { name: /Ispiti/ }));
    fireEvent.click(screen.getByRole('button', { name: /Započni učenje/ }));

    expect(screen.getByRole('button', { name: 'Pomodoro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(document.querySelector('.timer__phase-label')).toHaveTextContent('Odmor');
    expect(screen.getByText('00:01:00')).toBeInTheDocument();
  });
});
