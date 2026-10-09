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

/** Sets the `--i` custom property that staggers an element's entrance. */
const delayIndex = (index: number): React.CSSProperties =>
  ({ '--i': index }) as React.CSSProperties;

// The fulfilment ladder, in the order a parcel walks it. `Completed` is the
// admin's "fulfilment finished" state and sits on the delivered rung; the
// three terminal exceptions are shown as a status, not as a position.
const ORDER_STEPS = ['Pending Payment', 'Processing', 'Shipped', 'Delivered'] as const;
const NEGATIVE_STATUSES = new Set<string>(['Cancelled', 'Refunded', 'Returned']);

const STEP_LABEL_KEY: Record<string, string> = {
  'Pending Payment': 'track.step.pendingPayment',
  Processing: 'track.step.processing',
  Shipped: 'track.step.shipped',
  Delivered: 'track.step.delivered',
};

const STATUS_LABEL_KEY: Record<string, string> = {
  'Pending Payment': 'track.status.pendingPayment',
  Processing: 'track.status.processing',
  Shipped: 'track.status.shipped',
  Delivered: 'track.status.delivered',
  Completed: 'track.status.completed',
  Cancelled: 'track.status.cancelled',
  Refunded: 'track.status.refunded',
  Returned: 'track.status.returned',
};

