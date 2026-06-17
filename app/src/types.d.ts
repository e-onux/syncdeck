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

export type RemoteClient = {
  name: string;
  type: string;
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
  clients?: RemoteClient[];
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

export type RemoteEntry = {
  name: string;
  isDir: boolean;
  size: number;
};

export type SyncProgress = {
  id: string;
  running: boolean;
  pct?: number;
  speed?: string;
  eta?: string;
  transferred?: string;
  total?: string;
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
      listRemote: (remotePath: string) => Promise<RemoteEntry[]>;
      openExternal: (url: string) => Promise<void>;
      openAbout: () => Promise<void>;
      onSyncProgress: (callback: (data: SyncProgress) => void) => () => void;
    };
  }
}
