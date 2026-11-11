import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { newId } from '../logic/stats';
import { type CarnetState, EMPTY_STATE, type Herd, type HerdAnimal, type Hunt, type NeedZone, type ReserveId, type SpeciesSheet, type Weapon, type WeaponSheet, type Ammo } from '../logic/types';
import { deleteTrophyPhoto } from '../photos';
import { loadState, saveState } from '../storage';

export type HuntInput = Omit<Hunt, 'id'>;

interface CarnetContextValue {
  state: CarnetState;
  loading: boolean;
  addHunt: (input: HuntInput) => string;
  updateHunt: (id: string, input: HuntInput) => void;
  deleteHunt: (id: string) => void;
  setPlaced: (id: string) => void;
  toggleOwned: (weaponId: string) => void;
  addCustomWeapon: (w: Omit<Weapon, 'id' | 'custom'>) => void;
  removeCustomWeapon: (id: string) => void;
  replaceAll: (state: CarnetState) => void;
  addZone: (z: Omit<NeedZone, 'id'>) => void;
  removeZone: (id: string) => void;
  addHerd: (h: Pick<Herd, 'name' | 'speciesId' | 'reserveId' | 'place' | 'camp'>) => string;
  updateHerd: (id: string, patch: Partial<Omit<Herd, 'id' | 'animals'>>) => void;
  deleteHerd: (id: string) => void;
  addAnimal: (herdId: string, a: Omit<HerdAnimal, 'id' | 'lastSeen' | 'status'>) => void;
  updateAnimal: (herdId: string, animalId: string, patch: Partial<Omit<HerdAnimal, 'id'>>) => void;
  removeAnimal: (herdId: string, animalId: string) => void;
  saveSheet: (speciesId: string, sheet: SpeciesSheet | null) => void;
  setMapUrl: (reserveId: ReserveId, url: string | undefined) => void;
  saveWeaponSheet: (weaponId: string, sheet: WeaponSheet | null) => void;
  saveAmmo: (ammo: Ammo) => void;
  removeAmmoSheet: (ammoId: string) => void;
  toggleOwnedAmmo: (ammoId: string) => void;
  addChoice: (key: string, value: string) => void;
  removeChoice: (key: string, value: string) => void;
  setPrudent: (on: boolean) => void;
}

const CarnetContext = createContext<CarnetContextValue | null>(null);

