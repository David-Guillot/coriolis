import { EMPTY } from 'rxjs'

import { createStore, snapshot } from 'coriolis'

import { createUI } from './effects/ui'
import { storeEvent, storeAdded } from './events'

let destroyDevtoolsStore
const initDevtoolsEventStore = () => {
  let devtoolsEventSubject

  destroyDevtoolsStore = createStore(
    createUI(),
    ({ eventSubject }) => {
      devtoolsEventSubject = eventSubject
    }
  )

  return (storeId, storeName = 'unnamed', aggregatorEvents = EMPTY) =>
    ({ eventSubject, initialEvent$, withAggr }) => {
      devtoolsEventSubject.next(storeAdded({
        storeId,
        storeName,
        snapshot$: withAggr(snapshot)
      }))

      const aggregatorEventsSubscription = aggregatorEvents.subscribe(event => devtoolsEventSubject.next(event))
      const initialEventsSubscription = initialEvent$.subscribe(event => devtoolsEventSubject.next(storeEvent({ storeId, event, isInitialEvent: true })))
      const eventsSubscription = eventSubject.subscribe(event => devtoolsEventSubject.next(storeEvent({ storeId, event })))

      return () => {
        aggregatorEventsSubscription.unsubscribe()
        initialEventsSubscription.unsubscribe()
        eventsSubscription.unsubscribe()
      }
    }
  }

let createDevtoolsEffect
export const createCoriolisDevToolsEffect = (...args) => {
  if (!createDevtoolsEffect) {
    createDevtoolsEffect = initDevtoolsEventStore()
  }

  return createDevtoolsEffect(...args)
}

export const disableCoriolisDevTools = () => destroyDevtoolsStore && destroyDevtoolsStore()