const stepIndexFor = (status: string): number =>
  status === 'Completed'
    ? ORDER_STEPS.length - 1
    : ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number]);

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

  const statusLabel = (status: string): string =>
    STATUS_LABEL_KEY[status] ? t(STATUS_LABEL_KEY[status]) : status;

  const paymentLabel = (status: string | null): string => {
    if (!status) return '';
    const key = `track.payStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

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

  const reset = () => {
    setOrder(null);
    setPhase('idle');
    setFieldErrors({});
  };

  const currentStep =
    order && !NEGATIVE_STATUSES.has(order.status) ? stepIndexFor(order.status) : -1;

  const badgeTone = order
    ? NEGATIVE_STATUSES.has(order.status)
      ? 'negative'
      : order.status === 'Delivered' || order.status === 'Completed'
        ? 'success'
        : 'active'
    : 'active';

  const subtotal = order
    ? Number(order.summary.totalPrice) -
      Number(order.summary.shippingCost) +
      Number(order.summary.totalDiscount)
    : 0;

  return (
    <div className="track-page">
      <div className="track-page__inner">
        <header className="track-head">
          <h1 className="track-head__title">{t('track.title')}</h1>
          <p className="track-head__subtitle">{t('track.subtitle')}</p>
        </header>

        <form className="track-form" onSubmit={submit} noValidate>
          <div className="track-field">
            <label className="track-field__label" htmlFor="track-order-number">
              {t('track.orderNumber')}
            </label>
            <div className="track-field__control">
              <svg
                className="track-field__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                id="track-order-number"
                className="track-field__input"
                type="text"
                name="orderNumber"
                autoComplete="off"
                spellCheck={false}
                placeholder={t('track.orderNumberPlaceholder')}
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                aria-invalid={fieldErrors.orderNumber ? true : undefined}
                aria-describedby={fieldErrors.orderNumber ? 'track-order-number-error' : undefined}
              />
            </div>
            {fieldErrors.orderNumber && (
              <p className="track-field__error" id="track-order-number-error" role="alert">
                {fieldErrors.orderNumber}
              </p>
            )}
          </div>

          <button className="track-form__submit" type="submit" disabled={phase === 'loading'}>
            <span>{t('track.submit')}</span>
            <svg
              className="track-form__arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>

        {phase === 'loading' && <TrackSkeleton label={t('track.searching')} />}

        {phase === 'notfound' && (
          <p className="track-feedback track-feedback--notfound" role="status" aria-live="polite">
            <svg
              className="track-feedback__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <span>{t('track.notFound')}</span>
          </p>
        )}

        {phase === 'error' && (
          <p className="track-feedback track-feedback--error" role="status" aria-live="polite">
            <svg
              className="track-feedback__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16.5h.01" />
            </svg>
            <span>{t('track.error')}</span>
          </p>
        )}

        {phase === 'found' && order && (
          <section className="track-result">
            <div className="track-result__head">
              <div className="track-result__identity">
                <p className="track-result__eyebrow">{t('track.statusTitle')}</p>
                <p className="track-result__number">{order.orderNumber}</p>
                <p className="track-result__date">
                  {t('track.orderPlaced', { date: placedOn(order.orderDate) })}
                </p>
              </div>
              <span className={`track-badge track-badge--${badgeTone}`}>
                <span className="track-badge__dot" aria-hidden="true" />
                {statusLabel(order.status)}
              </span>
            </div>

            {currentStep >= 0 && (
              <ol className="track-steps" aria-label={t('track.statusTitle')}>
                {ORDER_STEPS.map((step, index) => {
                  const state =
                    index < currentStep ? 'done' : index === currentStep ? 'current' : 'upcoming';
                  return (
                    <li
                      key={step}
                      className={`track-step track-step--${state}`}
                      style={delayIndex(index)}
                    >
                      <span className="track-step__dot" aria-hidden="true" />
                      <span className="track-step__label">{t(STEP_LABEL_KEY[step])}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="track-result__grid">
              <div className="track-panel" style={delayIndex(0)}>
                <h2 className="track-panel__title">{t('track.itemsTitle')}</h2>
                <ul className="track-items">
                  {order.items.map((item, index) => (
                    <li
                      className="track-item"
                      key={`${item.productName}-${index}`}
                      style={delayIndex(index)}
                    >
                      {item.imageUrl ? (
                        <img
                          className="track-item__image"
                          src={mediaUrl(item.imageUrl)}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="track-item__image track-item__image--empty" aria-hidden="true" />
                      )}
                      <div className="track-item__body">
                        <p className="track-item__name">{itemName(item)}</p>
                        <p className="track-item__meta">
                          {(item.color || item.size) && (
                            <span>{[item.color, item.size].filter(Boolean).join(' · ')}</span>
                          )}
                          <span>{t('track.quantityShort', { count: item.quantity })}</span>
                        </p>
                      </div>
                      <span className="track-item__price">{formatPrice(item.price, locale)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="track-panel" style={delayIndex(1)}>
                <h2 className="track-panel__title">{t('track.summaryTitle')}</h2>
                <dl className="track-summary">
                  <div className="track-summary__row">
                    <dt>{t('track.subtotal')}</dt>
                    <dd>{formatPrice(subtotal, locale)}</dd>
                  </div>
                  {Number(order.summary.totalDiscount) > 0 && (
                    <div className="track-summary__row">
                      <dt>{t('track.discount')}</dt>
                      <dd>-{formatPrice(order.summary.totalDiscount, locale)}</dd>
                    </div>
                  )}
                  <div className="track-summary__row">
                    <dt>{t('track.shipping')}</dt>
                    <dd>{formatPrice(order.summary.shippingCost, locale)}</dd>
                  </div>
                  <div className="track-summary__row track-summary__row--total">
                    <dt>{t('track.total')}</dt>
                    <dd>{formatPrice(order.summary.totalPrice, locale)}</dd>
                  </div>
                </dl>

                <dl className="track-meta">
                  <div className="track-meta__row">
                    <dt>{t('track.payment')}</dt>
                    <dd>
                      {t('track.paymentCod')}
                      {paymentLabel(order.payment.status)
                        ? ` · ${paymentLabel(order.payment.status)}`
                        : ''}
                    </dd>
                  </div>
                  <div className="track-meta__row">
                    <dt>{t('track.shipTo')}</dt>
                    <dd>{governorateLabel(order.shippingGovernorate, locale)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

/**
 * A result-shaped placeholder. It reserves the height of the result so the
 * page does not jump when the order lands, and shows no "loading…" copy — the
 * shape says it. `aria-label` carries the state for screen readers.
 */
const TrackSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div className="track-skeleton" role="status" aria-busy="true" aria-label={label}>
    <div className="track-skeleton__head">
      <span className="track-skeleton__line track-skeleton__line--short" />
      <span className="track-skeleton__pill" />
    </div>
    <div className="track-skeleton__steps">
      {[0, 1, 2, 3].map((step) => (
        <span className="track-skeleton__line" key={step} />
      ))}
    </div>
    <div className="track-skeleton__body">
      <span className="track-skeleton__block" />
      <span className="track-skeleton__block" />
    </div>
  </div>
);

export default TrackOrderPage;
