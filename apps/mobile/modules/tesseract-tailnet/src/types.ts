export type TailnetStartOptions = {
  controlUrl: string;
  authKey?: string;
  hostname: string;
};

export type TailnetStatusEvent = {
  json: string;
};

export type TailnetEvents = {
  status: (event: TailnetStatusEvent) => void;
};
