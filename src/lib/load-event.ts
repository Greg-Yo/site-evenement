import yamlText from '../../evenement/evenement.yaml?raw';
import { parseEvent, type EventConfig } from './event';
import { photoKeys } from './photos';

let cache: EventConfig | undefined;

export function getEvent(): EventConfig {
  cache ??= parseEvent(yamlText, photoKeys);
  return cache;
}
