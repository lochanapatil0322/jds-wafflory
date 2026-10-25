import axios from 'axios'

export const AUTH_KEY = 'adminAuth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
})

// The login token is kept in memory here and sent with every request
let authToken = null
export const setAuthToken = (token) => {
  authToken = token
}

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`
  return config
})

// If the server says our token is no good, log out and go back to the login page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && authToken) {
      authToken = null
      try {
        localStorage.removeItem(AUTH_KEY)
      } catch {
        // storage can be blocked; nothing to clean up then
      }
      window.location.assign('/admin')
    }
    return Promise.reject(error)
  },
)

// ---------- Customer ----------
export const getBranches = () => api.get('/branches').then((res) => res.data)

export const getMenu = (branchId) =>
  api.get('/menu', { params: { branch_id: branchId } }).then((res) => res.data)

export const placeOrder = (order) => api.post('/orders', order).then((res) => res.data)

export const trackOrder = (orderId, phone) =>
  api.get(`/orders/${orderId}`, { params: { phone } }).then((res) => res.data)

// ---------- Owner and staff ----------
// The backend login expects a form with the fields "username" and "password".
// We use the phone number as the username.
export const login = (phone, password) =>
  api.post('/auth/login', new URLSearchParams({ username: phone, password })).then((res) => res.data)

export const getMe = () => api.get('/auth/me').then((res) => res.data)
export const getAdminOrders = (params) =>
    api.get('/admin/orders', { params }).then((res) => res.data)

export const setOrderStatus = (orderId, status) =>
    api.patch(`/admin/orders/${orderId}/status`, { status }).then((res) => res.data)

export const markOrderPaid = (orderId) =>
    api.patch(`/admin/orders/${orderId}/paid`).then((res) => res.data)


   export const getAdminMenu = () => api.get('/admin/menu').then((res) => res.data)

   export const setAvailability = (branchId, itemId, isAvailable) =>
     api
       .patch('/admin/availability', {
         branch_id: branchId,
         item_id: itemId,
         is_available: isAvailable,
       })
       .then((res) => res.data)

   export const setPrice = (variantId, price) =>
     api.patch(`/admin/variants/${variantId}/price`, { price }).then((res) => res.data)

   export const createItem = (data) => api.post('/admin/items', data).then((res) => res.data)

   export const updateItem = (itemId, data) =>
     api.patch(`/admin/items/${itemId}`, data).then((res) => res.data)
   
export default api