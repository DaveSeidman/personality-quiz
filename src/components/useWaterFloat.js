import { useEffect } from 'react'

const FLOAT_SPEED = 2
const FLOAT_PROPERTIES = ['--float-transform', '--float-light-angle', '--float-gray', '--float-shadow-y', '--float-shadow-blur']

export default function useWaterFloat(ref, enabled, selector = null) {
  useEffect(() => {
    if (!enabled) return
    const card = selector ? ref.current?.querySelector(selector) : ref.current
    if (!card) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const phases = Array.from({ length: 5 }, () => Math.random() * Math.PI * 2)
    let frameId
    let previousTime = null
    let elapsed = 0

    // Layer waves with different periods so the drift stays smooth and irregular.
    const render = (now) => {
      elapsed += previousTime === null ? 0 : Math.min((now - previousTime) / 1000, 0.05) * FLOAT_SPEED
      previousTime = now
      const bob = Math.sin(elapsed * 0.78 + phases[0]) * 0.7
        + Math.sin(elapsed * 1.13 + phases[1]) * 0.3
      const pitch = Math.sin(elapsed * 0.63 + phases[2]) * 2.2
      const yaw = Math.sin(elapsed * 0.47 + phases[3]) * 2.6
      const roll = Math.sin(elapsed * 0.56 + phases[4]) * 0.9
      const drift = Math.sin(elapsed * 0.39 + phases[1]) * 0.35

      card.style.setProperty('--float-transform', `perspective(1100px) translate3d(${drift}vh, ${bob * 0.65}vh, ${bob * 5}px) rotateX(${pitch}deg) rotateY(${yaw}deg) rotateZ(${roll}deg)`)
      // Counter-rotate the light across the surface as the card tilts beneath it.
      card.style.setProperty('--float-light-angle', `${135 - yaw * 12 - pitch * 10 - roll}deg`)
      card.style.setProperty('--float-gray', `${185 + bob * 10 + pitch * 3}`)
      card.style.setProperty('--float-shadow-y', `${1.2 - bob * 0.25}vh`)
      card.style.setProperty('--float-shadow-blur', `${2.5 - bob * 0.3}vh`)
      frameId = requestAnimationFrame(render)
    }

    const syncAnimation = () => {
      cancelAnimationFrame(frameId)
      previousTime = null
      if (reducedMotion.matches) {
        FLOAT_PROPERTIES.forEach(property => card.style.removeProperty(property))
      } else if (!document.hidden) {
        frameId = requestAnimationFrame(render)
      }
    }

    syncAnimation()
    reducedMotion.addEventListener('change', syncAnimation)
    document.addEventListener('visibilitychange', syncAnimation)
    return () => {
      cancelAnimationFrame(frameId)
      reducedMotion.removeEventListener('change', syncAnimation)
      document.removeEventListener('visibilitychange', syncAnimation)
    }
  }, [ref, enabled, selector])
}
