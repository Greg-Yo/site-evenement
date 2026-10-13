/// <reference types="astro/client" />
declare module '*.yaml?raw' {
  const content: string;
  export default content;
}

declare namespace App {
  interface Locals { lang: import('./lib/event').Lang }
}
