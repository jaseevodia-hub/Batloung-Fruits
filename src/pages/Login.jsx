import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { API_URL } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token || '');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='login-container'>
      <ThemeToggle className='login-theme-toggle' />

      <div className='login-shell'>
        <section className='login-brand-panel'>
          <div className='login-brand-icon'>BF</div>
          <h1>Batloung Fruits Distribution</h1>
          <p>
            Manage fruit inventory, suppliers, street vendors, orders and sales
            reports from one modern workspace.
          </p>

          <ul className='login-features'>
            <li>Real-time stock and inventory tracking</li>
            <li>Street vendor mapping and deliveries</li>
            <li>Clear sales and order reports</li>
          </ul>
        </section>

        <section className='login-card'>
          <div className='login-card-heading'>
            <h2>Welcome back</h2>
            <p>Sign in to continue to your dashboard.</p>
          </div>

          {error && <p className='error-message' role='alert'>{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className='form-group'>
              <label>Email address</label>
              <input type='email' value={email} onChange={(e) => setEmail(e.target.value)} required placeholder='Enter your email' />
            </div>
            <div className='form-group'>
              <label>Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder='Enter your password'
              />
              <label className='show-password'>
                <input
                  type='checkbox'
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show password
              </label>
            </div>
            <button type='submit' disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
