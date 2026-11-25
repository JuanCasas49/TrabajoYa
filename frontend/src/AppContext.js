
import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, fetchRegions, setRegion, setToken } from './api';
import { dict, detectLang, LANGS, setLocale } from './i18n';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const CATEGORIES = [
  'cleaning',
  'construction',
  'electricity',
  'gardening',
  'painting',
  'plumbing'
];

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState(detectLang());
  const [regions, setRegions] = useState([]);
  const [region, setRegionState] = useState(null);
  const [categories, setCategories] = useState(CATEGORIES);

  const loadCategories = () =>
    api('/meta')
      .then((m) => setCategories(m.categories))
      .catch(() => {});

  const refreshRegions = () =>
    fetchRegions()
      .then(setRegions)
      .catch(() => {});

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [manual, savedRegion, raw] = await Promise.all([
          AsyncStorage.getItem('lang'),
          AsyncStorage.getItem('region'),
          AsyncStorage.getItem('session')
        ]);

        if (manual && LANGS.includes(manual)) {
          setLangState(manual);
        }

        const list = await fetchRegions().catch(() => []);

        if (!mounted) return;

        setRegions(list);

        // Priorizar la región guardada si sigue disponible.
        // Si no existe, seleccionar Colombia automáticamente.
        // Como alternativa, utilizar otra región activa.
        const selected =
          list.find((r) => r.code === savedRegion && r.up) ||
          list.find((r) => r.code === 'CO' && r.up) ||
          list.find((r) => r.up) ||
          null;

        if (selected) {
          setRegion(selected.code);
          setRegionState(selected.code);

          await AsyncStorage.setItem('region', selected.code);

          if (!manual) {
            setLangState(selected.lang || 'es');
          }

          if (raw) {
            try {
              const session = JSON.parse(raw);

              setToken(session.token);

              try {
                const currentUser = await api('/auth/me');
                if (mounted) setUser(currentUser);
              } catch {
                setToken(null);
                await AsyncStorage.removeItem('session');
              }
            } catch {
              setToken(null);
              await AsyncStorage.removeItem('session');
            }
          }

          loadCategories();
        } else {
          setRegion(null);
          setRegionState(null);
          setToken(null);
        }
      } catch (error) {
        console.error('Error inicializando TrabajoYa:', error);
      } finally {
        if (mounted) setReady(true);
      }
    })();

    const id = setInterval(() => {
      refreshRegions();
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const selectRegion = async (code) => {
    const selected = regions.find(
      (r) => r.code === code && r.up
    );

    if (!selected) return;

    setRegion(code);
    setRegionState(code);

    await AsyncStorage.setItem('region', code);

    if (!(await AsyncStorage.getItem('lang'))) {
      setLangState(selected.lang || 'es');
    }

    loadCategories();
  };

  const login = async (data) => {
    setToken(data.token);
    setUser(data.user);

    await AsyncStorage.setItem(
      'session',
      JSON.stringify({ token: data.token })
    );
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem('session');
  };

  const setLang = async (l) => {
    setLangState(l);
    await AsyncStorage.setItem('lang', l);
  };

  setLocale(lang);

  const t = (k) => dict[lang]?.[k] ?? dict.es[k] ?? k;

  const regionInfo =
    regions.find((r) => r.code === region) || null;

  return (
    <Ctx.Provider
      value={{
        user,
        ready,
        lang,
        setLang,
        t,
        login,
        logout,
        regions,
        region,
        regionInfo,
        selectRegion,
        refreshRegions,
        categories
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
