export type SyncMode = 'sync' | 'copy' | 'move' | 'bisync' | 'check';

export type SyncProfile = {
  id: string;
  name: string;
  source: string;
  destination: string;
  mode: SyncMode;
  enabled: boolean;
  extraArgs: string;
  /** Background scheduler cadence in minutes. 0 = manual only. */
  intervalMinutes: number;
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

export type BackendOption = {
  name: string;
  help: string;
  required: boolean;
  advanced: boolean;
  secret: boolean;
  type: string;
  examples?: Array<{
    value: string;
    help: string;
  }>;
};

export type BackendType = {
  id: string;
  name: string;
  description: string;
  options: BackendOption[];
};

export type AuthAlert = {
  message: string;
  detectedAt: string;
};

export type Advisory = {
  id: string;
  severity?: 'info' | 'warning' | 'critical';
  providers?: string[];
  minRcloneVersion?: string;
  minAppVersion?: string;
  /** Optional "learn more" link. */
  url?: string;
  /** Optional action hint, e.g. "update-rclone" wires the in-app updater. */
  action?: string;
  /** Localized message map ({ tr, en, … }) or a plain string. */
  message: Record<string, string> | string;
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
  backendTypes?: BackendType[];
  /** Per-remote "needs re-authorization" alerts, keyed by remote name. */
  authAlerts?: Record<string, AuthAlert>;
  /** Advisories that currently apply to this install. */
  advisories?: Advisory[];
  /** Installed rclone engine version, e.g. "1.74.3". */
  rcloneVersion?: string | null;
  /** SyncDeck app version. */
  appVersion?: string;
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

export type EngineUpdateInfo = {
  installed: string | null;
  latest: string | null;
  updateAvailable: boolean;
  managed: boolean;
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
  transferEvents?: TransferEvent[];
};

export type TransferEvent = {
  id: string;
  name: string;
  direction: 'upload' | 'download' | 'unknown';
  pct: number;
  status: 'active' | 'done' | 'deleted' | 'error';
};

declare global {
  interface Window {
    rcloneSyncer: {
      getState: () => Promise<AppState>;
      saveProfile: (profile: SyncProfile) => Promise<AppState>;
      deleteProfile: (id: string) => Promise<AppState>;
      chooseFolder: () => Promise<string | null>;
      runSync: (id: string) => Promise<AppState>;
      cancelSync: (id: string, force?: boolean) => Promise<boolean>;
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<boolean>;
      windowClose: () => Promise<void>;
      setLaunchAtLogin: (enabled: boolean) => Promise<AppState>;
      createRemote: (remote: RemoteDraft) => Promise<AppState>;
      authorizeRemote: (payload: AuthorizePayload) => Promise<string>;
      testRemote: (target: string) => Promise<TestResult>;
      deleteRemote: (name: string) => Promise<AppState>;
      reconnectRemote: (name: string) => Promise<AppState>;
      aboutRemote: (name: string) => Promise<AboutInfo>;
      dismissAdvisory: (id: string) => Promise<AppState>;
      checkEngineUpdate: () => Promise<EngineUpdateInfo>;
      updateEngine: (version?: string) => Promise<AppState>;
      resetEngine: () => Promise<AppState>;
      listRemote: (remotePath: string) => Promise<RemoteEntry[]>;
      mkdirRemote: (remotePath: string) => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
      openAbout: () => Promise<void>;
      onSyncProgress: (callback: (data: SyncProgress) => void) => () => void;
      onStateRefresh: (callback: () => void) => () => void;
    };
  }
}
