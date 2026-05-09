"use client";

import { create } from "zustand";
import type { UserProfile } from "@/types/account";
import {
  fetchCurrentUser,
  listAccounts,
  getAccount,
  createAccount as createAccountService,
  registerAccount as registerAccountService,
  switchAccount as switchAccountService,
  deleteAccount as deleteAccountService,
  updateAccount as updateAccountService,
  migrateLocalDefaultToUser,
  transferAccountData as transferAccountDataService,
  logout as logoutService,
} from "@/services/account";

interface AccountState {
  activeUserId: string;
  activeProfile: UserProfile | null;
  accounts: UserProfile[];
  hydrated: boolean;
  showSetupModal: boolean;
  isAdmin: boolean;

  hydrate: () => Promise<void>;
  createAccount: (
    displayName: string,
    avatarEmoji?: string,
    migrateDefault?: boolean
  ) => Promise<UserProfile>;
  switchAccount: (userId: string) => Promise<void>;
  deleteAccount: (userId: string) => Promise<void>;
  updateAccount: (
    userId: string,
    changes: Partial<Pick<UserProfile, "displayName" | "avatarEmoji">>
  ) => Promise<void>;
  registerAccount: (
    displayName: string,
    avatarEmoji?: string
  ) => Promise<UserProfile>;
  dismissSetupModal: () => void;
  transferData: (fromUserId: string, toUserId: string) => Promise<number>;
  refreshAccounts: () => Promise<void>;
  logout: () => Promise<void>;
}

const DEFAULT_OWNER_ID = "local-default";

export const useAccountStore = create<AccountState>((set, get) => ({
  activeUserId: DEFAULT_OWNER_ID,
  activeProfile: null,
  accounts: [],
  hydrated: false,
  showSetupModal: false,
  isAdmin: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const profile = await fetchCurrentUser();
    // 管理员场景下 Sidebar 需要看到所有账户列表；普通用户不需要
    let accounts: UserProfile[] = [];
    if (profile?.role === "admin") {
      accounts = await listAccounts();
    }
    set({
      activeUserId: profile?.id ?? DEFAULT_OWNER_ID,
      activeProfile: profile ?? null,
      accounts,
      hydrated: true,
      showSetupModal: false,
      isAdmin: profile?.role === "admin",
    });
  },

  createAccount: async (displayName, avatarEmoji, migrateDefault = false) => {
    const role = migrateDefault ? "admin" : "user";
    const profile = await createAccountService(displayName, avatarEmoji, role);
    if (migrateDefault) {
      await migrateLocalDefaultToUser(profile.id);
    }
    return profile;
  },

  switchAccount: async (userId) => {
    await switchAccountService(userId);
  },

  deleteAccount: async (userId) => {
    await deleteAccountService(userId);
    if (get().isAdmin) {
      const accounts = await listAccounts();
      set({ accounts });
    }
  },

  updateAccount: async (userId, changes) => {
    await updateAccountService(userId, changes);
    const refreshed = userId === get().activeUserId ? await getAccount(userId) : null;
    if (get().isAdmin) {
      const accounts = await listAccounts();
      set({ accounts, ...(refreshed ? { activeProfile: refreshed } : {}) });
    } else if (refreshed) {
      set({ activeProfile: refreshed });
    }
  },

  registerAccount: async (displayName, avatarEmoji) => {
    return registerAccountService(displayName, avatarEmoji);
  },

  dismissSetupModal: () => set({ showSetupModal: false }),

  transferData: async (fromUserId, toUserId) => {
    return transferAccountDataService(fromUserId, toUserId);
  },

  refreshAccounts: async () => {
    if (!get().isAdmin) return;
    const accounts = await listAccounts();
    set({ accounts });
  },

  logout: async () => {
    await logoutService();
  },
}));
