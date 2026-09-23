/**
 * Os formatadores da loja.
 *
 * Importe daqui — `import { formatCents } from '@/lib/format'` — e nunca do
 * arquivo interno. E o que mantem a regra valendo: existe um jeito so de
 * escrever preco, telefone e data nesta aplicacao, e ele esta neste modulo.
 */

export { addressLines, formatZipCode, type PostalAddress } from './address';
export { centsFromInput, formatCents, formatCentsRange, formatInstallment } from './currency';
export { formatPhone, maskPhone, normalizePhone, whatsappNumber } from './phone';
export {
  dayEndISO,
  dayStartISO,
  formatDate,
  formatDateTime,
  formatLongDate,
  toDateTimeAttribute,
  type DateInput,
} from './date';
