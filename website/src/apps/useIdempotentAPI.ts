import {useMemo} from 'react';
import {queryIdentity} from '../lib/query-cache';
import type {API} from '../operations/UI';
import {createWriteIntents} from './write-intents';
/** API paths are already workspace/environment-bound; intent memory also follows the current identity. */
export function useIdempotentAPI(provided:API,scope:string):API{const identity=queryIdentity();return useMemo(()=>createWriteIntents(provided,identity+'\0'+scope).call,[scope,identity]);}
