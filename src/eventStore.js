const { pipe } = require('rxjs')
const { distinctUntilChanged, filter, map } = require('rxjs/operators')

const { parallelMerge } = require('./lib/rx/operator/parallel')
const { effect } = require('./lib/rx/operator/effect')

const { combine } = require('./lib/fp/combine')
const { isDefined } = require('./lib/isDefined')

const createIndex = getValue => {
  const index = []

  const get = key => {
    const indexed = index.find(item => item.key === key)

    if (indexed) {
      return indexed.value
    }

    const value = getValue(key, get)

    index.push({ key, value })

    return value
  }

  return get
}

const createUseReducerGetter = getAggregator => {
  let usedAggregators

  const firstUseReducer = event => reducer => {
    const aggregator = getAggregator(reducer)
    usedAggregators.push(aggregator)

    return () => aggregator(event)
  }

  const reuseReducer = event => {
    let count = 0
    return () => {
      const aggregator = usedAggregators[count]
      count += 1

      return () => aggregator(event)
    }
  }

  return event => {
    if (usedAggregators) {
      return reuseReducer(event)
    }

    usedAggregators = []
    return firstUseReducer(event)
  }
}

const createAggregator = (reducer, getAggregator) => {
  let lastEvent
  let lastResult

  const getUseReducer = createUseReducerGetter(getAggregator)

  return event => {
    if (!lastEvent || event !== lastEvent.value) {
      lastEvent = { value: event }

      lastResult = reducer(lastResult, event, getUseReducer(event))
    }

    return lastResult
  }
}

const combineAggregators = aggregators => {
  const getData = combine(aggregators)
  const initialState = aggregators.map(() => undefined)
  let prev = initialState

  return event => {
    const newData = getData(event)

    const hasChanged = newData.some((data, idx) => data !== prev[idx])

    // if each aggregator returns the same data as previous call, we want to return the
    // exact same result, so === operator can be used to know something changed
    prev = hasChanged ? newData : prev !== initialState ? prev : undefined

    return prev
  }
}

const createStore = eventSource => {
  const branches = []
  const getAggregator = createIndex(createAggregator)

  const store = {
    addEffect: (...args) => {
      const effectOperator = effect(args.pop())
      const aggregator = combineAggregators(args.map(getAggregator))

      const branch = pipe(
        map(aggregator),
        filter(isDefined),
        distinctUntilChanged(),
        effectOperator
      )

      branches.push(branch)

      return store
    },

    init: () => {
      if (!branches.length) {
        throw new Error('No effect defined. This is useless')
      }

      return eventSource
        .pipe(parallelMerge(...branches))
        .subscribe(eventSource).unsubscribe
    }
  }

  return store
}

module.exports = {
  createStore
}
