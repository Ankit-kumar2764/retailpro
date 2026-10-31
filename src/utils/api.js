import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

export const authConfig = () => {
  const token = window.localStorage.getItem('retailpro_token');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const apiError = (error, fallback) => error.response?.data?.message || fallback;
