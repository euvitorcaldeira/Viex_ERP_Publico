import { createContext, useContext } from 'react';
import { canViewFinance, canEditOperations, demoActors, type Actor } from './policy';
export const ActorContext=createContext<Actor>(demoActors[0]);
export function useCapabilities(){const actor=useContext(ActorContext);return {actor,canViewFinance:canViewFinance(actor),canEdit:canEditOperations(actor)}}
