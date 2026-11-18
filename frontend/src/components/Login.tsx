
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../api";
import "./Login.css";

function Login() {
    const navigate = useNavigate();
    const { checkAuth } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [remainingTime, setRemainingTime] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
    if (remainingTime <= 0) return;

    const timer = setInterval(() => {
        setRemainingTime(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
}, [remainingTime]);

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setFormData(prev => ({...prev, [name]: value }));
}

    
    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setMessage(null);

        apiFetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        })
            .then(async response => {
                if (response.ok) {
                    await checkAuth();
                    navigate('/dashboard');
                    return;
                }

                const body = await response.json().catch(() => null);

                if (response.status === 429) {
                    const match = body?.message?.match(/(\d+)\s*seconds?/i);

                    const v = match ? parseInt(match[1], 10) : 0;

                    setRemainingTime(v);

                    setMessage({
                        text: 'Too many failed login attempts',
                        error: true
                    });

                    return;
                }

                setMessage({
                    text: body?.message ?? 'Failed to login',
                    error: true
                });
            })
            .catch(() => {
                setMessage({ text: 'Cannot reach server', error: true });
            })
            .finally(() => setSubmitting(false));
    }


    return (
        <div className="login-page">
            <aside className="login-hero">
                <div className="hero-content">
                    <h2 className="hero-brand">IT helpdesk</h2>
                    <h1 className="hero-title">Service Desk Operations Center</h1>
                    <h2 className="hero-subtitle">Monitor every workstation in real time, report issues and get help from IT — all in one place.</h2>
                </div>
            </aside>

            <main className="login-main">
                <div className="login-card">
                    <h2 className="login-brand">IT helpdesk</h2>

                    <h2 className="login-title">
                        <b>Log In</b>
                    </h2>

                    <form onSubmit={handleSubmit} className="login-form">
                        <label className="form-label" htmlFor="email">
                            EMAIL ADDRESS
                        </label>

                        <input
                            id="email"
                            type="email"
                            name="email"
                            autoComplete="email"
                            required
                            className="field-input"
                            onChange={handleChange}
                            placeholder="example@xyz.com"
                        />

                        <div className="password-container">
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                autoComplete="current-password"
                                aria-label="Password"
                                required
                                onChange={handleChange}
                                className="field-input"
                            />

                            <button
                                type="button"
                                className="password-toggle"
                                aria-label="Hold to show password"
                                onPointerDown={() => setShowPassword(true)}
                                onPointerUp={() => setShowPassword(false)}
                                onPointerLeave={() => setShowPassword(false)}
                            >
                                {showPassword ? (
                                    <Eye size={20} />
                                ) : (
                                    <EyeOff size={20} />
                                )}
                            </button>

                            <button type="submit" disabled={remainingTime > 0 || submitting} className="login-button">
                                {submitting && <span className="spinner spinner-small" aria-hidden="true" />}
                                {remainingTime > 0
                                    ? `Try again in ${remainingTime}s`
                                    : submitting ? 'Signing in…' : 'Login'}
                            </button>
                        </div>
                        {message && (
                            <p role="alert" className="login-message">
                                {message.text}
                            </p>
                        )}
                    </form>
                </div>
            </main>
        </div>
    );
}

export default Login;
