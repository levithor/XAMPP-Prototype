import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import Login from '../src/pages/Login.vue'
import Register from '../src/pages/Register.vue'
import router from '../src/router.js'
import { clearAuth, getToken, getUser, saveAuth } from '../src/auth.js'
import App from '../src/App.vue'

const api = vi.hoisted(() => ({
  loginAdmin: vi.fn(),
  registerAdmin: vi.fn()
}))

vi.mock('../src/api.js', () => api)

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>dashboard</div>' } },
      { path: '/login', component: Login },
      { path: '/register', component: Register }
    ]
  })
}

describe('User Authentication frontend', () => {
  beforeEach(() => {
    clearAuth()
    api.loginAdmin.mockReset()
    api.registerAdmin.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects an empty login form without calling the API', async () => {
    const wrapper = mount(Login, { global: { plugins: [createTestRouter()] } })

    await wrapper.get('button.btn-signin').trigger('click')

    expect(wrapper.text()).toContain('please enter your email and password.')
    expect(api.loginAdmin).not.toHaveBeenCalled()
  })

  it('submits credentials, saves returned auth, and navigates to the dashboard', async () => {
    const testRouter = createTestRouter()
    api.loginAdmin.mockResolvedValue({
      token: 'test-token',
      admin: { id: 8, username: 'operator' }
    })
    const wrapper = mount(Login, { global: { plugins: [testRouter] } })

    await wrapper.get('input[placeholder="admin@occuvision.com"]').setValue('operator@example.test')
    await wrapper.get('input[autocomplete="current-password"]').setValue('secret')
    await wrapper.get('button.btn-signin').trigger('click')
    await flushPromises()

    expect(api.loginAdmin).toHaveBeenCalledWith('operator@example.test', 'secret')
    expect(getToken()).toBe('test-token')
    expect(getUser()).toEqual({ id: 8, username: 'operator' })
    expect(testRouter.currentRoute.value.path).toBe('/')
  })

  it('shows login API failures without authenticating the user', async () => {
    api.loginAdmin.mockRejectedValue(new Error('invalid credentials'))
    const wrapper = mount(Login, { global: { plugins: [createTestRouter()] } })

    await wrapper.get('input[placeholder="admin@occuvision.com"]').setValue('bad@example.test')
    await wrapper.get('input[autocomplete="current-password"]').setValue('wrong')
    await wrapper.get('button.btn-signin').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('invalid credentials')
    expect(getToken()).toBeNull()
  })

  it('validates registration fields before making an API request', async () => {
    const wrapper = mount(Register, { global: { plugins: [createTestRouter()] } })

    await wrapper.get('button.btn-signin').trigger('click')

    expect(wrapper.text()).toContain('username is required')
    expect(wrapper.text()).toContain('email is required')
    expect(wrapper.text()).toContain('password is required')
    expect(wrapper.text()).toContain('please confirm your password')
    expect(api.registerAdmin).not.toHaveBeenCalled()
  })

  it('submits trimmed registration details and displays success feedback', async () => {
    vi.useFakeTimers()
    const testRouter = createTestRouter()
    api.registerAdmin.mockResolvedValue({ message: 'created' })
    const wrapper = mount(Register, { global: { plugins: [testRouter] } })

    await wrapper.get('input[placeholder="e.g. manager_mario"]').setValue('  manager  ')
    await wrapper.get('input[placeholder="admin@occuvision.com"]').setValue(' manager@example.test ')
    await wrapper.get('input[placeholder="min. 8 characters"]').setValue('password123')
    await wrapper.get('input[placeholder="repeat your password"]').setValue('password123')
    await wrapper.get('button.btn-signin').trigger('click')
    await flushPromises()

    expect(api.registerAdmin).toHaveBeenCalledWith({
      username: 'manager',
      email: 'manager@example.test',
      password: 'password123'
    })
    expect(wrapper.text()).toContain('account created! redirecting to sign in')
    expect(wrapper.get('button.btn-signin').attributes('disabled')).toBeDefined()

    await vi.advanceTimersByTimeAsync(1800)
    await flushPromises()
    expect(testRouter.currentRoute.value.path).toBe('/login')
  })

  it('shows registration API failures and permits another submission', async () => {
    api.registerAdmin.mockRejectedValue(new Error('email already registered'))
    const wrapper = mount(Register, { global: { plugins: [createTestRouter()] } })

    await wrapper.get('input[placeholder="e.g. manager_mario"]').setValue('manager')
    await wrapper.get('input[placeholder="admin@occuvision.com"]').setValue('manager@example.test')
    await wrapper.get('input[placeholder="min. 8 characters"]').setValue('password123')
    await wrapper.get('input[placeholder="repeat your password"]').setValue('password123')
    await wrapper.get('button.btn-signin').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('email already registered')
    expect(wrapper.get('button.btn-signin').attributes('disabled')).toBeUndefined()
  })

  it('redirects protected and public routes according to stored authentication', async () => {
    clearAuth()
    await router.push('/rooms')
    expect(router.currentRoute.value.path).toBe('/login')

    saveAuth('test-token', { username: 'operator' })
    await router.push('/register')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('clears local authentication and routes to login on logout', async () => {
    saveAuth('test-token', { username: 'operator' })
    const appRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>dashboard</div>' } },
        { path: '/login', component: { template: '<div>login form</div>' } }
      ]
    })
    await appRouter.push('/')
    const wrapper = mount(App, {
      global: {
        plugins: [appRouter],
        stubs: {
          AppSidebar: { template: '<button @click="$emit(\'logout\')">log out</button>' },
          ToastList: true
        }
      }
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(getToken()).toBeNull()
    expect(getUser()).toBeNull()
    expect(appRouter.currentRoute.value.path).toBe('/login')
    expect(wrapper.text()).toContain('login form')
  })
})
