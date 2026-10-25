import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
})

export const getBranches = () => api.get('/branches').then((res) => res.data)

export const getMenu = (branchId) =>
  api.get('/menu', { params: { branch_id: branchId } }).then((res) => res.data)

export const placeOrder = (order) => api.post('/orders', order).then((res) => res.data)

export const trackOrder = (orderId, phone) =>
  api.get(`/orders/${orderId}`, { params: { phone } }).then((res) => res.data)

export default api