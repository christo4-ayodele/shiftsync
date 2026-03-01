'use client'

import { create } from 'zustand'

interface NotificationStore {
  unreadCount: number
  setUnreadCount: (count: number) => void
  increment: () => void
  decrement: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  increment: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  decrement: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
}))
