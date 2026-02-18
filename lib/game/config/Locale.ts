import { ko } from './locales/ko'
import { en } from './locales/en'

export type Language = 'en' | 'ko'

const strings: Record<Language, any> = {
    en, ko
}

export let currentLang: Language = 'ko'

export function setLanguage(lang: Language) {
    currentLang = lang
}

export function t(path: string): string {
    const keys = path.split('.')
    let current: any = strings[currentLang]
    for (const key of keys) {
        if (current === undefined || current[key] === undefined) return path
        current = current[key]
    }
    return current
}