export function CarnetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CarnetState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);
  // Dernier état connu, pour les effets de bord (suppression de photos) hors des mises à jour d'état.
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    loadState().then((s) => {
      loaded.current = true;
      setState(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loaded.current) saveState(state);
  }, [state]);

  const addHunt = useCallback((input: HuntInput) => {
    const id = newId();
    setState((s) => ({
      ...s,
      hunts: [{ ...input, id }, ...s.hunts],
      lastReserveId: input.reserveId,
      lastWeaponId: input.weaponId,
    }));
    return id;
  }, []);

  const updateHunt = useCallback((id: string, input: HuntInput) => {
    const old = stateRef.current.hunts.find((h) => h.id === id);
    if (old?.photoUri && old.photoUri !== input.photoUri) deleteTrophyPhoto(old.photoUri);
    setState((s) => ({ ...s, hunts: s.hunts.map((h) => (h.id === id ? { ...input, id } : h)) }));
  }, []);

  const deleteHunt = useCallback((id: string) => {
    deleteTrophyPhoto(stateRef.current.hunts.find((h) => h.id === id)?.photoUri);
    setState((s) => ({ ...s, hunts: s.hunts.filter((h) => h.id !== id) }));
  }, []);

  const setPlaced = useCallback((id: string) => {
    setState((s) => ({ ...s, hunts: s.hunts.map((h) => (h.id === id ? { ...h, toPlace: false } : h)) }));
  }, []);

  const toggleOwned = useCallback((weaponId: string) => {
    setState((s) => ({
      ...s,
      ownedWeaponIds: s.ownedWeaponIds.includes(weaponId)
        ? s.ownedWeaponIds.filter((id) => id !== weaponId)
        : [...s.ownedWeaponIds, weaponId],
    }));
  }, []);

  const addCustomWeapon = useCallback((w: Omit<Weapon, 'id' | 'custom'>) => {
    const id = `perso-${newId()}`;
    setState((s) => ({
      ...s,
      customWeapons: [...s.customWeapons, { ...w, id, custom: true }],
      ownedWeaponIds: [...s.ownedWeaponIds, id],
    }));
  }, []);

  const removeCustomWeapon = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      customWeapons: s.customWeapons.filter((w) => w.id !== id),
      ownedWeaponIds: s.ownedWeaponIds.filter((w) => w !== id),
    }));
  }, []);

  const replaceAll = useCallback((next: CarnetState) => setState(next), []);

  const addZone = useCallback((z: Omit<NeedZone, 'id'>) => {
    setState((s) => ({ ...s, needZones: [...s.needZones, { ...z, id: newId() }] }));
  }, []);

  const removeZone = useCallback((id: string) => {
    setState((s) => ({ ...s, needZones: s.needZones.filter((z) => z.id !== id) }));
  }, []);

  const addHerd = useCallback((h: Pick<Herd, 'name' | 'speciesId' | 'reserveId' | 'place' | 'camp'>) => {
    const id = newId();
    const now = new Date().toISOString();
    setState((s) => ({ ...s, herds: [{ ...h, id, animals: [], createdAt: now, lastVisit: now }, ...s.herds] }));
    return id;
  }, []);

  const updateHerd = useCallback((id: string, patch: Partial<Omit<Herd, 'id' | 'animals'>>) => {
    setState((s) => ({ ...s, herds: s.herds.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  }, []);

  const deleteHerd = useCallback((id: string) => {
    setState((s) => ({ ...s, herds: s.herds.filter((h) => h.id !== id) }));
  }, []);

  const addAnimal = useCallback((herdId: string, a: Omit<HerdAnimal, 'id' | 'lastSeen' | 'status'>) => {
    const now = new Date().toISOString();
    setState((s) => ({
      ...s,
      herds: s.herds.map((h) =>
        h.id === herdId ? { ...h, lastVisit: now, animals: [...h.animals, { ...a, id: newId(), status: 'vivant', lastSeen: now }] } : h,
      ),
    }));
  }, []);

  const updateAnimal = useCallback((herdId: string, animalId: string, patch: Partial<Omit<HerdAnimal, 'id'>>) => {
    setState((s) => ({
      ...s,
      herds: s.herds.map((h) =>
        h.id === herdId ? { ...h, animals: h.animals.map((a) => (a.id === animalId ? { ...a, ...patch } : a)) } : h,
      ),
    }));
  }, []);

  const removeAnimal = useCallback((herdId: string, animalId: string) => {
    setState((s) => ({
      ...s,
      herds: s.herds.map((h) => (h.id === herdId ? { ...h, animals: h.animals.filter((a) => a.id !== animalId) } : h)),
    }));
  }, []);

  const saveSheet = useCallback((speciesId: string, sheet: SpeciesSheet | null) => {
    setState((s) => {
      const next = { ...s.speciesSheets };
      if (sheet) next[speciesId] = sheet;
      else delete next[speciesId];
      return { ...s, speciesSheets: next };
    });
  }, []);

  const setMapUrl = useCallback((reserveId: ReserveId, url: string | undefined) => {
    setState((s) => {
      const next = { ...s.mapUrls };
      if (url) next[reserveId] = url;
      else delete next[reserveId];
      return { ...s, mapUrls: next };
    });
  }, []);

  const saveWeaponSheet = useCallback((weaponId: string, sheet: WeaponSheet | null) => {
    const old = stateRef.current.weaponSheets[weaponId]?.photoUri;
    if (old && old !== sheet?.photoUri) deleteTrophyPhoto(old);
    setState((s) => {
      const next = { ...s.weaponSheets };
      if (sheet) next[weaponId] = sheet;
      else delete next[weaponId];
      return { ...s, weaponSheets: next };
    });
  }, []);

  const saveAmmo = useCallback((ammo: Ammo) => {
    const old = stateRef.current.ammoSheets[ammo.id]?.photoUri;
    if (old && old !== ammo.photoUri) deleteTrophyPhoto(old);
    setState((s) => ({ ...s, ammoSheets: { ...s.ammoSheets, [ammo.id]: ammo } }));
  }, []);

  const removeAmmoSheet = useCallback((ammoId: string) => {
    deleteTrophyPhoto(stateRef.current.ammoSheets[ammoId]?.photoUri);
    setState((s) => {
      const next = { ...s.ammoSheets };
      delete next[ammoId];
      return { ...s, ammoSheets: next, ownedAmmoIds: s.ownedAmmoIds.filter((x) => x !== ammoId || !s.ammoSheets[ammoId]?.custom) };
    });
  }, []);

  const toggleOwnedAmmo = useCallback((ammoId: string) => {
    setState((s) => ({
      ...s,
      ownedAmmoIds: s.ownedAmmoIds.includes(ammoId) ? s.ownedAmmoIds.filter((x) => x !== ammoId) : [...s.ownedAmmoIds, ammoId],
    }));
  }, []);

  const addChoice = useCallback((key: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    setState((s) => {
      const list = s.customChoices[key] ?? [];
      if (list.includes(v)) return s;
      return { ...s, customChoices: { ...s.customChoices, [key]: [...list, v] } };
    });
  }, []);

  const removeChoice = useCallback((key: string, value: string) => {
    setState((s) => ({ ...s, customChoices: { ...s.customChoices, [key]: (s.customChoices[key] ?? []).filter((x) => x !== value) } }));
  }, []);

  const setPrudent = useCallback((on: boolean) => setState((s) => ({ ...s, prudent: on })), []);

  const value = useMemo(
    () => ({
      state,
      loading,
      addHunt,
      updateHunt,
      deleteHunt,
      setPlaced,
      toggleOwned,
      addCustomWeapon,
      removeCustomWeapon,
      replaceAll,
      addZone,
      removeZone,
      addHerd,
      updateHerd,
      deleteHerd,
      addAnimal,
      updateAnimal,
      removeAnimal,
      saveSheet,
      setMapUrl,
      saveWeaponSheet,
      saveAmmo,
      removeAmmoSheet,
      toggleOwnedAmmo,
      addChoice,
      removeChoice,
      setPrudent,
    }),
    [
      state,
      loading,
      addHunt,
      updateHunt,
      deleteHunt,
      setPlaced,
      toggleOwned,
      addCustomWeapon,
      removeCustomWeapon,
      replaceAll,
      addZone,
      removeZone,
      addHerd,
      updateHerd,
      deleteHerd,
      addAnimal,
      updateAnimal,
      removeAnimal,
      saveSheet,
      setMapUrl,
      saveWeaponSheet,
      saveAmmo,
      removeAmmoSheet,
      toggleOwnedAmmo,
      addChoice,
      removeChoice,
      setPrudent,
    ],
  );

  return <CarnetContext.Provider value={value}>{children}</CarnetContext.Provider>;
}

export function useCarnet(): CarnetContextValue {
  const ctx = useContext(CarnetContext);
  if (!ctx) throw new Error('useCarnet doit être utilisé dans CarnetProvider');
  return ctx;
}
