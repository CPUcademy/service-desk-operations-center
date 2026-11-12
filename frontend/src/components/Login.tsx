
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./Login.css";

function Login() {
    const [openSnackBar, setOpenSnackBar] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [formData, setFormData] = useState({ email: "", password: "" });

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setFormData(prev => ({...prev, [name]: value }));
}

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        console.log(formData);
        fetch('http://localhost:8002/api/v1/auth/login',{
            method:'POST',
            headers: {'Content-Type' : 'application/json'},
            body: JSON.stringify(formData),
        })
            .then(response => {
                    if (!response.ok) throw new Error('Login failed');
                    return response.json();
                })
                .then(userData => {
                    setSuccessMessage('Login successful');
                    setOpenSnackBar(true);
                })
                .catch(() => {
                    setSuccessMessage('Failed to login');
                    setOpenSnackBar(true);
                });
    }

    return (
        <div className="login-page">
            <aside className="login-hero">
                <div className="hero-content">
                    <h2 className="hero-brand">IT help panel</h2>
                    <h1 className="hero-title">SDOC Lorem ipsum lorem</h1>
                    <h2 className="hero-subtitle">jajo bajo bajo jajo</h2>
                </div>
            </aside>

            <main className="login-main">
                <div className="login-card">
                    <h2 className="login-brand">IT help panel</h2>

                    <h2 className="login-title">
                        <b>Log In</b>
                    </h2>

                    <form onSubmit={handleSubmit} className="login-form">
                        <label className="form-label">
                            EMAIL ADDRESS
                        </label>

                        <input
                            type="text"
                            name="email"
                            className="field-input"
                            onChange={handleChange}
                            placeholder="example@xyz.com"
                        />

                        <div className="password-container">
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                onChange={handleChange}
                                className="field-input"
                            />

                            <button
                                type="button"
                                className="password-toggle"
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

                            <button
                                type="submit"
                                className="login-button"
                            >
                                Log in
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default Login;
