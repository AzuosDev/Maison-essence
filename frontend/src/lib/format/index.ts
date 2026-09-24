/**
 * Os formatadores da loja.
 *
 * Importe daqui — `import { formatCents } from '@/lib/format'` — e nunca do
 * arquivo interno. E o que mantem a regra valendo: existe um jeito só de
 * escrever preço, telefone e data nesta aplicação, e ele esta neste módulo.
 */

export { addressLines, formatZipCode, type PostalAddress } from './address';
export {
  centsFromInput,
  centsToInput,
  formatCents,
  formatCentsRange,
  formatInstallment,
} from './currency';
export { formatPhone, maskPhone, normalizePhone, whatsappNumber } from './phone';
export {
  dateInputValue,
  dayEndISO,
  dayStartISO,
  formatDate,
  formatDateTime,
  formatLongDate,
  toDateTimeAttribute,
  type DateInput,
} from './date';
