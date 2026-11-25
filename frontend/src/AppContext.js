import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, fetchRegions, setRegion, setToken } from './api';
import { dict, detectLang, LANGS, setLocale } from './i18n';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
const CATEGORIES = ['cleaning', 'construction', 'electricity', 'gardening', 'painting', 'plumbing'];

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState(detectLang());
  const [regions, setRegions] = useState([]);
  const [region, setRegionState] = useState(null);
  const [categories, setCategories] = useState(CATEGORIES);

  const loadCategories = () => api('/meta').then((m) => setCategories(m.categories)).catch(() => {});
  const refreshRegions = () => fetchRegions().then(setRegions).catch(() => {});

  useEffect(() => {
    (async () => {
      try {
        const [manual, savedRegion, raw] = await Promise.all([
          AsyncStorage.getItem('lang'), AsyncStorage.getItem('region'), AsyncStorage.getItem('session')]);
        if (manual && LANGS.includes(manual)) setLangState(manual);
        const list = await fetchRegions().catch(() => []);
        setRegions(list);
        const code = savedRegion && list.some((r) => r.code === savedRegion) ? savedRegion : null;
        if (code) {
          setRegion(code); setRegionState(code);
          if (!manual) setLangState(list.find((r) => r.code === code).lang);
          if (raw) {
            const s = JSON.parse(raw);
            setToken(s.token);
            try { setUser(await api('/auth/me')); } catch { setToken(null); await AsyncStorage.removeItem('session'); }
          }
          loadCategories();
        }
      } finally { setReady(true); }
    })();
    const id = setInterval(refreshRegions, 15000);
    return () => clearInterval(id);
  }, []);

  // El país elegido fija la región (API + BD + moneda) y propone su idioma si el usuario no eligió otro
  const selectRegion = async (code) => {
    setRegion(code); setRegionState(code);
    await AsyncStorage.setItem('region', code);
    if (!(await AsyncStorage.getItem('lang'))) setLangState(regions.find((r) => r.code === code)?.lang || 'es');
    loadCategories();
  };
  const login = async (data) => {
    setToken(data.token); setUser(data.user);
    await AsyncStorage.setItem('session', JSON.stringify({ token: data.token }));
  };
  const logout = async () => { setToken(null); setUser(null); await AsyncStorage.removeItem('session'); };
  const setLang = async (l) => { setLangState(l); await AsyncStorage.setItem('lang', l); };

  setLocale(lang);
  const t = (k) => dict[lang]?.[k] ?? dict.es[k] ?? k;
  const regionInfo = regions.find((r) => r.code === region) || null;

  return (
    <Ctx.Provider value={{ user, ready, lang, setLang, t, login, logout, regions, region, regionInfo, selectRegion, refreshRegions, categories }}>
      {children}
    </Ctx.Provider>
  );
}
