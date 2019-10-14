import { createEventBuilder } from 'coriolis'

export const viewChanged = createEventBuilder('Current Coriolis devtools view changed', viewname => viewname)

export const devtoolsOpened = createEventBuilder('Coriolis devtools have been opened')
export const devtoolsClosed = createEventBuilder('Coriolis devtools have been closed')

export const devtoolsTimingTypeSelected = createEventBuilder('Coriolis devtools timing type for event display have been selected', type => type)
