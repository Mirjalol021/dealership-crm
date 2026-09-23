import { useTranslation } from 'react-i18next';
import { setLanguage, type Language } from '../i18n';

const LANGS: { code: Language; label: string }[] = [
  { code: 'uz', label: "O'z" },
  { code: 'ru', label: 'Ру' },
  { code: 'en', label: 'En' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div className="lang-switch">
      {LANGS.map((l) => (
        <button
          key={l.code}
          className={i18n.language === l.code ? 'active' : ''}
          onClick={() => setLanguage(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
