// Nastavení upomínek. Čisté konstanty, použitelné na serveru i v prohlížeči.
export { MILESTONES } from './schedule'

/** Je-li false, události způsobilé k poplatkům nelze odeslat (vypínač smluvních pokut a vyúčtování). */
export const FEES_ENABLED = true

export const REMINDER_FROM = 'upominka@v-h-s.cz'
export const REMINDER_REPLY_TO = 'info@v-h-s.cz'
export const REMINDER_BCC = 'info@v-h-s.cz'
