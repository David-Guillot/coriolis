import {
  Subject,
  noop
} from 'rxjs'
import {
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  skipUntil,
  startWith,
  take,
  takeUntil
} from 'rxjs/operators'

import { createEventSource } from './eventSource'
import { createReducerAggregator } from './reducerAggregator'
import { createAggregator } from './aggregator'
import { createBroadcastSubject } from './broadcastSubject'

import { createExtensibleFusableObservable } from './lib/rx/extensibleFusableObservable'
import { createIndex } from './lib/objectIndex'
import { payloadEquals } from './lib/event/payloadEquals'

export const FIRST_EVENT_TYPE = Symbol('FIRST_EVENT')

const buildFirstEvent = () => ({
  type: FIRST_EVENT_TYPE,
  payload: {}
})

export const createStore = (...effects) => {
  if (!effects.length) {
    throw new Error('No effect defined. This is useless')
  }

  const getReducer = createIndex(reducer => createReducerAggregator(reducer))
  const getAggregator = createIndex(aggr => createAggregator(aggr, getAggregator, getReducer))

  const firstEvent = buildFirstEvent()

  // Use a subject to have a single subscription point to connect all together
  const eventCaster = new Subject()
  const eventCatcher = new Subject()

  const replayCaster = eventCaster.pipe(shareReplay(1))

  const initDone = replayCaster.pipe(
    // checking payload, event itself could have been changed (adding meta-data for example)
    filter(payloadEquals(firstEvent.payload)),
    take(1),
    shareReplay(1)
  )

  const effectEventSource = Subject.create(
    eventCatcher,
    eventCaster.pipe(skipUntil(initDone))
  )

  const initialEvent$ = eventCaster.pipe(takeUntil(initDone))

  const {
    broadcastSubject: logger,
    addTarget: addLogger
  } = createBroadcastSubject()

  const {
    observable: mainSource,
    addSource,
    disableAddSource
  } = createExtensibleFusableObservable('addSource must be called before all sources completed')

  const eventSource = createEventSource(mainSource, logger)

  const initIndexed = getIndexed => aggr =>
    replayCaster.subscribe(getIndexed(aggr))

  const pipeIndexed = getIndexed => aggr =>
    replayCaster.pipe(
      map(getIndexed(aggr)),

      // while init is not finished (old events replaying), we expect aggrs to
      // catch all events, but we don't want any new state emited (it's not new states, it's old state reaggregated)
      skipUntil(initDone),

      // if event does not lead to a new aggregate, we don't want to emit
      distinctUntilChanged()
    )

  const addEffect = effect => {
    const removeEffect = effect({
      addEffect,
      addSource,
      addLogger,
      initialEvent$,
      eventSource: effectEventSource,
      initAggr: initIndexed(getAggregator),
      initReducer: initIndexed(getReducer),
      pipeAggr: pipeIndexed(getAggregator),
      pipeReducer: pipeIndexed(getReducer)
    }) || noop

    return removeEffect.unsubscribe
      ? () => removeEffect.unsubscribe()
      : removeEffect
  }

  const disableAddSourceSubscription = initDone.subscribe(disableAddSource)

  const eventCatcherSubscription = eventCatcher
    .pipe(
      startWith(firstEvent)
    )
    .subscribe(eventSource)

  const removeEffects = effects
    .map(addEffect)
    .reduce(
      (prev, removeEffect) => () => { prev(); removeEffect() },
      noop
    )

  const eventCasterSubscription = eventSource
    .subscribe(eventCaster)

  return () => {
    disableAddSourceSubscription.unsubscribe()
    eventCatcherSubscription.unsubscribe()
    eventCasterSubscription.unsubscribe()
    removeEffects()
  }
}
