import React, { useEffect, useRef, useState } from 'react';
import { analyticsApi } from '../api/adminApi';
import { money, shortDate, errMsg } from '../utils/format';
import { Kpi, Loading, ErrorBox, Panel, Chip, Input } from '../common/UI';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { useAnalyticsStream } from './analyticsStream';

const daysAgo = (days) => {
    const d = new Date(Date.now() - days * 86400000);
    return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

const MiniBars = ({ data, valueKey }) => {
    if (!data || data.length === 0) return <span className="nd-hint">No data in range.</span>;
    const max = Math.max(...data.map(d => Number(d[valueKey] || 0)), 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 88 }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div className="nd-progress" style={{ width: '100%', height: 54, background: 'transparent' }}>
                        <div className="nd-progress-bar" style={{ height: `${Math.max(4, (Number(d[valueKey] || 0) / max) * 100)}%`, marginTop: 'auto', display: 'block' }} />
                    </div>
                    <span className="nd-faint" style={{ fontSize: 9 }}>
                        {d.date ? shortDate(d.date).split(' ')[0].slice(0, 3) : String(d.hour ?? '').toString().padStart(2, '0') + 'h'}
                    </span>
                </div>
            ))}
        </div>
    );
};

const timeAgo = (iso) => {
    if (!iso) return '';
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
};

const TYPE_TONE = { CLICK: 'accent', SCROLL: 'info', EXIT_LINK: 'warn', VIEW: 'ok', PURCHASE: 'success', ERROR: 'danger' };

/** Normalize a pushed analytics:event into the same shape the REST feed returns. */
let wsSeq = 0;
const normalizeWsEvent = (event) => {
    const at = event?.at || new Date().toISOString();
    if (event?.kind === 'behaviors') {
        return (event.events || []).map((e) => ({
            id: `ws-beh-${wsSeq++}`,
            sessionId: event.sessionId || '—',
            type: e.type || 'CLICK',
            target: e.target || '',
            label: e.label || '—',
            href: e.href,
            path: e.path || '',
            createdAt: at,
        }));
    }
    if (event?.kind === 'pageView') {
        return [{
            id: `ws-view-${wsSeq++}`,
            sessionId: event.sessionId || '—',
            type: 'VIEW',
            target: 'navigation',
            label: event.path || '—',
            path: event.path || '',
            createdAt: at,
        }];
    }
    if (event?.kind === 'purchase') {
        return [{
            id: `ws-pur-${wsSeq++}`,
            sessionId: '—',
            type: 'PURCHASE',
            target: 'order',
            label: `Order ${event.orderNumber || ''} · ${money(event.total)}`,
            meta: event.governorate ? { governorate: event.governorate } : undefined,
            path: '/checkout',
            createdAt: at,
        }];
    }
    return [];
};

