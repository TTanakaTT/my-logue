import { action } from '$lib/data/consts/actions';
import { type Action } from '$lib/domain/entities/Action';

export function getAction(id: Action) {
  return action[id];
}
