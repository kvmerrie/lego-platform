declare module 'ssh2-sftp-client' {
  import type { Readable } from 'node:stream';

  export interface ConnectOptions {
    host: string;
    password: string;
    port?: number;
    readyTimeout?: number;
    username: string;
  }

  export interface FileInfo {
    modifyTime?: number;
    name: string;
    size?: number;
    type?: string;
  }

  export default class SftpClient {
    connect(config: ConnectOptions): Promise<void>;
    createReadStream(remotePath: string): Readable;
    end(): Promise<void>;
    get(remotePath: string): Promise<Buffer | Readable | string>;
    list(remotePath: string): Promise<FileInfo[]>;
    pwd?(): Promise<string>;
  }
}
