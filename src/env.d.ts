/// <reference types="astro/client" />
declare module '*.yaml?raw' {
  const content: string;
  export default content;
}

declare module '*.ttf?inline' {
  const dataUrl: string;
  export default dataUrl;
}

declare namespace App {
  interface Locals { lang: import('./lib/event').Lang }
}
