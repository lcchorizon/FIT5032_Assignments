import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import axios from 'axios'
import WeatherView from '../src/views/WeatherView.vue'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

describe('weather search', () => {
  it('does not request data until the user searches', () => {
    mount(WeatherView)
    expect(axios.get).not.toHaveBeenCalled()
  })
  it('rejects blank input without making a request', async () => {
    const view = mount(WeatherView)
    await view.get('input').setValue(' ')
    await view.get('form').trigger('submit')
    expect(view.get('[role="alert"]').text()).toContain('Enter a city')
    expect(axios.get).not.toHaveBeenCalled()
  })
  it('reports an unknown city and skips the forecast request', async () => {
    axios.get.mockResolvedValueOnce({ data: {} })
    const view = mount(WeatherView)
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(view.get('[role="alert"]').text()).toContain('City not found')
    expect(axios.get).toHaveBeenCalledTimes(1)
  })
  it('renders a forecast using the coordinates returned by city search', async () => {
    axios.get.mockResolvedValueOnce({ data: { results: [{name:'Melbourne',country:'Australia',latitude:-37.81,longitude:144.96}] } })
    axios.get.mockResolvedValueOnce({ data: { timezone:'Australia/Melbourne', current:{temperature_2m:18.2,relative_humidity_2m:60,weather_code:3,wind_speed_10m:12,time:'2026-10-23T18:00'} } })
    const view = mount(WeatherView)
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(axios.get.mock.calls[1][1].params).toMatchObject({latitude:-37.81,longitude:144.96})
    expect(view.get('article').text()).toContain('18.2 °C')
    expect(view.get('article').text()).toContain('Melbourne, Australia')
  })
  it('recovers from a network error and allows another search', async () => {
    axios.get.mockRejectedValueOnce(new Error('offline'))
    const view = mount(WeatherView)
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(view.get('[role="alert"]').text()).toContain('Could not load')
    expect(view.get('button').attributes('disabled')).toBeUndefined()
  })
})
