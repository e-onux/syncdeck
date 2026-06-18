export type SyncMode = 'sync' | 'copy' | 'move' | 'bisync' | 'check';

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
  token?: string;
  options?: Array<{
    key: string;
    value: string;
  }>;
  extraArgs?: string;
};

export type AuthorizePayload = {
  type: string;
  clientId?: string;
  clientSecret?: string;
};

export type TestResult = {
  ok: boolean;
  message?: string;
};

export type AboutInfo = {
  supported: boolean;
  total?: string;
  used?: string;
  free?: string;
  message?: string;
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
  files?: number;
  totalFiles?: number;
  errors?: number;
};

declare global {
  interface Window {
    rcloneSyncer: {
      getState: () => Promise<AppState>;
      saveProfile: (profile: SyncProfile) => Promise<AppState>;
      deleteProfile: (id: string) => Promise<AppState>;
      chooseFolder: () => Promise<string | null>;
      runSync: (id: string) => Promise<AppState>;
      cancelSync: (id: string) => Promise<boolean>;
      setLaunchAtLogin: (enabled: boolean) => Promise<AppState>;
      createRemote: (remote: RemoteDraft) => Promise<AppState>;
      authorizeRemote: (payload: AuthorizePayload) => Promise<string>;
      testRemote: (target: string) => Promise<TestResult>;
      deleteRemote: (name: string) => Promise<AppState>;
      aboutRemote: (name: string) => Promise<AboutInfo>;
      listRemote: (remotePath: string) => Promise<RemoteEntry[]>;
      openExternal: (url: string) => Promise<void>;
      openAbout: () => Promise<void>;
      onSyncProgress: (callback: (data: SyncProgress) => void) => () => void;
    };
  }
}
