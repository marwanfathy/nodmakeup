'use client';

import React, { useEffect, useState } from 'react';
import { isNotFound, mediaUrl, trackOrder, TrackingOrder } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';
import { governorateLabel } from '@/lib/i18n/governorates';
import { formatPrice } from '@/lib/format';
import './TrackOrderPage.css';

type Phase = 'idle' | 'loading' | 'found' | 'notfound' | 'error';

interface FieldErrors {
  orderNumber?: string;
}

/**
 * How the design dresses each rung of the parcel's journey: the four dotted
 * steps in order, the position each status sits on, the badge colour, and the
 * one-line "what happens next" for the status. All three tables are keyed by
 * the backend's status strings so the markup never branches on copy.
 */
const STEP_LABEL_KEYS = [
  'track.step.pendingPayment', // Order received
  'track.step.processing', //     Being prepared
  'track.step.shipped', //        On its way
  'track.step.delivered', //      Delivered
] as const;

const STEP_INDEX: Readonly<Record<string, number>> = {
  'Pending Payment': 0,
  Processing: 1,
  Shipped: 2,
  Delivered: 3,
  Completed: 3,
};

/** The three terminal exceptions are shown as a status, not as a position. */
const NEGATIVE_STATUSES = new Set<string>(['Cancelled', 'Refunded', 'Returned']);

type BadgeTone = 'processing' | 'shipped' | 'delivered' | 'negative';

const BADGE: Readonly<Record<string, { tone: BadgeTone; labelKey: string }>> = {
  'Pending Payment': { tone: 'processing', labelKey: 'track.status.pendingPayment' },
  Processing: { tone: 'processing', labelKey: 'track.step.processing' },
  Shipped: { tone: 'shipped', labelKey: 'track.step.shipped' },
  Delivered: { tone: 'delivered', labelKey: 'track.status.delivered' },
  Completed: { tone: 'delivered', labelKey: 'track.status.delivered' },
  Cancelled: { tone: 'negative', labelKey: 'track.status.cancelled' },
  Refunded: { tone: 'negative', labelKey: 'track.status.refunded' },
  Returned: { tone: 'negative', labelKey: 'track.status.returned' },
};

const NEXT_KEY: Readonly<Record<string, string>> = {
  'Pending Payment': 'track.next.pendingPayment',
  Processing: 'track.next.processing',
  Shipped: 'track.next.shipped',
  Delivered: 'track.next.delivered',
  Completed: 'track.next.delivered',
  Cancelled: 'track.next.negative',
  Refunded: 'track.next.negative',
  Returned: 'track.next.negative',
};