const LiveFeed = ({ events, live }) => (
    <Panel
        title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                Live behavior
                <span className={live ? 'nd-live' : 'nd-live-off'}>{live ? 'streaming' : 'polling (stream down)'}</span>
            </span>
        }
        sub={live
            ? 'Streamed live over Server-Sent Events (SSE).'
            : 'Stream offline — falling back to 5s REST polling.'}
    >
        {!events || events.length === 0 ? (
            <span className="nd-hint">No events yet — open the storefront and click around, it appears here in seconds.</span>
        ) : (
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
                {events.map((e) => (
                    <div className="nd-ev" key={e.id}>
                        <div className="nd-ev-tag">
                            <Chip tone={TYPE_TONE[e.type] || 'muted'}>{e.type}</Chip>
                        </div>
                        <div className="nd-ev-main">
                            <div className="nd-ev-label">{e.label || '—'}</div>
                            <div className="nd-ev-meta">
                                {e.target} {e.href ? `→ ${e.href}` : ''} · {e.path} · {timeAgo(e.createdAt)} · {String(e.sessionId || '—').slice(0, 4)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </Panel>
);

const InsightsPanel = ({ insights }) => {
    if (!insights) return null;
    const f = insights.funnel || {};
    const addPct = i => `${i.count}`;

    const scrollMax = Math.max(...(insights.scrolls || []).map(s => s.count), 1);

    const recs = [];
    if (insights.totalEvents === 0) {
        recs.push('No behavior captured in this window. Open the store site and start clicking — events stream in live.');
    } else {
        if (f.productPageVisits > 0 && f.checkoutRateFromAdds < 30)
            recs.push(`Products get browsed (${f.productPageVisits} product-page visits) but only ${f.checkoutRateFromAdds}% of cart-adds reach checkout. Look for friction on the checkout form, delivery cost surprises, or payment messaging.`);
        if (insights.exitLinks && insights.exitLinks.length > 0)
            recs.push(`${insights.exitLinks.length} distinct external links pull visitors off-site. Off-site links should be nofollow, open in a new tab, and only exist where they help conversion.`);
        const shallowScroll = (insights.scrolls || [])
            .filter(s => s.depth <= 50).reduce((sum, s) => sum + s.count, 0);
        if (insights.scrolls && insights.scrolls.length > 0 && shallowScroll / insights.scrolls.reduce((sum, s) => sum + s.count, 0) > 0.6)
            recs.push('Most scroll events stall before 50% depth — the first screen is deciding. Tighten the hero and put your strongest products/offer above the fold.');
        if (f.addRate < 5)
            recs.push(`Only ${f.addRate}% of all clicks aim at the cart. Consider clearer pricing, reviews, or a limited-time offer on product cards.`);
        if (recs.length === 0) recs.push('No obvious friction signals in this window. Keep streaming — patterns sharpen with volume.');
    }

    return (
        <Panel title="Patterns & insights" sub="Machine-summarized over the last hours of behavior.">
            <div className="nd-detail-row"><span>Events captured</span><span className="nd-table-strong">{(insights.totalEvents || 0).toLocaleString()}</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: 'var(--sp-3) 0 var(--sp-5)' }}>
                {(insights.byType || []).map(t => (
                    <Chip key={t.type} tone={TYPE_TONE[t.type] || 'muted'}>{t.type} · {t._count}</Chip>
                ))}
            </div>

            <div className="nd-grid nd-grid-3" style={{ marginBottom: 'var(--sp-5)' }}>
                <div className="nd-kpi" style={{ border: 'none', boxShadow: 'none', background: 'var(--paper)' }}><div className="nd-kpi-label">Product pages</div><div className="nd-kpi-value">{f.productPageVisits || 0}</div></div>
                <div className="nd-kpi" style={{ border: 'none', boxShadow: 'none', background: 'var(--paper)' }}><div className="nd-kpi-label">Add-to-cart</div><div className="nd-kpi-value">{f.addToCartClicks || 0}</div></div>
                <div className="nd-kpi" style={{ border: 'none', boxShadow: 'none', background: 'var(--paper)' }}><div className="nd-kpi-label">Checkout reach</div><div className="nd-kpi-value">{f.checkoutReach || 0}</div></div>
            </div>
            <div className="nd-detail-row"><span>Adds → Checkout</span><span className="nd-table-strong">{f.checkoutRateFromAdds}%</span></div>
            <div className="nd-detail-row" style={{ borderBottom: 'none', marginBottom: 'var(--sp-4)' }}><span>Cart intent share of clicks</span><span className="nd-table-strong">{f.addRate}%</span></div>

            {insights.clicks && insights.clicks.length > 0 && (
                <>
                    <div className="nd-label" style={{ marginBottom: 6 }}>Most tapped</div>
                    <div className="nd-stack" style={{ marginBottom: 'var(--sp-5)' }}>
                        {insights.clicks.slice(0, 8).map((c) => (
                            <div key={c.target + c.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Chip tone="muted">{addPct(c)}</Chip>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="nd-ev-label">{c.label}</div>
                                    <div className="nd-ev-meta">{c.target}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {insights.scrolls && insights.scrolls.length > 0 && (
                <>
                    <div className="nd-label" style={{ marginBottom: 6 }}>Scroll depth reached</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64, marginBottom: 'var(--sp-5)' }}>
                        {insights.scrolls.map((s) => (
                            <div key={s.depth} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div className="nd-progress-bar" style={{ width: '100%', height: `${Math.max(4, (s.count / scrollMax) * 56)}px` }} />
                                <span className="nd-faint" style={{ fontSize: 9 }}>{s.depth}%</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {insights.exitLinks && insights.exitLinks.length > 0 && (
                <>
                    <div className="nd-label" style={{ marginBottom: 6 }}>Traffic leaks (external clicks)</div>
                    <div className="nd-stack" style={{ marginBottom: 'var(--sp-5)' }}>
                        {insights.exitLinks.slice(0, 5).map((e, i) => (
                            <div key={i} className="nd-ev">
                                <div className="nd-ev-tag"><Chip tone="warn">{e.count}</Chip></div>
                                <div className="nd-ev-main">
                                    <div className="nd-ev-label">{e.label || e.href}</div>
                                    <div className="nd-ev-meta">{e.href}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="nd-label" style={{ marginBottom: 6 }}>Recommendations</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recs.map((r, i) => <li key={i} style={{ fontSize: 'var(--step-sm)', color: 'var(--ink-soft)', lineHeight: 1.45 }}>{r}</li>)}
            </ul>
        </Panel>
    );
};

const AnalyticsPage = () => {
    const [startDate, setStartDate] = useState(daysAgo(30));
    const [endDate, setEndDate] = useState(today());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [behaviors, setBehaviors] = useState([]);
    const [insights, setInsights] = useState(null);
    const [visitors, setVisitors] = useState(null);
    const [liveCount, setLiveCount] = useState(null);

    const MAX_FEED = 40;

    const { status: streamStatus } = useAnalyticsStream({
        onEvent: (event) => {
            const items = normalizeWsEvent(event);
            if (items.length === 0) return;
            setBehaviors((prev) => [...items, ...(prev || [])].slice(0, MAX_FEED));
        },
        onLiveCount: (count) => setLiveCount(count),
    });

    // Poll ticks only as a fallback while the SSE stream is down.
    const streamStatusRef = useRef(streamStatus);
    useEffect(() => { streamStatusRef.current = streamStatus; }, [streamStatus]);

    useEffect(() => {
        let alive = true;
        const tick = async () => {
            if (streamStatusRef.current === 'live') return;
            try {
                const r = await analyticsApi.getRecentBehaviors({ limit: 40 });
                if (alive) setBehaviors(r.events || []);
            } catch { /* keep last batch on transient errors */ }
        };
        tick();
        const interval = setInterval(tick, 5000);
        return () => { alive = false; clearInterval(interval); };
    }, []);

    useEffect(() => {
        let alive = true;
        const loadInsights = async () => {
            try {
                const r = await analyticsApi.getBehaviorInsights({ hours: 24 });
                if (alive) setInsights(r);
            } catch { /* non-critical */ }
        };
        loadInsights();
        const interval = setInterval(loadInsights, 30000);
        return () => { alive = false; clearInterval(interval); };
    }, []);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await analyticsApi.getAnalytics({ startDate, endDate });
            setData(res);
        } catch (err) {
            setError(errMsg(err, 'Failed to load analytics.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Recent first-party visitors (persistent ids from the storefront).
    useEffect(() => {
        let alive = true;
        const loadVisitors = async () => {
            try {
                const r = await analyticsApi.getVisitors({ days: 30, limit: 12 });
                if (alive) setVisitors(r);
            } catch { /* non-critical */ }
        };
        loadVisitors();
        const interval = setInterval(loadVisitors, 60000);
        return () => { alive = false; clearInterval(interval); };
    }, []);

    const wire = streamStatus === 'connecting' ? 'stream…' : (streamStatus === 'live' ? 'live' : 'fallback');

    if (loading && !data) return <Loading label="Crunching the numbers…" />;
    if (error && !data) return <ErrorBox message={error} onRetry={load} />;

    const a = data || {};
    const o = a.overview || {};

    return (
        <div>
            <div className="nd-page-head">
                <div>
                    <div className="nd-page-eyebrow" style={{ marginBottom: 6 }}>Intelligence</div>
                    <h1 className="nd-page-title">Analytics</h1>
                    <div className="nd-topbar-sub">The house, measured over time.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className={streamStatus === 'live' ? 'nd-live' : 'nd-live-off'} style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        {wire}
                    </span>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 'auto' }} />
                    <span className="nd-faint">→</span>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 'auto' }} />
                    <button className="nd-btn nd-btn-primary" onClick={load}>
                        <ReplayRoundedIcon style={{ fontSize: 16 }} /> Run report
                    </button>
                </div>
            </div>

            <div className="nd-grid nd-grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
                <Kpi label="Revenue" value={money(o.totalRevenue)} />
                <Kpi label="Orders" value={(o.totalOrders || 0).toLocaleString()} />
                <Kpi label="Average order" value={money(o.averageOrderValue)} />
                <Kpi label="Conversion" value={`${o.conversionRate}%`} />
                <Kpi label="Returns" value={(o.totalReturns || 0).toLocaleString()} />
                <Kpi label="Repeat buyers" value={(o.repeatCustomers || 0).toLocaleString()} />
            </div>

            <div className="nd-grid nd-grid-2" style={{ marginBottom: 'var(--sp-6)' }}>
                <LiveFeed events={behaviors} live={streamStatus === 'live'} />
                <InsightsPanel insights={insights} />
            </div>

            <div className="nd-grid nd-grid-2" style={{ marginBottom: 'var(--sp-6)' }}>
                <Panel title="Visitors" sub="Traffic in the window.">
                    <div className="nd-grid nd-grid-3" style={{ marginBottom: 'var(--sp-5)' }}>
                        <div className="nd-kpi" style={{ border: 'none', boxShadow: 'none', background: 'var(--paper)' }}><div className="nd-kpi-label">Live</div><div className="nd-kpi-value">{liveCount ?? a.visitorAnalytics?.liveVisitors}</div></div>
                        <div className="nd-kpi" style={{ border: 'none', boxShadow: 'none', background: 'var(--paper)' }}><div className="nd-kpi-label">Unique</div><div className="nd-kpi-value">{a.visitorAnalytics?.uniqueVisitors}</div></div>
                        <div className="nd-kpi" style={{ border: 'none', boxShadow: 'none', background: 'var(--paper)' }}><div className="nd-kpi-label">Visits</div><div className="nd-kpi-value">{a.visitorAnalytics?.totalVisits}</div></div>
                    </div>
                    {visitors?.visitors?.length > 0 && (
                        <>
                            <div className="nd-label" style={{ marginBottom: 6 }}>Recent visitors</div>
                            <div className="nd-table-wrap" style={{ border: 'none', marginBottom: 'var(--sp-5)' }}>
                                <table className="nd-table">
                                    <thead><tr><th>Visitor</th><th style={{ textAlign: 'right' }}>Visits</th><th style={{ textAlign: 'right' }}>Events</th><th style={{ textAlign: 'right' }}>Last seen</th></tr></thead>
                                    <tbody>
                                        {visitors.visitors.map((v) => (
                                            <tr key={v.visitorId}>
                                                <td>
                                                    <span className="nd-mono" style={{ fontSize: 11 }}>{v.visitorId.slice(0, 12)}…</span>
                                                    {v.returning && <Chip tone="info" style={{ marginLeft: 6 }}>returning</Chip>}
                                                </td>
                                                <td className="nd-num nd-faint" style={{ textAlign: 'right' }}>{v.visits}</td>
                                                <td className="nd-num nd-faint" style={{ textAlign: 'right' }}>{v.events}</td>
                                                <td className="nd-num nd-faint" style={{ textAlign: 'right' }}>{timeAgo(v.lastSeen)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    <div className="nd-label" style={{ marginBottom: 6 }}>Visits by day</div>
                    <MiniBars data={a.visitorAnalytics?.visitsByDay || []} valueKey="visits" />
                    <div className="nd-label" style={{ marginTop: 'var(--sp-5)', marginBottom: 6 }}>Visits by hour</div>
                    <MiniBars data={a.visitorAnalytics?.visitsByHour || []} valueKey="visits" />
                </Panel>
            </div>

            <div className="nd-grid nd-grid-2" style={{ marginBottom: 'var(--sp-6)' }}>
                <Panel title="Best sellers" sub="Most ordered variants in this window.">
                    {a.topSellingProducts?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {a.topSellingProducts.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span className="nd-index" style={{ width: 28 }}>0{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="nd-table-strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.productName}</div>
                                        <div className="nd-faint nd-mono" style={{ fontSize: 11 }}>{p.sku} · {p.variantInfo}, sold {p.quantitySold}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <span className="nd-hint">No sales in range.</span>}
                </Panel>

                <Panel title="Sales by region" sub="Revenue across governorates.">
                    {a.salesByRegion?.length ? (
                        <div className="nd-table-wrap" style={{ border: 'none' }}>
                            <table className="nd-table">
                                <thead><tr><th>Governorate</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Orders</th></tr></thead>
                                <tbody>
                                    {a.salesByRegion.map((r, i) => (
                                        <tr key={i}>
                                            <td>{r.governorate}</td>
                                            <td className="nd-num nd-table-strong" style={{ textAlign: 'right' }}>{money(r.totalSales)}</td>
                                            <td className="nd-num nd-faint" style={{ textAlign: 'right' }}>{r.orderCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <span className="nd-hint">No regional data.</span>}
                </Panel>
            </div>

            <div className="nd-grid nd-grid-2" style={{ marginBottom: 'var(--sp-6)' }}>
                <Panel title="Discounts used" sub="The offers doing the work.">
                    {a.discountUsage?.length ? (
                        <div className="nd-table-wrap" style={{ border: 'none' }}>
                            <table className="nd-table">
                                <thead><tr><th>Offer</th><th>Code</th><th style={{ textAlign: 'right' }}>Uses</th></tr></thead>
                                <tbody>
                                    {a.discountUsage.map((d, i) => (
                                        <tr key={i}>
                                            <td>{d.name}</td>
                                            <td className="nd-mono nd-faint">{d.couponCode}</td>
                                            <td className="nd-num" style={{ textAlign: 'right' }}>{d.usageCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <span className="nd-hint">No discount usage.</span>}
                </Panel>

                <Panel title="Low stock" sub="Variants breathing near empty.">
                    {a.lowStockItems?.length ? (
                        <div className="nd-stack">
                            {a.lowStockItems.map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <Chip tone="warn">{item.stockQuantity}</Chip>
                                    <div style={{ flex: 1 }}>
                                        <div className="nd-table-strong">{item.productName}</div>
                                        <div className="nd-faint nd-mono" style={{ fontSize: 11 }}>{item.sku} {item.colorName ? `· ${item.colorName}` : ''} {item.size ? `· ${item.size}` : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <span className="nd-hint">All shelves well stocked.</span>}
                </Panel>
            </div>

            <div className="nd-grid">
                <Panel title="Story performance" sub="The ephemeral moments that pulled attention.">
                    {a.storyPerformance?.length ? (
                        <div className="nd-table-wrap" style={{ border: 'none' }}>
                            <table className="nd-table">
                                <thead><tr><th style={{ textAlign: 'right' }}>Views</th><th style={{ textAlign: 'right' }}>Clicks</th><th style={{ textAlign: 'right' }}>CTR</th></tr></thead>
                                <tbody>
                                    {a.storyPerformance.map((s) => (
                                        <tr key={s.id}>
                                            <td className="nd-num" style={{ textAlign: 'right' }}>{s.viewCount}</td>
                                            <td className="nd-num" style={{ textAlign: 'right' }}>{s.clickCount}</td>
                                            <td className="nd-num nd-table-strong" style={{ textAlign: 'right' }}>{(s.ctr || 0).toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <span className="nd-hint">No stories in range.</span>}
                </Panel>
            </div>
        </div>
    );
};

export default AnalyticsPage;