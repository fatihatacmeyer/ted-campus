import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

if (!isDevMode()) {
  const noop = () => undefined;
  console.log = noop;
  console.debug = noop;
  console.info = noop;
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
