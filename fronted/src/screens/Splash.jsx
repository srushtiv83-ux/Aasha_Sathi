import Icon from '../components/Icon.jsx';
import { LOGO_MAIN } from '../components/Logo.jsx';
import { navigate } from '../App.jsx';

export default function Splash() {
  return (
    <main className="min-h-screen max-w-md mx-auto px-gutter-lg py-gutter-xl flex flex-col items-center justify-center text-center gap-gutter-lg bg-light-surface">
      <div className="p-gutter-sm rounded-full bg-light-secondary-container">
        <img src={LOGO_MAIN} alt="ASHA Sathi logo" className="w-36 h-36 rounded-full object-cover border-2 border-light-outline-variant bg-light-surface-container-lowest" />
      </div>

      <div className="flex flex-col items-center gap-gutter-sm max-w-xs">
        <h1 className="font-display text-display-lg-mobile text-light-primary">ASHA Sathi</h1>
        <p className="font-body text-body-lg text-light-on-surface text-pretty">
          “Every doorstep is a promise of care; every voice heard is a life protected.”
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate('login')}
        className="w-full max-w-xs min-h-14 px-gutter-lg rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm transition-colors duration-state-change ease-state-change hover:bg-light-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-primary"
      >
        <span>Login to serve humanity</span>
        <Icon name="arrow_forward" className="text-[20px]" />
      </button>
    </main>
  );
}
