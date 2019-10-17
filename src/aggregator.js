import { identity, noop } from 'rxjs'

import { createIndex } from './lib/map/objectIndex'
import { objectFrom } from './lib/object/objectFrom'
import { variableFunction } from './lib/function/variableFunction'
import { chain } from './lib/function/chain'
import { tryOrNull } from './lib/function/tryOrNull'

// snapshot is a unique aggr that will return all indexed aggregators' last state
export const snapshot = () => {}

// aggr wrapper that allow an aggr to be parametered and still have shared cached results
export const parameteredAggr = aggr =>
  createIndex((...args) => aggrAPI => {
    let count = 0
    const useParam = () => aggrAPI.useValue(args[count++])
    return aggr({
      useParam,
      ...aggrAPI
    })
  }).get

// Builds an aggregator function (receives an event, returns a state) from a reducer function
const createReducerAggregator = reducer => {
  if (typeof reducer !== 'function') {
    throw new TypeError('reducer must be a function')
  }

  let lastEvent
  let lastState

  return event => {
    // in any case, same event => last state, no event => last state
    if (!event || (lastEvent && event === lastEvent.value)) {
      return lastState
    }

    lastEvent = { value: event }

    lastState = reducer(lastState, event)

    return lastState
  }
}

const throwUnexpectedScope = funcName => () => {
  throw new Error(`Unexpected out-of-scope usage of function ${funcName}`)
}

const createAggrSetupAPI = (getLastState, getAggregator) => {
  const using = {
    state: false,
    event: false,
    aggregators: []
  }

  const useState = () => {
    using.state = true
    using.aggregators.push(getLastState)
  }

  const useEvent = () => {
    using.event = true
    using.aggregators.push(identity)
  }

  const useAggr = aggr =>
    using.aggregators.push(getAggregator(aggr))

  const useValue = value => using.aggregators.push(() => value)

  const setupParamsRaw = Object.entries({
    useState,
    useEvent,
    useAggr,
    useValue
  })
    .map(([key, value]) => [key, variableFunction(value)])

  const setupParams = objectFrom(setupParamsRaw.map(([key, { func }]) => [key, func]))

  const preventOutOfScopeUsage = chain(
    ...setupParamsRaw
      .map(([key, { setup }]) => () => setup(throwUnexpectedScope(key)))
  )

  const isNullSetup = () => using.aggregators.length === 0

  const isReducerSetup = () =>
    (!using.aggregators[0] || using.aggregators[0] === getLastState) &&
    (!using.aggregators[1] || using.aggregators[1] === identity)

  const isReducerLikeSetup = () =>
    using.aggregators.length === (using.state + using.event)

  let lastValues = []
  const getValues = event => {
    const values = using.aggregators.map(aggr => aggr(event))

    // getValues will be called only once per event, this is garanteed from
    // reducer aggregator's initial part
    // if event is used, values is garanteed to change each time
    if (using.event) {
      return values
    }

    const anyChange = values.some((item, idx) => item !== lastValues[idx])
    lastValues = values

    return anyChange ? values : undefined
  }

  return {
    setupParams,
    getValues,
    isNullSetup,
    isReducerSetup,
    isReducerLikeSetup,
    preventOutOfScopeUsage
  }
}

// builds an aggregator from a complexe aggr definition function
const createComplexAggregator = (aggr, getAggregator) => {
  if (typeof aggr !== 'function') {
    throw new TypeError('Aggr must be a function')
  }

  let aggregator = noop
  const getLastState = () => aggregator()

  const {
    setupParams,
    getValues,
    isNullSetup,
    isReducerSetup,
    isReducerLikeSetup,
    preventOutOfScopeUsage
  } = createAggrSetupAPI(getLastState, getAggregator)

  const aggrBehaviour = tryOrNull(() => aggr(setupParams))
  preventOutOfScopeUsage()

  if (isNullSetup() || typeof aggrBehaviour !== 'function') {
    // reducer aggr with optional parameters could lead here.
    // let's assume aggr is in fact a reducer
    return createReducerAggregator(aggr)
  }

  // if given aggregator definition expects only state and event (or less), it should be a reducer
  if (isReducerLikeSetup()) {
    console.warn('Prefer using simple reducer signature " (state, event) => newstate " when you only need state and/or event')

    // Replace with getAggregator in case signature matches reducer signature (state, event)
    if (isReducerSetup()) {
      return getAggregator(aggrBehaviour)
    }
  }

  aggregator = createReducerAggregator((lastState, event) => {
    const values = getValues(event)

    if (!values) {
      return lastState
    }

    return aggrBehaviour(...values)
  })

  return aggregator
}

// There's two cases (reducer or complex aggregator) but we want a single access point so we have to
// guess whether it's a reducer or a complex aggregator definition
// - reducer definition is a function with two parameters
// - complex aggregator definition is a function with only one parameter
// If this guess is not accurate, we should handle aggregator definition as complex aggregator because in
// complex aggregator handling process there's fallbacks to ensure it works even if a reducer is passed
export const createAggregator = (aggr, getAggregator = createAggregator) =>
  (aggr && aggr.length === 2)
    ? createReducerAggregator(aggr)
    : createComplexAggregator(aggr, getAggregator)

export const createAggregatorFactory = (aggregatorBuilder = createAggregator) => {
  const factory = createIndex(
    aggr =>
      aggr === snapshot
        ? getSnapshot
        : aggregatorBuilder(aggr, factory.get)
  )

  // to build a snapshot, we get the current state from each aggregator and put
  // all this in an object, using aggregator definition's name as keys. If any conflicts
  // on names, numbers are concatenated on conflicting keys (aKey, aKey-2, aKey-3...)
  const getSnapshot = () => objectFrom(
    factory.list()
      // we don't want to list snapshot aggregator's state as it would cause a recursive loop
      .filter(([aggr]) => aggr !== snapshot)
      .map(([aggr, aggregator]) => [aggr.name, aggregator()])
  )

  return factory
}