const TrackOrderPage: React.FC = () => {
  const { t, locale } = useI18n();
  const [orderNumber, setOrderNumber] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [order, setOrder] = useState<TrackingOrder | null>(null);

  // A "track this order" link elsewhere can arrive as ?orderNumber=…; prefill
  // it without pulling useSearchParams (and its Suspense requirement) in.
  useEffect(() => {
    const prefilled = new URLSearchParams(window.location.search).get('orderNumber');
    if (prefilled) setOrderNumber(prefilled.toUpperCase());
  }, []);

  const placedOn = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const itemName = (item: TrackingOrder['items'][number]): string =>
    locale === 'ar' ? item.productNameAr || item.productName : item.productName;

  const itemMeta = (item: TrackingOrder['items'][number]): string =>
    [item.color, item.size].filter(Boolean).join(' · ');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phase === 'loading') return;

    const errors: FieldErrors = {};
    if (!orderNumber.trim()) errors.orderNumber = t('track.orderNumberError');
    if (errors.orderNumber) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setPhase('loading');
    try {
      const data = await trackOrder(orderNumber.trim().toUpperCase());
      setOrder(data);
      setPhase('found');
    } catch (error) {
      setOrder(null);
      setPhase(isNotFound(error) ? 'notfound' : 'error');
    }
  };

  const isNegative = order ? NEGATIVE_STATUSES.has(order.status) : false;
  const currentStep = order && !isNegative ? (STEP_INDEX[order.status] ?? -1) : -1;
  const badge = order ? BADGE[order.status] : undefined;
  const badgeLabel = order ? (badge?.labelKey ? t(badge.labelKey) : order.status) : '';

  const subtotal = order
    ? Number(order.summary.totalPrice) -
      Number(order.summary.shippingCost) +
      Number(order.summary.totalDiscount)
    : 0;

  // Every order today is cash on delivery; the dashed reminder only makes
  // sense while the parcel is still moving, not after delivery.
  const isCod = order?.payment.method === 'Cash on Delivery';
  const showCod = Boolean(order && isCod && currentStep >= 0 && currentStep < 3);

  return (
    <div className="track-page">
      <div className="track-page__inner">
        <header className="track-head">
          <h1 className="track-head__title">{t('track.title')}</h1>
          <p className="track-head__subtitle">{t('track.subtitle')}</p>
        </header>

        <form className="lookup" onSubmit={submit} noValidate>
          <div className="field">
            <input
              id="track-order-number"
              className="field__input"
              type="text"
              name="orderNumber"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('track.orderNumberPlaceholder')}
              aria-label={t('track.orderNumber')}
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              aria-invalid={fieldErrors.orderNumber ? true : undefined}
              aria-describedby={fieldErrors.orderNumber ? 'track-order-number-error' : undefined}
            />
          </div>
          <button className="btn" type="submit" disabled={phase === 'loading'}>
            {t('track.submit')}
          </button>
        </form>

        {fieldErrors.orderNumber && (
          <p className="field__error" id="track-order-number-error" role="alert">
            {fieldErrors.orderNumber}
          </p>
        )}

        {phase === 'loading' && <TrackSkeleton label={t('track.searching')} />}

        {phase === 'notfound' && (
          <p className="msg" role="status" aria-live="polite">
            <AlertIcon />
            <span>{t('track.notFound')}</span>
          </p>
        )}

        {phase === 'error' && (
          <p className="msg" role="status" aria-live="polite">
            <AlertIcon />
            <span>{t('track.error')}</span>
          </p>
        )}

        {phase === 'found' && order && (
          <section className="card" aria-live="polite">
            <header className="head">
              <div>
                <p className="head__label">{t('track.placedLabel', { date: placedOn(order.orderDate) })}</p>
                <p className="head__num">{order.orderNumber}</p>
              </div>
              {badge && (
                <span className={`badge badge--${badge.tone}`}>
                  <span className="badge__dot" aria-hidden="true" />
                  {badgeLabel}
                </span>
              )}
            </header>

            {currentStep >= 0 && (
              <ol className="tracker" aria-label={t('track.statusTitle')}>
                {STEP_LABEL_KEYS.map((labelKey, index) => {
                  const state = index < currentStep ? 'done' : index === currentStep ? 'current' : 'todo';
                  return (
                    <li
                      key={labelKey}
                      className={`step step--${state}`}
                      aria-current={state === 'current' ? 'step' : undefined}
                    >
                      <span className="node" aria-hidden="true">
                        {state === 'done' && <CheckIcon />}
                      </span>
                      <div>
                        <b>{t(labelKey)}</b>
                        {index === 0 && <small>{placedOn(order.orderDate)}</small>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <p className="next">{t(NEXT_KEY[order.status] ?? 'track.next.negative')}</p>

            <div className="body">
              <div>
                <h2>{t('track.yourItem')}</h2>
                <ul className="items">
                  {order.items.map((item, index) => (
                    <li className="item" key={`${item.productName}-${index}`}>
                      <span className="thumb">
                        {item.imageUrl ? (
                          <img src={mediaUrl(item.imageUrl)} alt="" loading="lazy" />
                        ) : (
                          <TubeIcon />
                        )}
                      </span>
                      <div className="item__body">
                        <div className="item__name">{itemName(item)}</div>
                        <div className="item__meta">
                          {itemMeta(item) && <span>{itemMeta(item)}</span>}
                          <span>{t('track.quantityShort', { count: item.quantity })}</span>
                        </div>
                      </div>
                      <span className="item__price">{formatPrice(item.price, locale)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2>{t('track.summaryTitle')}</h2>
                <div className="rows">
                  <div>
                    <span className="rows__k">{t('track.subtotal')}</span>
                    <span>{formatPrice(subtotal, locale)}</span>
                  </div>
                  {Number(order.summary.totalDiscount) > 0 && (
                    <div>
                      <span className="rows__k">{t('track.discount')}</span>
                      <span>-{formatPrice(order.summary.totalDiscount, locale)}</span>
                    </div>
                  )}
                  <div>
                    <span className="rows__k">{t('track.shipping')}</span>
                    <span>{formatPrice(order.summary.shippingCost, locale)}</span>
                  </div>
                  <div className="total">
                    <span className="rows__k">{t('track.total')}</span>
                    <span>{formatPrice(order.summary.totalPrice, locale)}</span>
                  </div>
                </div>

                {showCod && (
                  <div className="cod">
                    <strong>{t('track.codTitle', { amount: formatPrice(order.summary.totalPrice, locale) })}</strong>
                    {t('track.codNote')}
                  </div>
                )}

                <div className="rows ship">
                  <div>
                    <span className="rows__k">{t('track.shipTo')}</span>
                    <span>{governorateLabel(order.shippingGovernorate, locale)}</span>
                  </div>
                  <div>
                    <span className="rows__k">{t('track.customer')}</span>
                    <span>{order.customerName}</span>
                  </div>
                  <div>
                    <span className="rows__k">{t('track.phone')}</span>
                    <span>{order.customerPhone}</span>
                  </div>
                </div>
              </div>
            </div>

            <footer className="foot">
              <span>{t('track.foot.question')}</span>
            </footer>
          </section>
        )}
      </div>
    </div>
  );
};



const CheckIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

const AlertIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16.5h.01" />
  </svg>
);

const TubeIcon: React.FC = () => (
  <svg width="22" height="54" viewBox="0 0 22 54" aria-hidden="true">
    <rect x="5" y="2" width="12" height="9" rx="2" fill="#2a2523" />
    <rect x="3" y="11" width="16" height="41" rx="6" fill="#d4607a" />
  </svg>
);

/**
 * A result-shaped placeholder. It reserves the height of the result so the
 * page does not jump when the order lands, and shows no "loading…" copy — the
 * shape says it. `aria-label` carries the state for screen readers.
 */
const TrackSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div className="skel" role="status" aria-busy="true" aria-label={label}>
    <div className="skel__head">
      <span className="skel__line skel__line--short" />
      <span className="skel__pill" />
    </div>
    <div className="skel__steps">
      {[0, 1, 2, 3].map((dot) => (
        <span className="skel__dot" key={dot} />
      ))}
    </div>
    <div className="skel__body">
      <span className="skel__block" />
      <span className="skel__block" />
    </div>
  </div>
);

export default TrackOrderPage;