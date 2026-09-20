export type DetectionKind =
  | "cookie"
  | "storage"
  | "geolocation"
  | "media"
  | "canvas"
  | "webrtc";

export interface DetectionEvent {
  type: "detection";
  kind: DetectionKind;
  timestamp: number;
  tabId: number;
  pageUrl: string;
  api: string;
  action: string;
  details?: Record<string, unknown>;
}
