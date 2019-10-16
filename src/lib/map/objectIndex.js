
export const createIndex = getNotYetIndexed => {
  let index = new Map()

  const get = (key, ...rest) => {
    const indexed = index.get(key)

    if (rest.length) {
      let subset = indexed && indexed.subset

      if (!subset) {
        subset = createIndex((...args) => getNotYetIndexed(key, ...args))

        index.set(key, {
          ...(indexed || {}),
          subset
        })
      }

      return subset.get(...rest)
    }

    if (indexed && 'value' in indexed) {
      return indexed.value
    }

    const value = getNotYetIndexed(key)

    index.set(key, {
      ...(indexed || {}),
      value
    })

    return value
  }

  const list = () =>
    [...index]
      .reduce((list, [key, { subset, value }]) =>
        [
          ...list,
          ...(value ? [[key, value]] : []),
          ...(subset ? subset.list().map(([subkey, value]) => [[].concat(key, subkey), value]) : [])
        ], [])

  const flush = (key, ...rest) => {
    if (rest.length) {
      const indexed = index.get(key)
      if (indexed && indexed.subset) {
        indexed.subset.flush(...rest)
      }
      return
    }

    index = new Map(
      [...index]
        .filter(([itemKey]) => itemKey !== key)
    )
  }

  return {
    get,
    list,
    flush
  }
}
