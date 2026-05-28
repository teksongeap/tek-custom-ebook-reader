/// <reference types="@sveltejs/kit" />

// See https://kit.svelte.dev/docs/types#the-app-namespace
// for information about these interfaces
declare namespace App {
  // interface Locals {}
  // interface Platform {}
  // interface Session {}
  // interface Stuff {}
}

declare global {
  interface CredentialRequestOptions {
    password?: boolean;
  }

  interface FileSystemDirectoryHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
  }

  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface HTMLElement {
    scrollIntoViewIfNeeded(arg?: boolean): void;
  }

  interface Navigator {
    msMaxTouchPoints: number;
    standalone: boolean | undefined;
  }

  interface PasswordCredentialData {
    iconURL?: string;
    id: string;
    name?: string;
    password: string;
  }

  interface Window {
    PasswordCredential: typeof PasswordCredential;
    showDirectoryPicker(options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: FileSystemDirectoryHandle | string;
    }): Promise<FileSystemDirectoryHandle>;
  }

  class PasswordCredential extends Credential {
    constructor(data: PasswordCredentialData);

    readonly password: string;
  }
}

export {};
