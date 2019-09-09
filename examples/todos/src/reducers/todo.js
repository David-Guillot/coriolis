import { findAndReplace } from '../libs/array/findAndReplace'
import { not } from '../libs/function/not'

import { added, removed, done, reset, edited } from '../events/todo'

const setTodoText = text => item => ({
  ...item,
  text
})

const setTodoDone = done => item => ({
  ...item,
  done
})

let nextItemId = 1
const newTodoItem = item => ({
  ...item,
  id: nextItemId++
})

const hasId = id => item => item.id === id

export const todolist = (state = [], { type, payload, error }) => {
  if (error) {
    return state
  }

  switch (type) {
    case added.toString():
      return [
        ...state,
        newTodoItem(payload)
      ]

    case edited.toString():
      return findAndReplace(
        state,
        hasId(payload.id),
        setTodoText(payload.text)
      )

    case done.toString():
    case reset.toString():
      return findAndReplace(
        state,
        hasId(payload),
        setTodoDone(type === done.toString())
      )

    case removed.toString():
      return state.filter(not(hasId(payload)))

    default:
      return state
  }
}