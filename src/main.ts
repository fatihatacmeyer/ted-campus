import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Production build'de debug logları (ör. "[Req] plaintext param") kapatılır.
// console.error / console.warn bilerek açık bırakıldı.
if (!isDevMode()) {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
