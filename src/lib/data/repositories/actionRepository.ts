import { actions } from '$lib/data/consts/actions';
import type { ActionId } from '$lib/data/consts/actionIds';

export function getAction(id: ActionId) {
  return actions.find((a) => a.id === id);
}
