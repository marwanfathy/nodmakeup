import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { Field, Input } from '../common/UI';
import { errMsg } from '../utils/format';
import { toast } from 'react-toastify';

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAdminAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await login(email.trim(), password);
            toast.success('Welcome to the Studio.');
            navigate('/admin', { replace: true });
        } catch (err) {
            setError(errMsg(err, 'Sign-in failed.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="nd-login">
            <div className="nd-login-brand">
                <div className="nd-login-wordmark">
                    <span className="nd-brand-mark" style={{ width: 26, height: 26 }} />
                    <span className="nd-wordmark" style={{ fontSize: 26 }}>NOD<em>STUDIO</em></span>
                </div>
                <div>
                    <h1>The operations core of the house.</h1>
                    <p>
                        Catalogue, commerce, campaigns and customers — one command surface
                        built on a void-black console.
                    </p>
                    <div className="nd-login-principle">
                        <div>
                            <span>Craft</span>
                            <p>Every detail surfaced with intent, never noise.</p>
                        </div>
                        <div>
                            <span>Control</span>
                            <p>Orders, stock and stories in one calm view.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="nd-login-form">
                <form onSubmit={onSubmit} noValidate>
                    <div className="nd-eyebrow" style={{ marginBottom: 12 }}>Secure access</div>
                    <h1 className="nd-title1">Sign in</h1>
                    <p className="nd-muted">Use your staff credentials to open the console.</p>

                    {error && <div className="nd-login-err">{error}</div>}

                    <Field label="Email address" required>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@nodmakeup.com"
                            autoComplete="username"
                            required
                        />
                    </Field>

                    <Field label="Password" required>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••"
                            autoComplete="current-password"
                            required
                        />
                    </Field>

                    <button className="nd-btn nd-btn-primary" type="submit" disabled={busy}
                        style={{ width: '100%', marginTop: 'var(--sp-2)' }}>
                        {busy ? 'Opening the studio…' : 'Enter studio'}
                    </button>

                    <div style={{ marginTop: 'var(--sp-5)', fontSize: 'var(--step-caption)', color: 'var(--ink-faint)' }}>
                        Protected area · NOD cosmetics co.
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;