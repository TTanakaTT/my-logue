import { action } from '$lib/data/consts/actions';
import { type actionName } from '../../domain/entities/actionName';

export function getAction(id: actionName) {
  return action[id];
}
