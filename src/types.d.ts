export type SyncMode = 'sync' | 'copy';

export type SyncProfile = {
  id: string;
  name: string;
  source: string;
  destination: string;
  mode: SyncMode;
  enabled: boolean;
  extraArgs: string;
};

export type RunRecord = {
  ok: boolean;
  code?: number;
  output: string;
  finishedAt: string;
};

export type AppState = {
  launchAtLogin: boolean;
  profiles: SyncProfile[];
  lastRun: Record<string, RunRecord>;
  rclonePath: string | null;
  configPath: string;
  launchAgentPath: string;
  platform?: string;
  remotes?: string[];
};

export type RemoteDraft = {
  name: string;
  type: string;
  clientId?: string;
  clientSecret?: string;
  options?: Array<{
    key: string;
    value: string;
  }>;
  extraArgs?: string;
};

declare global {
  interface Window {
    rcloneSyncer: {
      getState: () => Promise<AppState>;
      saveProfile: (profile: SyncProfile) => Promise<AppState>;
      deleteProfile: (id: string) => Promise<AppState>;
      chooseFolder: () => Promise<string | null>;
      runSync: (id: string) => Promise<AppState>;
      setLaunchAtLogin: (enabled: boolean) => Promise<AppState>;
      createRemote: (remote: RemoteDraft) => Promise<AppState>;
      openAbout: () => Promise<void>;
    };
  }
}
