// config/axios.js
import axios from 'axios';
import { BASE_URL } from './constant';

const axiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`, // base URL
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosInstance;
