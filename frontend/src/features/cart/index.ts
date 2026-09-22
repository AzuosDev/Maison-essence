export { clearStashedCart, mergeCartLines, readStashedCart, writeStashedCart } from './cart-merge';

export { watchCustomerCart } from './cart-session';

export { cartHint, cartIsEmpty, cartItemCount, cartQuoteItems, useCart } from './cart.store';

export {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  lineKey,
  type CartLine,
  type CartLineHint,
  type CartLineKey,
  type QuoteItem,
} from './cart.types';

export {
  PRICE_NOTICE_MIN_AGE_MS,
  forgetPrices,
  pricesChangedSince,
  readPriceSnapshot,
  writePriceSnapshot,
  type PriceSnapshot,
} from './price-watch';

export { fetchCartQuote } from './quote.api';

export type {
  CartQuote,
  InstallmentOption,
  QuoteFulfillment,
  QuoteLine,
  QuotePayment,
} from './quote.types';

export {
  QUOTE_DEBOUNCE_MS,
  useCartQuote,
  usePriceNotice,
  type CartQuoteView,
} from './use-cart-quote';
