declare module '@codedread/bitjs' {
  export const UnarchiveEventType: {
    START: string;
    APPEND: string;
    PROGRESS: string;
    EXTRACT: string;
    FINISH: string;
    INFO: string;
    ERROR: string;
  };

  export class UnarchiveEvent extends Event {
    constructor(type: string);
  }

  export class UnarchiveExtractEvent extends UnarchiveEvent {
    unarchivedFile: {
      filename: string;
      fileData: Uint8Array;
      header?: any;
    };
  }

  export class UnarchiveErrorEvent extends UnarchiveEvent {
    msg: string;
  }

  export class Unrarrer {
    constructor(ab: ArrayBuffer, options?: any);
    addEventListener(type: string, listener: (evt: any) => void): void;
    start(): void;
  }
}

