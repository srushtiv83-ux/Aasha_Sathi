import { useTranslation } from '../lib/i18n.js';

export type VoiceCaptureState = 'idle' | 'recording' | 'transcribing';

type VoiceCaptureButtonProps = {
  state: VoiceCaptureState;
  onActivate: () => void;
  disabled?: boolean;
};

export default function VoiceCaptureButton({
  state,
  onActivate,
  disabled = false,
}: VoiceCaptureButtonProps) {
  const t = useTranslation();

  const presentation: Record<VoiceCaptureState, { icon: string; label: string; caption: string }> = {
    idle: {
      icon: 'mic',
      label: t('voiceTapToSpeak'),
      caption: t('voiceTapStart'),
    },
    recording: {
      icon: 'graphic_eq',
      label: t('voiceStopRecording'),
      caption: t('voiceListeningNow'),
    },
    transcribing: {
      icon: 'hourglass_top',
      label: t('voiceTranscribing'),
      caption: t('voicePreparingDraft'),
    },
  };

  const { icon, label, caption } = presentation[state];

  return (
    <div className={`voice-capture voice-capture--${state}`}>
      <div className="voice-capture__stage">
        <span className="voice-capture__halo" aria-hidden="true" />
        <span className="voice-capture__halo voice-capture__halo--delayed" aria-hidden="true" />
        <button
          type="button"
          aria-label={state === 'recording' ? t('voiceStopVisitRecording') : label}
          aria-pressed={state === 'recording'}
          onClick={onActivate}
          disabled={disabled || state === 'transcribing'}
          className="voice-capture__button"
        >
          <span className="material-symbols-outlined voice-capture__icon" aria-hidden="true">
            {icon}
          </span>
          <span className="voice-capture__label">{label}</span>
        </button>
      </div>
      <p className="voice-capture__caption" aria-live="polite">
        {caption}
      </p>
    </div>
  );
}
