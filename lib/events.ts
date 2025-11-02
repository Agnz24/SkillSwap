// lib/events.ts
import { EventEmitter } from 'fbemitter';
export const appEvents = new EventEmitter();
export type SkillsChangedPayload = { source: 'skills' | 'profile'; at: number };

export const emitSkillsChanged = () =>
  appEvents.emit('skills:changed', { source: 'skills', at: Date.now() } as SkillsChangedPayload);
