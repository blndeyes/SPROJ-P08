import axios from 'axios';

// Set this on Vercel: REACT_APP_API_BASE_URL = https://<your-render>.onrender.com
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const API_URL = `${API_BASE}/api/auth`;

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Register new user
export const register = async (userData) => {
  try {
    // userData must be: { name, email, phone, password, role }
    const response = await api.post('/register', userData);
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (error) {
    throw error?.response?.data?.message || 'Registration failed';
  }
};

// Login user
export const login = async (credentials) => {
  try {
    const response = await api.post('/login', credentials);
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (error) {
    throw error?.response?.data?.message || 'Login failed';
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const getToken = () => localStorage.getItem('token');

export const isAuthenticated = () => !!getToken();

export default {
  register,
  login,
  logout,
  getCurrentUser,
  getToken,
  isAuthenticated,
};
