import Icon from '../components/Icon.jsx';
import { LOGO_MAIN } from '../components/Logo.jsx';
import { navigate } from '../App.jsx';
import { useTranslation, SUPPORTED_LANGUAGES } from '../lib/i18n.js';
import { useSession } from '../lib/session.jsx';

const LANGUAGES = [
  { id: 'English', label: 'English', sub: 'English' },
  { id: 'Hindi', label: 'हिंदी', sub: 'Hindi' },
  { id: 'Kannada', label: 'ಕನ್ನಡ', sub: 'Kannada' },
];

export default function Splash() {
  const t = useTranslation();
  const { appLanguage, setAppLanguage } = useSession();

  return (
    <main className="min-h-screen max-w-md mx-auto px-gutter-lg py-gutter-xl flex flex-col items-center justify-center text-center gap-gutter-lg bg-light-surface">
      <div className="p-gutter-sm rounded-full bg-light-secondary-container">
        <img src={LOGO_MAIN} alt="ASHA Sathi logo" className="w-32 h-32 rounded-full object-cover border-2 border-light-outline-variant bg-light-surface-container-lowest" />
      </div>

      <div className="flex flex-col items-center gap-gutter-xs max-w-xs">
        <h1 className="font-display text-display-lg-mobile text-light-primary">ASHA Sathi</h1>
        <p className="font-body text-body-md text-light-on-surface text-pretty">
          {t('splashQuote')}
        </p>
      </div>

      {/* Language Selection at the starting / main page */}
      <section className="w-full max-w-xs flex flex-col gap-gutter-xs bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-md text-left">
        <div className="flex items-center gap-gutter-xs text-light-primary mb-1">
          <Icon name="translate" className="text-[20px]" />
          <h2 className="font-label text-label-md font-bold">{t('chooseLanguage')}</h2>
        </div>

        <div className="flex flex-col gap-gutter-xs" role="radiogroup" aria-label={t('chooseLanguage')}>
          {LANGUAGES.map((lang) => {
            const isSelected = appLanguage === lang.id;
            return (
              <button
                key={lang.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setAppLanguage(lang.id)}
                className={`w-full min-h-12 px-gutter-md py-gutter-xs rounded-sm border flex items-center justify-between transition-all duration-state-change ease-state-change cursor-pointer ${
                  isSelected
                    ? 'bg-light-secondary-container border-2 border-light-primary text-light-on-secondary-container shadow-sm'
                    : 'bg-light-surface-container-low border-light-outline-variant text-light-on-surface hover:bg-light-surface-container-lowest'
                }`}
              >
                <div className="flex items-center gap-gutter-sm">
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-light-primary bg-light-primary' : 'border-light-outline bg-transparent'
                  }`}>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-light-surface-container-lowest" />}
                  </span>
                  <span className="font-title text-title-md font-semibold">{lang.label}</span>
                </div>
                <span className="font-body text-body-sm text-light-on-surface-variant">{lang.sub}</span>
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={() => navigate('login')}
        className="w-full max-w-xs min-h-14 px-gutter-lg rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm transition-colors duration-state-change ease-state-change hover:bg-light-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-primary"
      >
        <span>{t('loginToServe')}</span>
        <Icon name="arrow_forward" className="text-[20px]" />
      </button>
    </main>
  );
}
