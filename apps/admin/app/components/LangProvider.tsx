'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import type { Lang } from '../../lib/i18n'
import { t as translate, type TranslationKey } from '../../lib/i18n'

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'id', setLang: () => {}
})

export function LangProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = (l: Lang) => {
    setLangState(l)
    document.cookie = `lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}`
  }

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}

export function useT() {
  const { lang } = useLang()
  return (key: TranslationKey) => translate(key, lang)
}

export function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <button
      onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200
                 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
      title={lang === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
    >
      <span className="text-sm">{lang === 'id' ? '🇮🇩' : '🇬🇧'}</span>
      <span>{lang === 'id' ? 'ID' : 'EN'}</span>
    </button>
  )
}
