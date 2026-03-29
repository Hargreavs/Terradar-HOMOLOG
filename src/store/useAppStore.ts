import { create } from 'zustand'

export type TelaAtivaApp = 'mapa' | 'inteligencia' | 'radar'

interface AppStore {
  telaAtiva: TelaAtivaApp
  setTelaAtiva: (tela: TelaAtivaApp) => void
  /** ID do item do feed Radar (`radar-alertas.mock`) a abrir ao vir do Mapa. */
  pendingRadarAlertaId: string | null
  setPendingRadarAlertaId: (id: string | null) => void
  /** Mapa: "Ver todos os alertas" no popover: força Radar em home sem alerta pendente. */
  radarAbrirHomeIntent: boolean
  setRadarAbrirHomeIntent: (v: boolean) => void
}

export const useAppStore = create<AppStore>((set) => ({
  telaAtiva: 'mapa',
  setTelaAtiva: (tela) => set({ telaAtiva: tela }),
  pendingRadarAlertaId: null,
  setPendingRadarAlertaId: (id) => set({ pendingRadarAlertaId: id }),
  radarAbrirHomeIntent: false,
  setRadarAbrirHomeIntent: (v) => set({ radarAbrirHomeIntent: v }),
}))
