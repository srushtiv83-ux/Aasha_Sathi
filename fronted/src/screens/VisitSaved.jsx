import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { consumeDemoCorrection, navigate } from '../App.jsx';

const TASKS = [
  { title: 'Re-check temperature', sub: 'Today · 6:00 PM · Call or visit' },
  { title: 'Advise ORS & paracetamol', sub: 'Shared with family during visit' },
  { title: 'PHC check if fever lasts', sub: 'Tomorrow · 9:00 AM' },
];

export default function VisitSaved() {
  const [correctionNote] = useState(consumeDemoCorrection);

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col justify-between bg-light-surface">
      <header className="px-page-margin pt-gutter-lg pb-gutter-md bg-confirmed-container text-on-confirmed-container flex items-center gap-gutter-sm">
        <Icon name="check_circle" className="text-[32px]" fill />
        <div className="flex flex-col">
          <span className="font-label text-label-sm">Demo visit confirmed · not synced</span>
          <h1 className="font-display text-headline-lg">Visit saved (demo)</h1>
        </div>
      </header>

      <main className="flex-1 px-page-margin py-gutter-lg flex flex-col gap-gutter-lg">
        <article className="w-full bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md flex flex-col gap-gutter-sm">
          <header className="flex items-center justify-between gap-gutter-sm">
            <h2 className="font-title text-title-md text-light-on-surface">Meera Devi (28 yrs)</h2>
            <span className="font-mono text-mono-md text-light-on-surface-variant tabular-nums">10:42 AM</span>
          </header>
          <div className="flex flex-col gap-gutter-xs">
            <p className="font-body text-body-md text-light-on-surface-variant">
              Temperature 101.4°F · Fever for 2 days · BP 116/74 mmHg · No danger signs.
            </p>
          </div>
        </article>

        {correctionNote && (
          <article className="w-full bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md">
            <h2 className="font-title text-title-md text-light-on-surface">Correction note (demo)</h2>
            <p className="font-body text-body-md text-light-on-surface-variant mt-gutter-xs">{correctionNote}</p>
            <p className="font-body text-body-md text-light-on-surface-variant mt-gutter-xs">This note does not update clinical measurements or sync to a patient record.</p>
          </article>
        )}

        <section className="flex flex-col gap-gutter-sm">
          <div className="flex items-center justify-between gap-gutter-sm">
            <h2 className="font-headline text-headline-md text-light-on-surface">Follow-up actions</h2>
            <span className="font-label text-label-sm text-light-primary">3 tasks created</span>
          </div>

          <div className="flex flex-col gap-gutter-sm">
            {TASKS.map((t) => (
              <label key={t.title} className="bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md flex items-center gap-gutter-sm cursor-pointer">
                <input type="checkbox" className="w-5 h-5 rounded-sm text-light-primary border-light-outline shrink-0" />
                <div className="flex flex-col gap-gutter-xs">
                  <span className="font-title text-title-md text-light-on-surface">{t.title}</span>
                  <span className="font-body text-body-md text-light-on-surface-variant">{t.sub}</span>
                </div>
              </label>
            ))}
          </div>
        </section>
      </main>

      <footer className="px-page-margin py-gutter-md bg-light-surface-container-lowest border-t border-light-outline-variant">
        <button type="button" onClick={() => navigate('dashboard')} className="w-full min-h-14 px-gutter-lg rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm">
          <Icon name="home" className="text-[22px]" />
          <span>Back to dashboard</span>
        </button>
      </footer>
    </div>
  );
}
