import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import ru from '../locales/ru.json';
import uz from '../locales/uz.json';

export type Language = 'uz' | 'ru' | 'en';

const stored = (localStorage.getItem('crm_lang') as Language | null) ?? 'uz';

i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: stored,
  fallbackLng: 'uz',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: Language): void {
  localStorage.setItem('crm_lang', lang);
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export default i18n;
