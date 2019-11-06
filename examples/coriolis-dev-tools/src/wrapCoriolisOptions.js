import { Subject } from 'rxjs'

import { createAggregator, createAggregatorFactory } from 'coriolis'

import { createCoriolisDevToolsEffect } from './effect'

import { devtoolsAggregatorCreated, devtoolsAggrSetup, devtoolsAggrCalled, devtoolsAggregatorCalled } from './events'
import { lossless } from './lib/rx/operator/lossless'

let lastStoreId = 0
const getStoreId = () => ++lastStoreId

let lastAggrId = 0
const getAggrId = () => ++lastAggrId

export const wrapCoriolisOptions = (_options, ...rest) => {
  let options = _options
  let effects
  if (typeof options === 'function') {
    effects = [options, ...rest]
    options = {}
  } else if (options.effects && Array.isArray(options.effects)) {
    effects = [...options.effects, ...rest]
  } else {
    effects = rest
  }

  const storeId = getStoreId()
  const aggregatorEvents = new Subject()

  const devtoolsEffect = createCoriolisDevToolsEffect(storeId, options.storeName, aggregatorEvents.pipe(lossless))

  options.effects = [devtoolsEffect, ...effects]

  options.aggregatorFactory = createAggregatorFactory((aggr, getAggregator) => {
    const aggrId = getAggrId()

    const aggrBehaviorWrapper = aggrBehavior => (...args) => {
      const newState = aggrBehavior(...args)
      aggregatorEvents.next(devtoolsAggrCalled({ storeId, aggrId, args, newState }))

      return newState
    }

    const wrappedAggr = (...args) => {
      if (args.length === 1 && (
        args[0].useAggr ||
        args[0].useEvent ||
        args[0].useState ||
        args[0].lazyAggr ||
        args[0].useValue
      )) {
        let aggrBehavior
        let shouldThrow = false

        try {
          aggrBehavior = aggr(...args)
        } catch(error) {
          shouldThrow = true
          aggrBehavior = error
        }

        aggregatorEvents.next(devtoolsAggrSetup({ storeId, aggrId, aggrBehavior }))

        // result is not expected type.... maybe this was not a complex aggr but a reducer... return what we got
        if (typeof aggrBehavior !== 'function') {
          if (shouldThrow) {
            throw aggrBehavior
          }

          return aggrBehavior
        }

        return aggrBehaviorWrapper(aggrBehavior)
      }

      const newState = aggr(...args)
      aggregatorEvents.next(devtoolsAggrCalled({ storeId, aggrId, args, newState }))

      return newState
    }

    Object.defineProperty(wrappedAggr, 'name', {
      value: aggr.name,
      writable: false
    })

    Object.defineProperty(wrappedAggr, 'length', {
      value: aggr.length,
      writable: false
    })

    const aggregator = createAggregator(wrappedAggr, getAggregator)

    aggregatorEvents.next(devtoolsAggregatorCreated({ storeId, aggrId, aggr, aggregator }))

    const wrappedAggregator = event => {
      aggregatorEvents.next(devtoolsAggregatorCalled({ storeId, aggrId, event }))
      return aggregator(event)
    }

    wrappedAggregator.initialState = aggregator.initialState
    wrappedAggregator.getValue = aggregator.getValue

    Object.defineProperty(wrappedAggregator, 'value', {
      configurable: false,
      enumerable: true,
      get: aggregator.getValue
    })

    return wrappedAggregator
  })

  return options
}
